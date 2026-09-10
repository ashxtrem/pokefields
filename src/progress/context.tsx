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
import { ensureMigratedState } from "../habitats/migration";
import { migrateHousematePlan } from "../planner/recommend";
import {
  emptyState,
  readState,
  writeState,
  type SaveState,
} from "../persistence/store";
import { loadCraftingFields } from "../crafting/migration";
import { emptyCraftingState } from "../crafting/types";
import {
  migrateHouseChecklist,
  reconcileHouseQuantityList,
} from "../shopping/checklists";

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
  update: (fn: (s: SaveState) => SaveState) => void;
  updateWithUndo: (
    label: string,
    fn: (s: SaveState) => SaveState,
    fields?: UndoField[],
  ) => void;
  undo: () => UndoEntry | null;
  pendingUndo: UndoEntry | null;
  replaceNotebook: (next: SaveState) => void;
}

const Context = createContext<Progress | null>(null);

function normalizeLoadedState(state: SaveState, catalog: Catalog): SaveState {
  const migrated = ensureMigratedState(
    catalog,
    state.shoppingChecklists,
    state.habitatBuilds,
    state.shoppingLegacySnapshot,
  );
  let next: SaveState = {
    ...state,
    habitatBuilds: migrated.habitatBuilds || {},
    shoppingLegacySnapshot: migrated.shoppingLegacySnapshot,
    housematePlan: state.housematePlan
      ? migrateHousematePlan(state.housematePlan)
      : state.housematePlan,
  };
  if (next.houseShopping && !next.houseShopping.environment)
    next = { ...next, houseShopping: { ...next.houseShopping, environment: [] } };
  if (next.housematePlan && !next.houseShopping) {
    const fromLegacy = migrateHouseChecklist(
      state.shoppingChecklists?.house,
      next.housematePlan,
      catalog,
    );
    next = { ...next, houseShopping: fromLegacy };
  }
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

  const persist = (next: SaveState) => {
    ref.current = next;
    setState(next);
    setStatus("Saving…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => writeState(next))
      .then(() => {
        if (ref.current === next) {
          setStatus("Saved on this device");
          setError("");
        }
      })
      .catch(() => {
        setStatus("Not saved");
        setError(
          "Could not save. Export a backup now to preserve your changes.",
        );
      });
  };

  const update = (fn: (s: SaveState) => SaveState) => {
    if (!ready) return;
    persist(fn(ref.current));
  };

  const updateWithUndo = (
    label: string,
    fn: (s: SaveState) => SaveState,
    fields?: UndoField[],
  ) => {
    if (!ready) return;
    const before = structuredClone(ref.current);
    const next = fn(ref.current);
    const after: Partial<Pick<SaveState, UndoField>> = {};
    if (fields?.includes("crafting")) after.crafting = next.crafting;
    if (fields?.includes("materialCounts")) after.materialCounts = next.materialCounts;
    if (fields?.includes("collected")) after.collected = next.collected;
    undoStack.current = [
      { label, state: before, fields, after: fields ? after : undefined },
      ...undoStack.current,
    ].slice(0, 12);
    setPendingUndo(undoStack.current[0] || null);
    setUndoError("");
    persist(next);
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

export function useHouseShoppingUpdate() {
  const catalog = useCatalog();
  const { state, update } = useProgress();
  return (plan = state.housematePlan) => {
    if (!plan) return;
    update((saved) => ({
      ...saved,
      houseShopping: reconcileHouseQuantityList(
        saved.houseShopping || migrateHouseChecklist(saved.shoppingChecklists?.house, plan, catalog),
        plan,
        catalog,
      ),
    }));
  };
}
