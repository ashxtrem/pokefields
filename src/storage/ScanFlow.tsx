import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../ui/components";
import { PAGE_COUNT } from "./constants";
import { checkNativeScreenshotShape, decodeImage, sha256Hex } from "./recognition/normalize";
import { terminateOcrWorker } from "./recognition/ocr";
import type { SlotResult } from "./recognition/matcher";
import { prepareScanSlots } from "./recognition/scanPrepare";
import { cancelScan, runMatchTasks } from "./recognition/scanWorkerPool";
import { ScanReview } from "./ScanReview";
import { newUid, type StorageChest } from "./types";

function taskKey(page: number, slot: number) {
  return `${page}:${slot}`;
}

interface PageSlot {
  page: number;
  file: File | null;
  hash: string | null;
  shapeError: string | null;
}

export function ScanFlow({ chest, onClose }: { chest: StorageChest; onClose: () => void }) {
  const pageCount = PAGE_COUNT[chest.type];
  const [slots, setSlots] = useState<PageSlot[]>(() =>
    Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      file: null,
      hash: null,
      shapeError: null,
    })),
  );
  const [stage, setStage] = useState<"capture" | "scanning" | "review">("capture");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [results, setResults] = useState<Array<{ page: number; slots: SlotResult[] }> | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const scanIdRef = useRef("");
  // The recognition worker pool is a persistent, module-level singleton now (see
  // scanWorkerPool.ts) — it deliberately outlives this component so its warmed-up OpenCV/reference
  // index state carries over to the next scan. An in-flight scan's promise can therefore still be
  // running after this component unmounts; guard state updates on that.
  const mountedRef = useRef(true);

  useEffect(
    () => {
      // Explicitly re-arm on every effect setup, not just the initial useRef value — React 18
      // StrictMode double-invokes effects in development (mount, cleanup, mount again), which
      // would otherwise leave this permanently false after that dev-only simulated remount.
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (scanIdRef.current) cancelScan(scanIdRef.current);
        terminateOcrWorker();
      };
    },
    [],
  );

  const scannedSlots = slots.filter((slot) => slot.file && !slot.shapeError);
  const readyToScan = scannedSlots.length > 0;
  const isCompleteAttempt = scannedSlots.length === pageCount;
  const anyUnsupported = slots.some((slot) => slot.file && slot.shapeError);

  const duplicatePairs = useMemo(() => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        if (slots[i]!.hash && slots[i]!.hash === slots[j]!.hash) pairs.push([slots[i]!.page, slots[j]!.page]);
      }
    }
    return pairs;
  }, [slots]);

  const onFileChosen = async (pageIndex: number, file: File) => {
    // Never let an unexpected failure here leave the page slot silently stuck (file shown by the
    // native input, but no "ready"/error state and Scan disabled with no explanation) — always
    // land on a shapeError the player can see, even for a bug this didn't anticipate.
    let shapeError = "This image could not be read.";
    let hash: string | null = null;
    try {
      const bitmap = await decodeImage(file).catch(() => null);
      const shapeCheck = bitmap
        ? checkNativeScreenshotShape(bitmap.width, bitmap.height)
        : { supported: false as const, reason: "This image could not be read." };
      bitmap?.close();
      hash = await sha256Hex(file);
      shapeError = shapeCheck.supported ? "" : shapeCheck.reason;
    } catch (error) {
      shapeError = error instanceof Error ? error.message : shapeError;
    }
    setSlots((current) =>
      current.map((slot, index) =>
        index === pageIndex ? { ...slot, file, hash, shapeError: shapeError || null } : slot,
      ),
    );
  };

  const startScan = async () => {
    setError("");
    setStage("scanning");
    setProgress({ done: 0, total: scannedSlots.length * 20 });
    const scanId = newUid();
    scanIdRef.current = scanId;

    try {
      const bitmaps = await Promise.all(scannedSlots.map((slot) => decodeImage(slot.file!)));
      const pages = scannedSlots.map((slot, index) => ({ page: slot.page, bitmap: bitmaps[index]! }));
      // Cropping, shared-background estimation, and occupied/empty classification all run here on
      // the main thread — no OpenCV needed for any of it (see scanPrepare.ts) — so the worker pool
      // only ever spends time on the CV-dependent matching step, for occupied slots only.
      const prepared = await prepareScanSlots(pages);
      if (!mountedRef.current) return;

      const emptyCount = prepared.filter((slot) => !slot.occupied).length;
      setProgress({ done: emptyCount, total: prepared.length });

      const tasks = prepared
        .filter((slot) => slot.occupied)
        .map((slot) => ({
          id: taskKey(slot.page, slot.slot),
          grey: slot.grey!,
          histogram: slot.descriptor!.histogram,
          shape: slot.descriptor!.shape,
          aspect: slot.descriptor!.aspect,
        }));

      const outcomeById = await runMatchTasks(scanId, tasks, (done) => {
        if (mountedRef.current) setProgress({ done: emptyCount + done, total: prepared.length });
      });
      scanIdRef.current = "";
      if (!mountedRef.current) return;

      if (outcomeById === "cancelled") {
        setStage("capture");
        return;
      }

      const byPage = new Map<number, SlotResult[]>();
      for (const slot of prepared) {
        const list = byPage.get(slot.page) ?? [];
        list.push({
          slot: slot.slot,
          bounds: slot.bounds,
          outcome: slot.occupied ? (outcomeById.get(taskKey(slot.page, slot.slot)) ?? null) : null,
          thumbnail: slot.thumbnail,
        });
        byPage.set(slot.page, list);
      }
      setResults([...byPage.entries()].map(([page, slots]) => ({ page, slots })));
      setStage("review");
    } catch (err) {
      scanIdRef.current = "";
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Recognition failed on this page.");
      setStage("capture");
    }
  };

  const confirmCancelScan = () => {
    setConfirmingCancel(false);
    // Soft-cancel only — the recognition worker pool is a persistent, module-level singleton (see
    // scanWorkerPool.ts) that deliberately outlives this modal, so canceling a scan must not
    // terminate it; that would throw away its warmed-up OpenCV/reference-index state and force the
    // next scan to pay that cost all over again.
    cancelScan(scanIdRef.current);
    onClose();
  };

  if (stage === "review" && results) {
    return (
      <ScanReview
        chest={chest}
        pageResults={results}
        isCompleteAttempt={isCompleteAttempt}
        onDone={onClose}
        onBack={() => {
          setStage("capture");
          setResults(null);
        }}
      />
    );
  }

  return (
    <Modal title="Import screenshot" onClose={onClose} sheet wide closable={stage !== "scanning"}>
      {stage === "scanning" ? (
        <div className="storage-scan-progress" role="status" aria-live="polite">
          <p>Scanning… {progress.total ? `${progress.done} of ${progress.total} slots` : ""}</p>
          <progress value={progress.done} max={progress.total || 1} />
          <button type="button" className="button secondary" onClick={() => setConfirmingCancel(true)}>
            Cancel scan
          </button>
          {confirmingCancel ? (
            <Modal title="Cancel this scan?" onClose={() => setConfirmingCancel(false)}>
              <p>
                Recognition progress so far will be lost and this window will close. Nothing has
                been saved to this chest yet.
              </p>
              <div className="button-row">
                <button type="button" className="button" onClick={confirmCancelScan}>
                  Cancel scan
                </button>
                <button type="button" className="button secondary" onClick={() => setConfirmingCancel(false)}>
                  Keep scanning
                </button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : (
        <>
          <p className="muted">
            {pageCount === 1
              ? "Upload one full-screen native Switch screenshot of this storage box (1920x1080)."
              : `Upload one, two, or all three pages of this Big storage box (1920x1080 each) — you can add the rest later. ${scannedSlots.length} of ${pageCount} ready.`}
          </p>
          {duplicatePairs.length > 0 ? (
            <p className="notice">
              Pages {duplicatePairs.map(([a, b]) => `${a} & ${b}`).join(", ")} look identical — check you
              photographed different pages.
            </p>
          ) : null}
          <div className="storage-scan-pages">
            {slots.map((slot, index) => (
              <div key={slot.page} className="storage-scan-page">
                <h3>Page {slot.page}</h3>
                <input
                  type="file"
                  accept="image/*"
                  aria-label={`Screenshot for page ${slot.page}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFileChosen(index, file);
                  }}
                />
                {slot.file && !slot.shapeError ? <p className="muted">{slot.file.name} — ready</p> : null}
                {slot.shapeError ? (
                  <p className="notice">
                    {slot.shapeError} You can still add this page's items manually from the chest page.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button type="button" className="button" disabled={!readyToScan} onClick={startScan}>
              Scan {scannedSlots.length === 1 ? "page" : "pages"}
            </button>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
          {anyUnsupported ? (
            <p className="muted">
              Unsupported pages are skipped by the scanner. Use "Add item" on the chest page to record
              their contents manually.
            </p>
          ) : null}
        </>
      )}
    </Modal>
  );
}
