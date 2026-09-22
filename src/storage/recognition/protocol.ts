import type { SlotResult } from "./matcher";

export type ScanWorkerRequest =
  | { type: "init" }
  | { type: "scan"; scanId: string; pages: Array<{ page: number; bitmap: ImageBitmap }> }
  | { type: "cancel"; scanId: string };

export type ScanWorkerResponse =
  | { type: "ready" }
  | { type: "error"; scanId?: string; message: string }
  | { type: "progress"; scanId: string; done: number; total: number }
  | { type: "result"; scanId: string; pages: Array<{ page: number; slots: SlotResult[] }> }
  | { type: "cancelled"; scanId: string };
