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
import {
  migrateHouseChecklist,
  reconcileHouseQuantityList,
} from "../shopping/checklists";

interface UndoEntry {
  label: string;
  state: SaveState;
}

interface Progress {
  state: SaveState;
  ready: boolean;
  status: string;
  error: string;
  update: (fn: (s: SaveState) => SaveState) => void;
  updateWithUndo: (label: string, fn: (s: SaveState) => SaveState) => void;
  undo: () => UndoEntry | null;
  pendingUndo: UndoEntry | null;
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
  return next;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading your notebook…");
  const [error, setError] = useState("");
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

  const updateWithUndo = (label: string, fn: (s: SaveState) => SaveState) => {
    if (!ready) return;
    undoStack.current = [
      { label, state: structuredClone(ref.current) },
      ...undoStack.current,
    ].slice(0, 12);
    setPendingUndo({ label, state: structuredClone(ref.current) });
    persist(fn(ref.current));
  };

  const undo = () => {
    const entry = undoStack.current.shift() || null;
    if (entry) {
      persist(entry.state);
      setPendingUndo(undoStack.current[0] || null);
    }
    return entry;
  };

  return (
    <Context.Provider
      value={{ state, ready, status, error, update, updateWithUndo, undo, pendingUndo }}
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
