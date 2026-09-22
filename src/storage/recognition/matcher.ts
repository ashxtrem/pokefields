import { RETRIEVAL } from "./core/constants.mjs";
import { classifyOutcome, type ConfidenceThresholds } from "./core/confidence.mjs";
import { rankCandidates } from "./core/retrieval.mjs";
import { classifySlot, cropThumbnailBlob, extractAllSlotPixels, orbDescriptorForSlot } from "./slots";
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
 * Runs the full per-page pipeline: segment -> classify occupied/empty -> (occupied only) build
 * ORB + retrieve/rerank -> confidence policy. Shared by the worker (live scans) and any future
 * Node-side reuse, since it only takes plain data plus an injected `cv`.
 */
export async function recognizePage({
  cv,
  bitmap,
  background,
  referenceIndex,
  thresholds,
  onProgress,
  isCancelled,
}: {
  cv: unknown;
  bitmap: ImageBitmap;
  background: Uint8ClampedArray;
  referenceIndex: LoadedReferenceIndex;
  thresholds?: ConfidenceThresholds;
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}): Promise<SlotResult[]> {
  const slots = extractAllSlotPixels(bitmap);
  const classified = slots.map((entry) => classifySlot(entry, background));
  const results: SlotResult[] = [];
  let done = 0;
  for (const slot of classified) {
    if (isCancelled?.()) break;
    if (!slot.occupied || !slot.descriptor) {
      results.push({ slot: slot.slot, bounds: slot.bounds, outcome: null, thumbnail: null });
    } else {
      const [thumbnail, orb] = await Promise.all([
        cropThumbnailBlob(bitmap, slot.bounds),
        Promise.resolve(orbDescriptorForSlot(cv, bitmap, slot.bounds)),
      ]);
      const ranked = rankCandidates({
        cv,
        target: { descriptor: slot.descriptor, orb },
        references: referenceIndex.references,
        lshBuckets: referenceIndex.lshBuckets,
        retrieval: RETRIEVAL,
      });
      (orb as { delete: () => void }).delete();
      results.push({
        slot: slot.slot,
        bounds: slot.bounds,
        outcome: classifyOutcome(ranked, thresholds),
        thumbnail,
      });
    }
    done += 1;
    onProgress?.(done, classified.length);
  }
  return results;
}
