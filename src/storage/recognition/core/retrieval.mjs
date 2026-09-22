// Candidate retrieval, union and reranking — extracted from the per-target loop in
// scripts/benchmark-native-storage-recognition.mjs's `main()` (lines ~519-573 before extraction).
//
// The benchmark precomputed `descriptorSimilarity` for every (target, reference) pair while
// references were still loading, purely as a batching optimization across its 30 targets sharing
// one reference set. `rankCandidates` computes the same histogram score lazily, once per target —
// mathematically identical output, just reordered, since the production app only ever ranks one
// target (one scanned slot) at a time against an already-built reference set.

import { descriptorSimilarity } from "./descriptor.mjs";
import { matchOrb } from "./orb.mjs";
import { voteLshBuckets } from "./lsh.mjs";

/**
 * @param cv the loaded @techstark/opencv-js module
 * @param target { descriptor, orb } for the scanned slot
 * @param references array of { id, descriptor, orb, ... } — index must match lshBuckets' indices
 * @param lshBuckets from core/lsh.mjs's createLshBuckets()/insertIntoLshBuckets()
 * @param retrieval { histogramCandidates, orbCandidates, histogramWeight } (see constants.RETRIEVAL)
 * @returns candidates sorted by descending combined score
 */
export function rankCandidates({ cv, target, references, lshBuckets, retrieval }) {
  const histogramScored = references.map((reference, referenceIndex) => ({
    referenceIndex,
    histogramScore: descriptorSimilarity(target.descriptor, reference.descriptor),
  }));
  const candidates = new Map(
    histogramScored
      .sort((left, right) => right.histogramScore - left.histogramScore)
      .slice(0, retrieval.histogramCandidates)
      .map((candidate) => [candidate.referenceIndex, candidate]),
  );

  const votes = voteLshBuckets(lshBuckets, target.orb, references.length);
  const orbCandidates = references
    .map((reference, referenceIndex) => ({
      referenceIndex,
      score: votes[referenceIndex] / Math.sqrt(reference.orb.rows || 1),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, retrieval.orbCandidates);
  for (const { referenceIndex } of orbCandidates) {
    if (!candidates.has(referenceIndex)) {
      candidates.set(referenceIndex, {
        referenceIndex,
        histogramScore: descriptorSimilarity(
          target.descriptor,
          references[referenceIndex].descriptor,
        ),
      });
    }
  }

  return [...candidates.values()]
    .map((candidate) => {
      const reference = references[candidate.referenceIndex];
      const orb = matchOrb(cv, target.orb, reference.orb);
      return {
        referenceIndex: candidate.referenceIndex,
        id: reference.id,
        histogramScore: candidate.histogramScore,
        ...orb,
        score: orb.orbScore + retrieval.histogramWeight * candidate.histogramScore,
      };
    })
    .sort((left, right) => right.score - left.score);
}
