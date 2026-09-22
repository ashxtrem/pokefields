import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../ui/components";
import { PAGE_COUNT } from "./constants";
import { checkNativeScreenshotShape, decodeImage, sha256Hex } from "./recognition/normalize";
import { terminateOcrWorker } from "./recognition/ocr";
import type { SlotResult } from "./recognition/matcher";
import type { ScanWorkerRequest, ScanWorkerResponse } from "./recognition/protocol";
import { ScanReview } from "./ScanReview";
import type { StorageChest } from "./types";

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
  const workerRef = useRef<Worker | null>(null);
  const scanIdRef = useRef("");

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      terminateOcrWorker();
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
    const bitmap = await decodeImage(file).catch(() => null);
    const shapeCheck = bitmap
      ? checkNativeScreenshotShape(bitmap.width, bitmap.height)
      : { supported: false as const, reason: "This image could not be read." };
    const hash = await sha256Hex(file);
    bitmap?.close();
    setSlots((current) =>
      current.map((slot, index) =>
        index === pageIndex
          ? { ...slot, file, hash, shapeError: shapeCheck.supported ? null : shapeCheck.reason }
          : slot,
      ),
    );
  };

  const startScan = async () => {
    setError("");
    setStage("scanning");
    setProgress({ done: 0, total: scannedSlots.length * 20 });
    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;
    if (!workerRef.current)
      workerRef.current = new Worker(new URL("./recognition/worker.ts", import.meta.url), { type: "module" });
    const worker = workerRef.current;
    const bitmaps = await Promise.all(scannedSlots.map((slot) => decodeImage(slot.file!)));

    worker.onmessage = (event: MessageEvent<ScanWorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress" && message.scanId === scanId) {
        setProgress({ done: message.done, total: message.total });
      } else if (message.type === "result" && message.scanId === scanId) {
        setResults(message.pages);
        setStage("review");
      } else if (message.type === "cancelled" && message.scanId === scanId) {
        setStage("capture");
      } else if (message.type === "error") {
        setError(message.message);
        setStage("capture");
      }
    };

    const request: ScanWorkerRequest = {
      type: "scan",
      scanId,
      pages: scannedSlots.map((slot, index) => ({ page: slot.page, bitmap: bitmaps[index]! })),
    };
    worker.postMessage(request, bitmaps);
  };

  const cancelScan = () => {
    const request: ScanWorkerRequest = { type: "cancel", scanId: scanIdRef.current };
    workerRef.current?.postMessage(request);
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
    <Modal title="Import screenshot" onClose={onClose} sheet wide>
      {stage === "scanning" ? (
        <div className="storage-scan-progress" role="status" aria-live="polite">
          <p>Scanning… {progress.total ? `${progress.done} of ${progress.total} slots` : ""}</p>
          <progress value={progress.done} max={progress.total || 1} />
          <button type="button" className="button secondary" onClick={cancelScan}>
            Cancel scan
          </button>
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
