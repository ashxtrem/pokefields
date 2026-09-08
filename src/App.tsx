import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  House,
  Leaf,
  Download,
  Upload,
  HardDrive,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { useCatalog } from "./catalog/context";
import { useProgress } from "./progress/context";
import { DexPage, PokemonDetail } from "./dex/DexPage";
import { PlannerPage } from "./planner/PlannerPage";
import { Modal } from "./ui/components";
import { validateBackup, type SaveState } from "./persistence/store";
export default function App() {
  const [route, setRoute] = useState(location.hash || "#/dex");
  const [menu, setMenu] = useState(false);
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState<SaveState | null>(null);
  const [error, setError] = useState("");
  const catalog = useCatalog();
  const { state, update, status, error: saveError, ready } = useProgress();
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = () => {
      setRoute(location.hash || "#/dex");
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const planner = route.startsWith("#/planner");
  const exportFile = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokopia-fieldnotes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#/dex">
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          <span>
            pokopia<small>FIELDNOTES</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="sidebar-label">YOUR COMPANION</div>
        <nav>
          <a href="#/dex" className={!planner ? "active" : ""}>
            <BookOpen size={19} />
            Pokédex<span>{catalog.pokemon.length}</span>
          </a>
          <a href="#/planner" className={planner ? "active" : ""}>
            <House size={19} />
            Housemates<span className="nav-new">NEW</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="note-flower">✳</span>
          <h3>
            A world worth
            <br />
            growing together.
          </h3>
          <p>
            A few new friends.
            <br />A little more room to grow.
          </p>
          <a href="#/planner">
            Plan homes for your Pokémon <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setBackup(true)}>
            <HardDrive size={17} />
            Your notebook
          </button>
          <span className="saved-dot" /> <small>{status}</small>
          <p>
            An unofficial fan companion.
            <br />
            Made for little discoveries.
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Your fieldnotes <span>/</span>{" "}
            <strong>{planner ? "Housemates" : "Pokédex"}</strong>
          </div>
          <button className="notebook-button" onClick={() => setBackup(true)}>
            <span className="saved-dot" />
            <span>My notebook</span>
            <span className="avatar">YOU</span>
          </button>
        </header>
        <main>
          {saveError && (
            <div className="notice error" role="alert">
              {saveError}
            </div>
          )}
          {!ready ? (
            <div className="loading">Opening your notebook…</div>
          ) : planner ? (
            <PlannerPage />
          ) : route.startsWith("#/pokemon/") ? (
            <PokemonDetail
              key={route}
              id={decodeURIComponent(route.slice(10))}
            />
          ) : (
            <DexPage />
          )}
          <footer>
            <span>
              <Leaf size={13} /> Every discovery makes this place a little more
              yours.
            </span>
            <span>Pokopia Fieldnotes · {catalog.version}</span>
          </footer>
        </main>
      </div>
      {backup && (
        <Modal
          title="Your notebook"
          onClose={() => {
            setBackup(false);
            setPending(null);
            setError("");
          }}
        >
          <p>
            Your discoveries, housemate plan and any saved area layouts are
            stored in this browser. Export a backup to move them or keep a copy.
          </p>
          <div className="backup-stats">
            <strong>
              {Object.values(state.found).filter((a) => a.length).length}{" "}
              friends found
            </strong>
            <strong>{state.housematePlan ? 1 : 0} housemate plan</strong>
            <strong>{Object.keys(state.plans).length} area layouts</strong>
          </div>
          <div className="button-row">
            <button className="button" onClick={exportFile}>
              <Download size={17} />
              Export backup
            </button>
            <button
              className="button secondary"
              onClick={() => file.current?.click()}
            >
              <Upload size={17} />
              Import backup
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 5e6) throw Error("Backup exceeds the 5 MB limit.");
                setPending(validateBackup(JSON.parse(await f.text()), catalog));
                setError("");
              } catch (err) {
                setPending(null);
                setError(
                  err instanceof Error ? err.message : "Could not read backup",
                );
              }
            }}
          />
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {pending && (
            <div className="notice">
              <strong>Replace this device's notebook?</strong>
              <p>
                This backup contains{" "}
                {Object.values(pending.found).filter((a) => a.length).length}{" "}
                found Pokémon, {pending.housematePlan ? 1 : 0} housemate plan
                and {Object.keys(pending.plans).length} area layouts. It will
                replace your current discoveries and plans.
              </p>
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => {
                    update(() => pending);
                    setPending(null);
                    setBackup(false);
                  }}
                >
                  Replace notebook
                </button>
                <button
                  className="button secondary"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <hr />
          <h3>About the reference data</h3>
          <p className="muted">
            Sources are linked on entries. Unknown details remain unfilled; game
            updates can change availability and requirements.
          </p>
          {catalog.sources.map((s) => (
            <p key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name} ↗
              </a>
            </p>
          ))}
          <small className="muted">
            Pokémon and game artwork belong to their respective owners. This fan
            project is not affiliated with Nintendo or The Pokémon Company.
          </small>
        </Modal>
      )}
    </div>
  );
}
