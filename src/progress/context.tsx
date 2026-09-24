import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Catalog } from "../catalog/types";
import { useCatalog } from "../catalog/context";
import { migrateHabitatLocations } from "../habitats/migration";
import { migrateHousematePlan } from "../planner/recommend";
import {
  emptyState,
  readState,
  writeState,
  type SaveState,
} from "../persistence/store";
import { loadCraftingFields } from "../crafting/migration";
import { emptyCraftingState } from "../crafting/types";

export type { UndoField } from "../crafting/undo";
import { applyUndoStack, type UndoField } from "../crafting/undo";

interface UndoEntry {
  label: string;
  state: SaveState;
  fields?: UndoField[];
  after?: Partial<Pick<SaveState, UndoField>>;
}

interface Progress {
  state: SaveState;
  ready: boolean;
  status: string;
  error: string;
  undoError: string;
  update: (fn: (s: SaveState) => SaveState) => Promise<boolean>;
  updateWithUndo: (
    label: string,
    fn: (s: SaveState) => SaveState,
    fields?: UndoField[],
  ) => Promise<boolean>;
  undo: () => UndoEntry | null;
  pendingUndo: UndoEntry | null;
  replaceNotebook: (next: SaveState) => void;
}

const Context = createContext<Progress | null>(null);

function normalizeLoadedState(state: SaveState, catalog: Catalog): SaveState {
  let next: SaveState = migrateHabitatLocations(state, catalog);
  next = {
    ...next,
    housematePlan: next.housematePlan
      ? migrateHousematePlan(next.housematePlan)
      : next.housematePlan,
  };
  next = {
    ...next,
    ...loadCraftingFields(next, catalog),
  };
  return next;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading your notebook…");
  const [error, setError] = useState("");
  const [undoError, setUndoError] = useState("");
  const [pendingUndo, setPendingUndo] = useState<UndoEntry | null>(null);
  const ref = useRef(state);
  const queue = useRef(Promise.resolve());
  const undoStack = useRef<UndoEntry[]>([]);

  useEffect(() => {
    readState()
      .then((s) => {
        const normalized = normalizeLoadedState(s, catalog);
        ref.current = normalized;
        setState(normalized);
        setReady(true);
        setStatus("Saved on this device");
        if (normalized !== s) {
          queue.current = queue.current
            .catch(() => {})
            .then(() => writeState(normalized));
        }
      })
      .catch(() => {
        setError(
          "Local storage could not be opened. Reload or enable browser storage before editing.",
        );
        setStatus("Storage unavailable");
      });
  }, [catalog.version]);

  const persist = (next: SaveState): Promise<boolean> => {
    ref.current = next;
    setState(next);
    setStatus("Saving…");
    const attempt = queue.current
      .catch(() => {})
      .then(() => writeState(next));
    queue.current = attempt.catch(() => {});
    return attempt
      .then(() => {
        if (ref.current === next) {
          setStatus("Saved on this device");
          setError("");
        }
        return true;
      })
      .catch(() => {
        setStatus("Not saved");
        setError(
          "Could not save. Export a backup now to preserve your changes.",
        );
        return false;
      });
  };

  const update = (fn: (s: SaveState) => SaveState): Promise<boolean> => {
    if (!ready) return Promise.resolve(false);
    return persist(fn(ref.current));
  };

  const updateWithUndo = (
    label: string,
    fn: (s: SaveState) => SaveState,
    fields?: UndoField[],
  ): Promise<boolean> => {
    if (!ready) return Promise.resolve(false);
    const before = structuredClone(ref.current);
    const next = fn(ref.current);
    const after: Partial<Pick<SaveState, UndoField>> = {};
    if (fields?.includes("crafting")) after.crafting = next.crafting;
    if (fields?.includes("materialCounts"))
      after.materialCounts = next.materialCounts;
    if (fields?.includes("collected")) after.collected = next.collected;
    if (fields?.includes("habitatLocations"))
      after.habitatLocations = next.habitatLocations;
    undoStack.current = [
      { label, state: before, fields, after: fields ? after : undefined },
      ...undoStack.current,
    ].slice(0, 12);
    setPendingUndo(undoStack.current[0] || null);
    setUndoError("");
    return persist(next);
  };

  const undo = () => {
    const result = applyUndoStack(undoStack.current, ref.current);
    undoStack.current = result.stack;
    setPendingUndo(undoStack.current[0] || null);
    if (result.error) {
      setUndoError(result.error);
      return null;
    }
    if (result.applied) persist(result.current);
    setUndoError("");
    return result.applied;
  };

  const replaceNotebook = (next: SaveState) => {
    if (!ready) return;
    undoStack.current = [];
    setPendingUndo(null);
    setUndoError("");
    persist({
      ...next,
      crafting: next.crafting || emptyCraftingState(),
    });
  };

  return (
    <Context.Provider
      value={{
        state,
        ready,
        status,
        error,
        undoError,
        update,
        updateWithUndo,
        undo,
        pendingUndo,
        replaceNotebook,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useProgress() {
  const c = useContext(Context);
  if (!c) throw Error("Missing progress provider");
  return c;
}
