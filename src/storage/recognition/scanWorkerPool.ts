import { isAndroidDistribution } from "../../platform/distribution";
import type { RecognitionOutcome } from "../types";
import type { MatchTask, ScanWorkerRequest, ScanWorkerResponse } from "./protocol";

/**
 * A persistent, module-level pool of recognition workers — created lazily on first use and kept
 * alive for the life of the page, not per "Import screenshot" open. Every worker independently
 * loads OpenCV.js and the ~43 MiB reference index once, on its first assigned task, and keeps both
 * cached for as long as the worker lives — so that cost is now paid once per app session instead
 * of once per scan. See docs/storage-scan-performance-plan.md.
 *
 * Pool size defaults to 1 (no parallelism, matching the previous single-worker behavior) on the
 * Android distribution: each extra worker needs its own full OpenCV WASM instance plus its own
 * ~1,765 reconstructed descriptor objects, which is a real memory risk on the low-end/mid-range
 * devices that distribution's own release checklist targets and has not yet verified recognition
 * memory behavior on. Raise this once that verification has passed.
 */
function defaultPoolSize(): number {
  if (isAndroidDistribution()) return 1;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  return Math.max(1, Math.min(cores ?? 2, 2));
}

let workers: Worker[] | null = null;
const cancelledScanIds = new Set<string>();

export interface MatchRunResult {
  status: "completed" | "cancelled";
  results: Map<string, RecognitionOutcome | null>;
}

function ensurePool(): Worker[] {
  if (!workers) {
    const size = defaultPoolSize();
    workers = Array.from(
      { length: size },
      () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
    );
  }
  return workers;
}

function chunk<T>(items: T[], parts: number): T[][] {
  const result: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((item, index) => result[index % parts]!.push(item));
  return result.filter((part) => part.length > 0);
}

/**
 * Runs `tasks` (one per occupied slot) across the persistent pool, distributing them evenly and
 * aggregating progress and results by `scanId`. A cancelled run resolves with every result that
 * streamed before cancellation; rejects if any worker reports an error.
 */
export function runMatchTasks(
  scanId: string,
  tasks: MatchTask[],
  onProgress: (done: number, total: number) => void,
  onSlot?: (id: string, outcome: RecognitionOutcome | null) => void,
): Promise<MatchRunResult> {
  if (tasks.length === 0)
    return Promise.resolve({ status: "completed", results: new Map() });

  cancelledScanIds.delete(scanId);
  const pool = ensurePool();
  const chunks = chunk(tasks, pool.length);
  const total = tasks.length;
  const doneByChunk = new Array(chunks.length).fill(0);
  const settledByChunk = new Array(chunks.length).fill(false);

  return new Promise((resolve, reject) => {
    const results = new Map<string, RecognitionOutcome | null>();
    const listeners: Array<{ worker: Worker; handler: (event: MessageEvent<ScanWorkerResponse>) => void }> = [];
    let settledCount = 0;
    let cancelledAny = false;
    let settledOverall = false;

    const cleanupAll = () => {
      for (const { worker, handler } of listeners) worker.removeEventListener("message", handler);
      cancelledScanIds.delete(scanId);
    };
    const settleChunk = (chunkIndex: number) => {
      if (settledByChunk[chunkIndex]) return;
      settledByChunk[chunkIndex] = true;
      settledCount += 1;
      if (settledCount === chunks.length) {
        settledOverall = true;
        const status =
          cancelledAny || cancelledScanIds.has(scanId) ? "cancelled" : "completed";
        cleanupAll();
        resolve({ status, results });
      }
    };

    chunks.forEach((chunkTasks, chunkIndex) => {
      const worker = pool[chunkIndex]!;
      const handler = (event: MessageEvent<ScanWorkerResponse>) => {
        if (settledOverall) return;
        const message = event.data;
        if (message.scanId !== scanId) return;

        if (message.type === "progress") {
          doneByChunk[chunkIndex] = message.done;
          onProgress(doneByChunk.reduce((sum, value) => sum + value, 0), total);
        } else if (message.type === "slot") {
          results.set(message.result.id, message.result.outcome);
          onSlot?.(message.result.id, message.result.outcome);
        } else if (message.type === "result") {
          for (const { id, outcome } of message.results) results.set(id, outcome);
          settleChunk(chunkIndex);
        } else if (message.type === "cancelled") {
          cancelledAny = true;
          settleChunk(chunkIndex);
        } else if (message.type === "error") {
          settledOverall = true;
          cleanupAll();
          reject(new Error(message.message));
        }
      };

      listeners.push({ worker, handler });
      worker.addEventListener("message", handler);

      const transfer: Transferable[] = [];
      for (const task of chunkTasks) transfer.push(task.grey.buffer, task.histogram.buffer, task.shape.buffer);
      const request: ScanWorkerRequest = { type: "matchSlots", scanId, tasks: chunkTasks };
      worker.postMessage(request, transfer);
    });
  });
}

/** Soft-cancels an in-flight scan on every pool worker without destroying the warmed-up pool. */
export function cancelScan(scanId: string) {
  cancelledScanIds.add(scanId);
  workers?.forEach((worker) => worker.postMessage({ type: "cancel", scanId } satisfies ScanWorkerRequest));
}
