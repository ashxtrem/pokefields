import type { RecognitionOutcome } from "../types";

export interface MatchTask {
  id: string;
  grey: Uint8Array;
  histogram: Float32Array;
  shape: Uint8Array;
  aspect: number;
}

export interface MatchTaskResult {
  id: string;
  outcome: RecognitionOutcome | null;
}

export type ScanWorkerRequest =
  | { type: "matchSlots"; scanId: string; tasks: MatchTask[] }
  | { type: "cancel"; scanId: string };

export type ScanWorkerResponse =
  | { type: "error"; scanId?: string; message: string }
  | { type: "progress"; scanId: string; done: number; total: number }
  | { type: "result"; scanId: string; results: MatchTaskResult[] }
  | { type: "cancelled"; scanId: string };
