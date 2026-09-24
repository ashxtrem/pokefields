import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/components";
import { PAGE_COUNT } from "./constants";
import { checkNativeScreenshotShape, decodeImage, sha256Hex } from "./recognition/normalize";
import { ScanReview } from "./ScanReview";
import { useScanSession, type ScanPage } from "./scanSession";
import type { StorageChest } from "./types";

interface PageSlot {
  page: number;
  file: File | null;
  hash: string | null;
  shapeError: string | null;
}

export function ScanFlow({ chest, onClose }: { chest: StorageChest; onClose: () => void }) {
  const {
    session,
    startScan,
    discardSession,
    setReviewOpen,
  } = useScanSession();
  const pageCount = PAGE_COUNT[chest.type];
  const chestSession = session?.chestId === chest.id ? session : null;
  const [slots, setSlots] = useState<PageSlot[]>(() =>
    Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      file: chestSession?.pages.find((page) => page.page === index + 1)?.file ?? null,
      hash: chestSession?.pages.find((page) => page.page === index + 1)?.hash ?? null,
      shapeError: null,
    })),
  );
  const [showCapture, setShowCapture] = useState(!chestSession || chestSession.phase === "failed");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!chestSession) return;
    setReviewOpen(true);
    return () => setReviewOpen(false);
  }, [Boolean(chestSession), setReviewOpen]);

  useEffect(() => {
    if (chestSession?.phase === "failed") {
      setShowCapture(true);
      setError(chestSession.error);
    }
  }, [chestSession?.phase, chestSession?.error]);

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

  const beginScan = () => {
    setError("");
    const pages = scannedSlots.map(
      (slot) =>
        ({ page: slot.page, file: slot.file!, hash: slot.hash! }) satisfies ScanPage,
    );
    if (startScan(chest, pages, isCompleteAttempt)) setShowCapture(false);
  };

  if (chestSession && !showCapture) {
    return (
      <ScanReview
        chest={chest}
        session={chestSession}
        onDone={() => {
          discardSession();
          onClose();
        }}
        onBack={() => setShowCapture(true)}
      />
    );
  }

  return (
    <Modal title="Import screenshot" onClose={onClose} sheet wide>
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
            <button type="button" className="button" disabled={!readyToScan} onClick={beginScan}>
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
    </Modal>
  );
}
