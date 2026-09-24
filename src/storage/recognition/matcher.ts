import { ORB_SIDE, RETRIEVAL } from "./core/constants.mjs";
import { classifyOutcome, type ConfidenceThresholds } from "./core/confidence.mjs";
import { makeOrbDescriptor } from "./core/orb.mjs";
import { rankCandidates } from "./core/retrieval.mjs";
import type { LoadedReferenceIndex } from "./referenceIndex";
import type { CropRect } from "./core/grid.mjs";
import type { RecognitionOutcome } from "../types";

export interface SlotResult {
  slot: number;
  bounds: CropRect;
  /** null means the slot was classified empty — never shown as an identified item. */
  outcome: RecognitionOutcome | null;
  /** A small crop for review; null for an empty slot (nothing to show or persist). */
  thumbnail: Blob | null;
}

/**
 * The CV-dependent tail of what used to be the single-worker `recognizePage`: builds an ORB
 * descriptor from a pre-cropped greyscale slot (see scanPrepare.ts, which does all the
 * non-CV cropping/classification on the main thread) and matches it against the reference index.
 * Runs inside a recognition worker — see worker.ts, which calls this once per occupied slot it's
 * been assigned by the pool (scanWorkerPool.ts). See docs/storage-scan-performance-plan.md.
 */
export function matchOccupiedSlot({
  cv,
  referenceIndex,
  thresholds,
  descriptor,
  grey,
}: {
  cv: any;
  referenceIndex: LoadedReferenceIndex;
  thresholds?: ConfidenceThresholds;
  descriptor: { histogram: Float32Array; shape: Uint8Array; aspect: number };
  grey: Uint8Array;
}): RecognitionOutcome {
  const mat = cv.matFromArray(ORB_SIDE, ORB_SIDE, cv.CV_8UC1, grey);
  const orb = makeOrbDescriptor(cv, mat);
  const ranked = rankCandidates({
    cv,
    target: { descriptor, orb },
    references: referenceIndex.references,
    lshBuckets: referenceIndex.lshBuckets,
    retrieval: RETRIEVAL,
  });
  (orb as { delete: () => void }).delete();
  return classifyOutcome(ranked, thresholds);
}
