import { useMemo, useState } from "react";
import { useCatalog } from "../catalog/context";
import { ItemThumb, Modal } from "../ui/components";
import { useStorage } from "./context";
import { ItemPicker } from "./ItemPicker";
import { storePreparedImage } from "./images";
import {
  scanRowKey,
  useScanSession,
  type ScanSession,
} from "./scanSession";
import { resolveItemRefName } from "./search";
import { newUid, type LocalStorageItem, type StorageChest, type StorageItemRef, type UnresolvedSlot } from "./types";

export function ScanReview({
  chest,
  session,
  onDone,
  onBack,
}: {
  chest: StorageChest;
  session: ScanSession;
  onDone: () => void;
  onBack: () => void;
}) {
  const catalog = useCatalog();
  const { localItems, acceptPartialScan, acceptCompleteScan } = useStorage();
  const {
    hasRemaining,
    scanRemaining,
    stopScan,
    finishSession,
    setDecision,
  } = useScanSession();
  const scannedPages = session.pages.map((p) => p.page);
  const unscannedPages = Array.from({ length: chest.type === "big-storage-box" ? 3 : 1 }, (_, i) => i + 1).filter(
    (page) => !scannedPages.includes(page),
  );

  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameFor = (ref: StorageItemRef) => resolveItemRefName(ref, catalog, localItems as LocalStorageItem[]);

  /** Quantity is the player's own optional tracking number — see StorageItemRef.quantity. */
  const setAcceptedQuantity = (key: string, raw: string) => {
    const row = session.rows.find((candidate) => scanRowKey(candidate.page, candidate.slot) === key);
    if (row?.decision?.kind !== "accept") return;
    const parsed = Number(raw.trim());
    const quantity = raw.trim() && Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
    setDecision(key, { kind: "accept", ref: { ...row.decision.ref, quantity } });
  };

  const unresolvedCount = session.rows.filter((row) => row.decision?.kind === "unresolved").length;
  const running = session.phase === "preparing" || session.phase === "matching";

  const save = async (asComplete: boolean) => {
    setSaving(true);
    setError("");
    try {
      const acceptedRefs: StorageItemRef[] = [];
      const unresolvedSlots: UnresolvedSlot[] = [];
      for (const row of session.rows) {
        if (row.decision?.kind === "accept") acceptedRefs.push(row.decision.ref);
        else if (row.decision?.kind === "unresolved" && row.thumbnail) {
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
      finishSession();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "This scan could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const thumbnailUrl = useMemo(() => {
    const urls = new Map<string, string>();
    for (const row of session.rows)
      if (row.thumbnail)
        urls.set(scanRowKey(row.page, row.slot), URL.createObjectURL(row.thumbnail));
    return urls;
  }, [session.rows]);

  return (
    <Modal title="Review scan results" onClose={onBack} sheet wide>
      <div className="storage-scan-review-status" aria-live="polite">
        <div className="storage-scan-status-copy">
          <strong>
            {session.phase === "preparing"
              ? "Reading the page…"
              : session.phase === "matching"
                ? `${session.progress.done} of ${session.progress.total} slots`
                : session.phase === "stopped"
                  ? "Scan stopped"
                  : session.phase === "failed"
                    ? "Scan failed"
                    : "Ready to review"}
          </strong>
          {running ? (
            <button
              type="button"
              className="text-button"
              onClick={() => setConfirmingStop(true)}
            >
              Cancel
            </button>
          ) : null}
        </div>
        <div
          className={`storage-scan-bar ${session.phase === "preparing" ? "indeterminate" : ""}`}
          aria-hidden="true"
        >
          <span
            style={{
              transform:
                session.phase === "preparing"
                  ? undefined
                  : `scaleX(${session.progress.total ? session.progress.done / session.progress.total : 0})`,
            }}
          />
        </div>
      </div>
      <p className="muted">
        {session.rows.length} occupied slot{session.rows.length === 1 ? "" : "s"} found across {session.pages.length} page
        {session.pages.length === 1 ? "" : "s"}. Nothing is saved to this chest until you accept below —
        the total below counts unique recorded items, not the number of slots processed.
      </p>
      {unscannedPages.length > 0 ? (
        <p className="notice">
          Page{unscannedPages.length === 1 ? "" : "s"} {unscannedPages.join(", ")} {unscannedPages.length === 1 ? "was" : "were"} not
          scanned this time — their previously recorded items will be kept either way.
        </p>
      ) : null}
      <ul className="storage-review-list">
        {session.rows.map((row) => {
          const key = scanRowKey(row.page, row.slot);
          return (
          <li key={key} className={`storage-review-row ${row.outcome ? "resolved" : "loading"}`}>
            {thumbnailUrl.get(key) ? (
              <img
                className="storage-review-thumb"
                src={thumbnailUrl.get(key)}
                alt={`Page ${row.page}, slot ${row.slot}`}
              />
            ) : null}
            <div className="storage-review-body">
              <p className="muted">
                Page {row.page} · slot {row.slot}
              </p>
              {!row.outcome || !row.decision ? (
                <p className="muted storage-review-loading">Identifying item…</p>
              ) : row.decision.kind === "accept" ? (
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
                  <label className="storage-review-quantity">
                    <span className="muted">Qty</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="storage-item-quantity"
                      value={row.decision.ref.quantity ?? ""}
                      onChange={(event) => setAcceptedQuantity(key, event.target.value)}
                      aria-label={`Quantity for ${nameFor(row.decision.ref)} (optional)`}
                      placeholder="—"
                    />
                  </label>
                </div>
              ) : row.decision.kind === "ignored" ? (
                <p className="muted">Ignored — will not be recorded.</p>
              ) : (
                <p className="muted">
                  Unresolved{row.outcome?.status === "unresolved" ? ` (${row.outcome.reason})` : ""} — kept for
                  later review unless you identify or ignore it now.
                </p>
              )}
              {row.outcome && replacingKey === key ? (
                <ItemPicker
                  onPick={(ref) => {
                    setDecision(key, { kind: "accept", ref });
                    setReplacingKey(null);
                  }}
                  onCancel={() => setReplacingKey(null)}
                />
              ) : row.outcome && row.decision ? (
                <div className="button-row">
                  <button type="button" className="button secondary" onClick={() => setReplacingKey(key)}>
                    {row.decision.kind === "accept" ? "Replace" : "Identify"}
                  </button>
                  {row.decision.kind !== "unresolved" && row.outcome?.status === "unresolved" ? (
                    <button type="button" className="text-button" onClick={() => setDecision(key, { kind: "unresolved" })}>
                      Mark unresolved
                    </button>
                  ) : null}
                  {row.decision.kind !== "ignored" ? (
                    <button type="button" className="text-button" onClick={() => setDecision(key, { kind: "ignored" })}>
                      Ignore
                    </button>
                  ) : (
                    <button type="button" className="text-button" onClick={() => setDecision(key, { kind: "unresolved" })}>
                      Undo ignore
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </li>
          );
        })}
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
        <button type="button" className="button" disabled={saving || running} onClick={() => save(false)}>
          {saving ? "Saving…" : "Merge with existing contents"}
        </button>
        {session.isCompleteAttempt ? (
          <button type="button" className="button secondary" disabled={saving || running} onClick={() => setConfirmingComplete(true)}>
            Replace all contents instead
          </button>
        ) : null}
        {!running && hasRemaining ? (
          <button type="button" className="button secondary" onClick={scanRemaining}>
            Scan remaining
          </button>
        ) : null}
        <button type="button" className="button secondary" onClick={onBack}>
          Back to pages
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            session.rows.some((row) => row.outcome)
              ? setConfirmingDiscard(true)
              : onDone()
          }
        >
          Cancel without changing this chest
        </button>
      </div>
      {confirmingStop ? (
        <Modal title="Stop this scan?" onClose={() => setConfirmingStop(false)}>
          <p>
            Stopping keeps the slots already identified in this review. Slots still loading will be
            dropped. Nothing is saved to this chest until you accept.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => {
                setConfirmingStop(false);
                stopScan();
              }}
            >
              Stop scan
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmingStop(false)}>
              Keep scanning
            </button>
          </div>
        </Modal>
      ) : null}
      {confirmingDiscard ? (
        <Modal title="Cancel without changing this chest?" onClose={() => setConfirmingDiscard(false)}>
          <p>This drops this review and its identified slots. Nothing will be saved to this chest.</p>
          <div className="button-row">
            <button type="button" className="button" onClick={onDone}>
              Discard review
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmingDiscard(false)}>
              Keep review
            </button>
          </div>
        </Modal>
      ) : null}
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
