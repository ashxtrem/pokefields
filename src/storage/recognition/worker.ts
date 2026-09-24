/// <reference lib="webworker" />
// Recognition Web Worker — one member of the pool scanWorkerPool.ts manages. Loads OpenCV.js and
// the precomputed reference index lazily, on its first assigned task, and keeps both cached for
// this worker's entire lifetime (see scanWorkerPool.ts for why that lifetime now spans the whole
// page session instead of one scan). Only handles the CV-dependent matching step — every
// non-OpenCV step (cropping, background estimation, occupied/empty classification) already
// happened on the main thread before a task ever reaches here; see scanPrepare.ts.

import cvModule from "@techstark/opencv-js";
import { RECOGNITION_INDEX_URL } from "../constants";
import { DEFAULT_CONFIDENCE_THRESHOLDS } from "./core/thresholds.mjs";
import { loadReferenceIndex, type LoadedReferenceIndex } from "./referenceIndex";
import { matchOccupiedSlot } from "./matcher";
import type { MatchTaskResult, ScanWorkerRequest, ScanWorkerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let cvPromise: Promise<unknown> | null = null;
let referenceIndexPromise: Promise<LoadedReferenceIndex> | null = null;
const cancelledScanIds = new Set<string>();
const activeScanIds = new Set<string>();

function post(message: ScanWorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, transfer);
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

  if (message.type === "cancel") {
    if (activeScanIds.has(message.scanId)) cancelledScanIds.add(message.scanId);
    return;
  }

  if (message.type === "matchSlots") {
    const { scanId, tasks } = message;
    activeScanIds.add(scanId);
    try {
      const { cv, referenceIndex } = await ensureReady();
      const results: MatchTaskResult[] = [];
      let done = 0;
      for (const task of tasks) {
        if (cancelledScanIds.has(scanId)) break;
        const outcome = matchOccupiedSlot({
          cv,
          referenceIndex,
          thresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
          descriptor: { histogram: task.histogram, shape: task.shape, aspect: task.aspect },
          grey: task.grey,
        });
        const result = { id: task.id, outcome };
        results.push(result);
        post({ type: "slot", scanId, result });
        done += 1;
        post({ type: "progress", scanId, done, total: tasks.length });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      if (cancelledScanIds.has(scanId)) {
        cancelledScanIds.delete(scanId);
        post({ type: "result", scanId, results });
        post({ type: "cancelled", scanId });
      } else {
        post({ type: "result", scanId, results });
      }
    } catch (error) {
      post({
        type: "error",
        scanId,
        message: error instanceof Error ? error.message : "Recognition failed on this page.",
      });
    } finally {
      activeScanIds.delete(scanId);
      cancelledScanIds.delete(scanId);
    }
  }
};
