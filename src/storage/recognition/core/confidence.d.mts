import type { RankedCandidate } from "./retrieval";

export interface ConfidenceThresholds {
  minimumScore: number;
  minimumMargin: number;
}

export type RecognitionOutcome =
  | {
      status: "matched";
      itemId: string;
      score: number;
      margin: number;
      source: "visual" | "ocr" | "combined";
    }
  | {
      status: "unresolved";
      candidates: Array<{ itemId: string; score: number }>;
      reason: "low-score" | "ambiguous" | "missing-reference" | "poor-image" | "no-item";
    };

export function classifyOutcome(
  ranked: RankedCandidate[],
  thresholds?: ConfidenceThresholds,
): RecognitionOutcome;
