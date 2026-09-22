/// <reference lib="webworker" />
// Recognition Web Worker — new ground for this repo (no prior Worker usage existed here). Loads
// OpenCV.js and the precomputed reference index lazily, only once the scan flow actually starts
// (see src/storage/ScanFlow.tsx, which is the only place that imports this file), so normal
// Pokédex/Items/Habitats navigation never pays for either.

import cvModule from "@techstark/opencv-js";
import { RECOGNITION_INDEX_URL } from "../constants";
import { DEFAULT_CONFIDENCE_THRESHOLDS } from "./core/thresholds.mjs";
import { loadReferenceIndex, type LoadedReferenceIndex } from "./referenceIndex";
import { buildScanBackground, extractAllSlotPixels } from "./slots";
import { recognizePage, type SlotResult } from "./matcher";
import type { ScanWorkerRequest, ScanWorkerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let cvPromise: Promise<unknown> | null = null;
let referenceIndexPromise: Promise<LoadedReferenceIndex> | null = null;
const cancelledScanIds = new Set<string>();

function post(message: ScanWorkerResponse) {
  self.postMessage(message);
}

async function ensureReady() {
  if (!cvPromise) cvPromise = cvModule as unknown as Promise<unknown>;
  const cv = await cvPromise;
  if (!referenceIndexPromise) referenceIndexPromise = loadReferenceIndex(cv, RECOGNITION_INDEX_URL);
  const referenceIndex = await referenceIndexPromise;
  return { cv, referenceIndex };
}

self.onmessage = async (event: MessageEvent<ScanWorkerRequest>) => {
  const message = event.data;

  if (message.type === "init") {
    try {
      await ensureReady();
      post({ type: "ready" });
    } catch (error) {
      post({ message: error instanceof Error ? error.message : "Recognition could not start.", type: "error" });
    }
    return;
  }

  if (message.type === "cancel") {
    cancelledScanIds.add(message.scanId);
    return;
  }

  if (message.type === "scan") {
    const { scanId, pages } = message;
    try {
      const { cv, referenceIndex } = await ensureReady();
      const allSlotPixels = pages.map((page) => extractAllSlotPixels(page.bitmap));
      const background = buildScanBackground(allSlotPixels);
      const totalSlots = pages.length * allSlotPixels[0]!.length;
      let completed = 0;
      const pagesOut: Array<{ page: number; slots: SlotResult[] }> = [];

      for (const page of pages) {
        if (cancelledScanIds.has(scanId)) break;
        const slots = await recognizePage({
          cv,
          bitmap: page.bitmap,
          background,
          referenceIndex,
          thresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
          onProgress: (done) => post({ type: "progress", scanId, done: completed + done, total: totalSlots }),
          isCancelled: () => cancelledScanIds.has(scanId),
        });
        completed += slots.length;
        pagesOut.push({ page: page.page, slots });
        page.bitmap.close();
      }

      if (cancelledScanIds.has(scanId)) {
        cancelledScanIds.delete(scanId);
        post({ type: "cancelled", scanId });
      } else {
        post({ type: "result", scanId, pages: pagesOut });
      }
    } catch (error) {
      post({
        type: "error",
        scanId,
        message: error instanceof Error ? error.message : "Recognition failed on this page.",
      });
    }
  }
};
