import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  emptyState,
  readState,
  writeState,
  type SaveState,
} from "../persistence/store";
interface Progress {
  state: SaveState;
  ready: boolean;
  status: string;
  error: string;
  update: (fn: (s: SaveState) => SaveState) => void;
}
const Context = createContext<Progress | null>(null);
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading your notebook…");
  const [error, setError] = useState("");
  const ref = useRef(state);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    readState()
      .then((s) => {
        ref.current = s;
        setState(s);
        setReady(true);
        setStatus("Saved on this device");
      })
      .catch(() => {
        setError(
          "Local storage could not be opened. Reload or enable browser storage before editing.",
        );
        setStatus("Storage unavailable");
      });
  }, []);
  const update = (fn: (s: SaveState) => SaveState) => {
    if (!ready) return;
    const next = fn(ref.current);
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
  return (
    <Context.Provider value={{ state, ready, status, error, update }}>
      {children}
    </Context.Provider>
  );
}
export function useProgress() {
  const c = useContext(Context);
  if (!c) throw Error("Missing progress provider");
  return c;
}
