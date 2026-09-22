import { useMemo, useState } from "react";
import { useCatalog } from "../catalog/context";
import { ItemThumb, Modal } from "../ui/components";
import { useStorage } from "./context";
import { ItemPicker } from "./ItemPicker";
import type { SlotResult } from "./recognition/matcher";
import { storePreparedImage } from "./images";
import { resolveItemRefName } from "./search";
import { newUid, type LocalStorageItem, type StorageChest, type StorageItemRef, type UnresolvedSlot } from "./types";

type Decision =
  | { kind: "accept"; ref: StorageItemRef }
  | { kind: "ignored" }
  | { kind: "unresolved" };

interface ReviewRow {
  key: string;
  page: number;
  slot: number;
  outcome: SlotResult["outcome"];
  thumbnail: Blob | null;
  decision: Decision;
}

function rowKey(page: number, slot: number) {
  return `${page}:${slot}`;
}

export function ScanReview({
  chest,
  pageResults,
  isCompleteAttempt,
  onDone,
  onBack,
}: {
  chest: StorageChest;
  pageResults: Array<{ page: number; slots: SlotResult[] }>;
  isCompleteAttempt: boolean;
  onDone: () => void;
  onBack: () => void;
}) {
  const catalog = useCatalog();
  const { localItems, acceptPartialScan, acceptCompleteScan } = useStorage();
  const scannedPages = pageResults.map((p) => p.page);
  const unscannedPages = Array.from({ length: chest.type === "big-storage-box" ? 3 : 1 }, (_, i) => i + 1).filter(
    (page) => !scannedPages.includes(page),
  );

  const [rows, setRows] = useState<ReviewRow[]>(() =>
    pageResults.flatMap(({ page, slots }) =>
      slots
        .filter((slot) => slot.outcome !== null)
        .map((slot) => ({
          key: rowKey(page, slot.slot),
          page,
          slot: slot.slot,
          outcome: slot.outcome,
          thumbnail: slot.thumbnail,
          decision:
            slot.outcome!.status === "matched"
              ? ({ kind: "accept", ref: { kind: "catalog", itemId: slot.outcome!.itemId } } as Decision)
              : ({ kind: "unresolved" } as Decision),
        })),
    ),
  );
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameFor = (ref: StorageItemRef) => resolveItemRefName(ref, catalog, localItems as LocalStorageItem[]);

  const setDecision = (key: string, decision: Decision) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, decision } : row)));

  const unresolvedCount = rows.filter((row) => row.decision.kind === "unresolved").length;

  const save = async (asComplete: boolean) => {
    setSaving(true);
    setError("");
    try {
      const acceptedRefs: StorageItemRef[] = [];
      const unresolvedSlots: UnresolvedSlot[] = [];
      for (const row of rows) {
        if (row.decision.kind === "accept") acceptedRefs.push(row.decision.ref);
        else if (row.decision.kind === "unresolved" && row.thumbnail) {
          const image = await storePreparedImage(
            row.thumbnail,
            chest.id,
            "unresolved-slot",
            "image/webp",
            92,
            92,
          );
          unresolvedSlots.push({ id: newUid(), imageId: image.id, page: row.page, slot: row.slot });
        }
      }
      if (asComplete) await acceptCompleteScan(chest.id, acceptedRefs, unresolvedSlots);
      else await acceptPartialScan(chest.id, acceptedRefs, unresolvedSlots);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "This scan could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const thumbnailUrl = useMemo(() => {
    const urls = new Map<string, string>();
    for (const row of rows) if (row.thumbnail) urls.set(row.key, URL.createObjectURL(row.thumbnail));
    return urls;
  }, [rows]);

  return (
    <Modal title="Review scan results" onClose={onBack} sheet wide>
      <p className="muted">
        {rows.length} occupied slot{rows.length === 1 ? "" : "s"} found across {pageResults.length} page
        {pageResults.length === 1 ? "" : "s"}. Nothing is saved to this chest until you accept below —
        the total below counts unique recorded items, not the number of slots processed.
      </p>
      {unscannedPages.length > 0 ? (
        <p className="notice">
          Page{unscannedPages.length === 1 ? "" : "s"} {unscannedPages.join(", ")} {unscannedPages.length === 1 ? "was" : "were"} not
          scanned this time — their previously recorded items will be kept either way.
        </p>
      ) : null}
      <ul className="storage-review-list">
        {rows.map((row) => (
          <li key={row.key} className="storage-review-row">
            {thumbnailUrl.get(row.key) ? (
              <img
                className="storage-review-thumb"
                src={thumbnailUrl.get(row.key)}
                alt={`Page ${row.page}, slot ${row.slot}`}
              />
            ) : null}
            <div className="storage-review-body">
              <p className="muted">
                Page {row.page} · slot {row.slot}
              </p>
              {row.decision.kind === "accept" ? (
                <div className="storage-review-proposed">
                  {row.decision.ref.kind === "catalog" ? (
                    <ItemThumb id={row.decision.ref.itemId} name={nameFor(row.decision.ref)} />
                  ) : null}
                  <strong>{nameFor(row.decision.ref)}</strong>
                  {row.outcome?.status === "matched" ? (
                    <span className="muted">
                      score {row.outcome.score.toFixed(2)} · margin {row.outcome.margin.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ) : row.decision.kind === "ignored" ? (
                <p className="muted">Ignored — will not be recorded.</p>
              ) : (
                <p className="muted">
                  Unresolved{row.outcome?.status === "unresolved" ? ` (${row.outcome.reason})` : ""} — kept for
                  later review unless you identify or ignore it now.
                </p>
              )}
              {replacingKey === row.key ? (
                <ItemPicker
                  onPick={(ref) => {
                    setDecision(row.key, { kind: "accept", ref });
                    setReplacingKey(null);
                  }}
                  onCancel={() => setReplacingKey(null)}
                />
              ) : (
                <div className="button-row">
                  <button type="button" className="button secondary" onClick={() => setReplacingKey(row.key)}>
                    {row.decision.kind === "accept" ? "Replace" : "Identify"}
                  </button>
                  {row.decision.kind !== "unresolved" && row.outcome?.status === "unresolved" ? (
                    <button type="button" className="text-button" onClick={() => setDecision(row.key, { kind: "unresolved" })}>
                      Mark unresolved
                    </button>
                  ) : null}
                  {row.decision.kind !== "ignored" ? (
                    <button type="button" className="text-button" onClick={() => setDecision(row.key, { kind: "ignored" })}>
                      Ignore
                    </button>
                  ) : (
                    <button type="button" className="text-button" onClick={() => setDecision(row.key, { kind: "unresolved" })}>
                      Undo ignore
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {unresolvedCount > 0 ? (
        <p className="muted">
          {unresolvedCount} slot{unresolvedCount === 1 ? "" : "s"} will be kept as unidentified items you
          can review later from the chest page.
        </p>
      ) : null}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="button" disabled={saving} onClick={() => save(false)}>
          {saving ? "Saving…" : "Merge with existing contents"}
        </button>
        {isCompleteAttempt ? (
          <button type="button" className="button secondary" disabled={saving} onClick={() => setConfirmingComplete(true)}>
            Replace all contents instead
          </button>
        ) : null}
        <button type="button" className="button secondary" onClick={onBack}>
          Back to pages
        </button>
        <button type="button" className="text-button" onClick={onDone}>
          Cancel without changing this chest
        </button>
      </div>
      {confirmingComplete ? (
        <Modal title="Replace all recorded contents?" onClose={() => setConfirmingComplete(false)}>
          <p>
            This replaces every item currently recorded in "{chest.name}" with what this scan found. This
            can be undone right after saving, from the notice at the top of the app.
          </p>
          <div className="button-row">
            <button type="button" className="button" onClick={() => save(true)}>
              Replace all contents
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmingComplete(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}
