import type { SaveState } from "../persistence/store";

function undoFieldLabel(field: UndoField) {
  if (field === "crafting") return "crafting";
  if (field === "collected") return "collected marks";
  if (field === "habitatLocations") return "habitat locations";
  return "material notes";
}

export type UndoField =
  | "crafting"
  | "materialCounts"
  | "collected"
  | "habitatLocations";

export interface ScopedUndoSnapshot {
  label: string;
  before: SaveState;
  fields: UndoField[];
  after: Partial<Pick<SaveState, UndoField>>;
}

export interface ProgressUndoEntry {
  label: string;
  state: SaveState;
  fields?: UndoField[];
  after?: Partial<Pick<SaveState, UndoField>>;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/** D-UNDO-01: restore only crafting fields; refuse if those fields changed later. */
export function applyScopedUndo(
  current: SaveState,
  snapshot: ScopedUndoSnapshot,
): { ok: true; next: SaveState } | { ok: false; reason: string } {
  for (const field of snapshot.fields) {
    if (!same(current[field], snapshot.after[field])) {
      return {
        ok: false,
        reason: `Cannot undo ${snapshot.label}: a later change to ${undoFieldLabel(field)} is in the way.`,
      };
    }
  }
  const next: SaveState = { ...current };
  for (const field of snapshot.fields) {
    if (field === "crafting") next.crafting = snapshot.before.crafting;
    if (field === "materialCounts") next.materialCounts = snapshot.before.materialCounts;
    if (field === "collected") next.collected = snapshot.before.collected;
    if (field === "habitatLocations")
      next.habitatLocations = snapshot.before.habitatLocations;
  }
  return { ok: true, next };
}

/** Leave the stack unchanged when a scoped undo is refused. */
export function applyUndoStack(
  stack: ProgressUndoEntry[],
  current: SaveState,
): {
  stack: ProgressUndoEntry[];
  current: SaveState;
  error: string;
  applied: ProgressUndoEntry | null;
} {
  const entry = stack[0];
  if (!entry) {
    return { stack, current, error: "", applied: null };
  }
  if (entry.fields?.length) {
    const result = applyScopedUndo(current, {
      label: entry.label,
      before: entry.state,
      fields: entry.fields,
      after: entry.after || {},
    });
    if (!result.ok) {
      return { stack, current, error: result.reason, applied: null };
    }
    return {
      stack: stack.slice(1),
      current: result.next,
      error: "",
      applied: entry,
    };
  }
  return {
    stack: stack.slice(1),
    current: entry.state,
    error: "",
    applied: entry,
  };
}
