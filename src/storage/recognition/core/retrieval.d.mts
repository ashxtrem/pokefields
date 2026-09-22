import type { Descriptor } from "./descriptor";
import type { LshBuckets } from "./lsh";
import type { RetrievalConfig } from "./constants";

export interface ReferenceEntry {
  id: string;
  descriptor: Descriptor;
  orb: unknown;
}

export interface RankedCandidate {
  referenceIndex: number;
  id: string;
  histogramScore: number;
  goodMatches: number;
  averageDistance: number | null;
  orbScore: number;
  score: number;
}

export function rankCandidates(args: {
  cv: unknown;
  target: { descriptor: Descriptor; orb: unknown };
  references: ReferenceEntry[];
  lshBuckets: LshBuckets;
  retrieval: RetrievalConfig;
}): RankedCandidate[];
