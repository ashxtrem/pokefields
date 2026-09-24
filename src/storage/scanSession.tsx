import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStorage } from "./context";
import { decodeImage } from "./recognition/normalize";
import { terminateOcrWorker } from "./recognition/ocr";
import { prepareScanSlots, type PreparedSlot } from "./recognition/scanPrepare";
import { cancelScan, runMatchTasks } from "./recognition/scanWorkerPool";
import {
  newUid,
  type RecognitionOutcome,
  type StorageChest,
  type StorageItemRef,
} from "./types";

export type ScanPhase = "preparing" | "matching" | "stopped" | "ready" | "failed";

export type ScanDecision =
  | { kind: "accept"; ref: StorageItemRef }
  | { kind: "ignored" }
  | { kind: "unresolved" };

export interface ScanPage {
  page: number;
  file: File;
  hash: string;
}

export interface ScanRow {
  page: number;
  slot: number;
  thumbnail: Blob;
  outcome: RecognitionOutcome | null;
  decision: ScanDecision | null;
}

export interface ScanSession {
  id: string;
  chestId: string;
  chestName: string;
  phase: ScanPhase;
  reviewOpen: boolean;
  isCompleteAttempt: boolean;
  error: string;
  pages: ScanPage[];
  rows: ScanRow[];
  progress: { done: number; total: number };
}

export interface ScanToast {
  kind: "ready" | "stopped" | "failed" | "deleted";
  chestId?: string;
  message: string;
}

export function scanRowKey(page: number, slot: number) {
  return `${page}:${slot}`;
}

export function decisionForOutcome(outcome: RecognitionOutcome): ScanDecision {
  return outcome.status === "matched"
    ? { kind: "accept", ref: { kind: "catalog", itemId: outcome.itemId } }
    : { kind: "unresolved" };
}

export function rowNeedsMatch(row: ScanRow): boolean {
  if (!row.outcome) return true;
  return row.outcome.status === "unresolved" && row.decision?.kind === "unresolved";
}

export function rowsAfterStop(rows: ScanRow[]): ScanRow[] {
  return rows.filter((row) => row.outcome !== null);
}

export function retainRowsForCurrentPages(
  rows: ScanRow[],
  previousPages: ScanPage[],
  currentPages: ScanPage[],
): ScanRow[] {
  const oldHashByPage = new Map(previousPages.map((page) => [page.page, page.hash]));
  const currentHashByPage = new Map(currentPages.map((page) => [page.page, page.hash]));
  return rows.filter(
    (row) => oldHashByPage.get(row.page) === currentHashByPage.get(row.page),
  );
}

export function shouldShowScanToast(reviewOpen: boolean): boolean {
  return !reviewOpen;
}

interface ScanSessionContextValue {
  session: ScanSession | null;
  toast: ScanToast | null;
  hasRemaining: boolean;
  reviewRequest: number;
  startScan: (
    chest: StorageChest,
    pages: ScanPage[],
    isCompleteAttempt: boolean,
  ) => boolean;
  scanRemaining: () => void;
  stopScan: () => void;
  discardSession: () => void;
  finishSession: () => void;
  setReviewOpen: (open: boolean) => void;
  requestReview: (chestId: string) => void;
  setDecision: (key: string, decision: ScanDecision) => void;
  dismissToast: () => void;
}

const Context = createContext<ScanSessionContextValue | null>(null);

interface PreparedPage {
  hash: string;
  slots: PreparedSlot[];
}

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const { chests, ready } = useStorage();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [toast, setToast] = useState<ScanToast | null>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const sessionRef = useRef<ScanSession | null>(null);
  const preparedRef = useRef(new Map<number, PreparedPage>());
  const operationRef = useRef<{ id: string; stopped: boolean } | null>(null);

  const commitSession = useCallback(
    (update: ScanSession | null | ((current: ScanSession | null) => ScanSession | null)) => {
      const next = typeof update === "function" ? update(sessionRef.current) : update;
      sessionRef.current = next;
      setSession(next);
      return next;
    },
    [],
  );

  const clearSession = useCallback(() => {
    const active = operationRef.current;
    if (active) {
      active.stopped = true;
      cancelScan(active.id);
    }
    operationRef.current = null;
    preparedRef.current.clear();
    commitSession(null);
    terminateOcrWorker();
  }, [commitSession]);

  const run = useCallback(
    async (
      chest: StorageChest,
      pages: ScanPage[],
      isCompleteAttempt: boolean,
      existing: ScanSession | null,
    ) => {
      const scanId = newUid();
      const operation = { id: scanId, stopped: false };
      operationRef.current = operation;

      const currentHashByPage = new Map(pages.map((page) => [page.page, page.hash]));
      for (const [page, prepared] of preparedRef.current) {
        if (currentHashByPage.get(page) !== prepared.hash) preparedRef.current.delete(page);
      }

      const retainedRows = existing
        ? retainRowsForCurrentPages(existing.rows, existing.pages, pages)
        : [];
      const nextSession: ScanSession = {
        id: existing?.id ?? newUid(),
        chestId: chest.id,
        chestName: chest.name,
        phase: "preparing",
        reviewOpen: existing?.reviewOpen ?? true,
        isCompleteAttempt,
        error: "",
        pages,
        rows: retainedRows,
        progress: { done: 0, total: 0 },
      };
      commitSession(nextSession);
      setToast(null);

      try {
        const pagesToPrepare = pages.filter(
          (page) => preparedRef.current.get(page.page)?.hash !== page.hash,
        );
        if (pagesToPrepare.length > 0) {
          const bitmaps = await Promise.all(
            pagesToPrepare.map((page) => decodeImage(page.file)),
          );
          const prepared = await prepareScanSlots(
            pagesToPrepare.map((page, index) => ({
              page: page.page,
              bitmap: bitmaps[index]!,
            })),
          );
          for (const page of pagesToPrepare) {
            preparedRef.current.set(page.page, {
              hash: page.hash,
              slots: prepared.filter((slot) => slot.page === page.page),
            });
          }
        }

        if (operation.stopped) {
          operationRef.current = null;
          const stopped = commitSession((current) =>
            current
              ? {
                  ...current,
                  phase: "stopped",
                  rows: rowsAfterStop(current.rows),
                  progress: {
                    done: rowsAfterStop(current.rows).length,
                    total: rowsAfterStop(current.rows).length,
                  },
                }
              : null,
          );
          if (stopped && shouldShowScanToast(stopped.reviewOpen))
            setToast({
              kind: "stopped",
              chestId: stopped.chestId,
              message: `${stopped.chestName} scan stopped — ${stopped.rows.length} slots ready to review.`,
            });
          return;
        }

        const existingByKey = new Map(
          retainedRows.map((row) => [scanRowKey(row.page, row.slot), row]),
        );
        const rows = pages
          .flatMap((page) => preparedRef.current.get(page.page)?.slots ?? [])
          .filter(
            (slot): slot is PreparedSlot & { thumbnail: Blob } =>
              slot.occupied && Boolean(slot.thumbnail),
          )
          .map(
            (slot) =>
              existingByKey.get(scanRowKey(slot.page, slot.slot)) ?? {
                page: slot.page,
                slot: slot.slot,
                thumbnail: slot.thumbnail,
                outcome: null,
                decision: null,
              },
          )
          .sort((a, b) => a.page - b.page || a.slot - b.slot);

        const rowsToMatch = rows.filter(rowNeedsMatch);
        const initialDone = rows.length - rowsToMatch.length;
        commitSession((current) =>
          current
            ? {
                ...current,
                phase: rowsToMatch.length ? "matching" : "ready",
                rows,
                progress: { done: initialDone, total: rows.length },
              }
            : null,
        );

        if (rowsToMatch.length === 0) {
          operationRef.current = null;
          const current = sessionRef.current;
          if (current && shouldShowScanToast(current.reviewOpen))
            setToast({
              kind: "ready",
              chestId: current.chestId,
              message: `${current.chestName} is ready to review.`,
            });
          return;
        }

        const rowKeys = new Set(
          rowsToMatch.map((row) => scanRowKey(row.page, row.slot)),
        );
        const tasks = pages
          .flatMap((page) => preparedRef.current.get(page.page)?.slots ?? [])
          .filter(
            (slot) =>
              rowKeys.has(scanRowKey(slot.page, slot.slot)) &&
              slot.grey &&
              slot.descriptor,
          )
          .map((slot) => ({
            id: scanRowKey(slot.page, slot.slot),
            grey: new Uint8Array(slot.grey!),
            histogram: new Float32Array(slot.descriptor!.histogram),
            shape: new Uint8Array(slot.descriptor!.shape),
            aspect: slot.descriptor!.aspect,
          }));
        const streamed = new Set<string>();
        const result = await runMatchTasks(
          scanId,
          tasks,
          () => {},
          (id, outcome) => {
            if (operationRef.current !== operation || streamed.has(id)) return;
            streamed.add(id);
            commitSession((current) =>
              current
                ? {
                    ...current,
                    rows: current.rows.map((row) =>
                      scanRowKey(row.page, row.slot) === id && outcome
                        ? {
                            ...row,
                            outcome,
                            decision: row.decision ?? decisionForOutcome(outcome),
                          }
                        : row,
                    ),
                    progress: {
                      ...current.progress,
                      done: Math.min(
                        current.progress.total,
                        initialDone + streamed.size,
                      ),
                    },
                  }
                : null,
            );
          },
        );

        if (operationRef.current !== operation) return;
        operationRef.current = null;
        const stopped = operation.stopped || result.status === "cancelled";
        const finished = commitSession((current) =>
          current
            ? {
                ...current,
                phase: stopped ? "stopped" : "ready",
                rows: stopped ? rowsAfterStop(current.rows) : current.rows,
                progress: stopped
                  ? {
                      done: rowsAfterStop(current.rows).length,
                      total: rowsAfterStop(current.rows).length,
                    }
                  : { done: current.rows.length, total: current.rows.length },
              }
            : null,
        );
        if (finished && shouldShowScanToast(finished.reviewOpen)) {
          setToast(
            stopped
              ? {
                  kind: "stopped",
                  chestId: finished.chestId,
                  message: `${finished.chestName} scan stopped — ${finished.rows.length} slots ready to review.`,
                }
              : {
                  kind: "ready",
                  chestId: finished.chestId,
                  message: `${finished.chestName} is ready to review.`,
                },
          );
        }
      } catch (error) {
        if (operationRef.current !== operation) return;
        operationRef.current = null;
        const message =
          error instanceof Error
            ? error.message
            : "Recognition failed on this page.";
        const failed = commitSession((current) =>
          current ? { ...current, phase: "failed", error: message } : null,
        );
        if (failed && shouldShowScanToast(failed.reviewOpen))
          setToast({
            kind: "failed",
            chestId: failed.chestId,
            message: `${failed.chestName} could not be scanned.`,
          });
      }
    },
    [commitSession],
  );

  const startScan = useCallback(
    (chest: StorageChest, pages: ScanPage[], isCompleteAttempt: boolean) => {
      const current = sessionRef.current;
      if (
        current &&
        (current.chestId !== chest.id ||
          current.phase === "preparing" ||
          current.phase === "matching")
      )
        return false;
      void run(chest, pages, isCompleteAttempt, current);
      return true;
    },
    [run],
  );

  const scanRemaining = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.phase === "preparing" || current.phase === "matching")
      return;
    const chest = chests.find((candidate) => candidate.id === current.chestId);
    if (chest)
      void run(chest, current.pages, current.isCompleteAttempt, current);
  }, [chests, run]);

  const stopScan = useCallback(() => {
    const operation = operationRef.current;
    if (!operation) return;
    operation.stopped = true;
    cancelScan(operation.id);
  }, []);

  const setReviewOpen = useCallback(
    (open: boolean) => {
      const current = commitSession((value) =>
        value ? { ...value, reviewOpen: open } : null,
      );
      if (open && current)
        setToast((value) =>
          value?.chestId === current.chestId ? null : value,
        );
    },
    [commitSession],
  );

  const setDecision = useCallback(
    (key: string, decision: ScanDecision) => {
      commitSession((current) =>
        current
          ? {
              ...current,
              rows: current.rows.map((row) =>
                scanRowKey(row.page, row.slot) === key
                  ? { ...row, decision }
                  : row,
              ),
            }
          : null,
      );
    },
    [commitSession],
  );

  useEffect(() => {
    const current = sessionRef.current;
    if (!ready || !current) return;
    if (chests.some((chest) => chest.id === current.chestId)) return;
    clearSession();
    setToast({
      kind: "deleted",
      message: "Scan stopped. That chest was deleted.",
    });
  }, [chests, clearSession, ready]);

  const rowByKey = new Map(
    session?.rows.map((row) => [scanRowKey(row.page, row.slot), row]) ?? [],
  );
  const hasRemaining =
    session?.pages.some((page) =>
      (preparedRef.current.get(page.page)?.slots ?? []).some((slot) => {
        if (!slot.occupied) return false;
        const row = rowByKey.get(scanRowKey(slot.page, slot.slot));
        return !row || rowNeedsMatch(row);
      }),
    ) ?? false;

  return (
    <Context.Provider
      value={{
        session,
        toast,
        hasRemaining,
        reviewRequest,
        startScan,
        scanRemaining,
        stopScan,
        discardSession: clearSession,
        finishSession: clearSession,
        setReviewOpen,
        requestReview: (chestId) => {
          if (sessionRef.current?.chestId !== chestId) return;
          setReviewRequest((value) => value + 1);
          setToast((value) => (value?.chestId === chestId ? null : value));
        },
        setDecision,
        dismissToast: () => setToast(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useScanSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing scan session provider");
  return value;
}
