import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Hammer,
  House,
  Leaf,
  Download,
  Upload,
  TreePine,
} from "lucide-react";
import { useCatalog } from "./catalog/context";
import { useProgress } from "./progress/context";
import { DexPage, PokemonDetail } from "./dex/DexPage";
import { HabitatDetail } from "./habitats/HabitatDetail";
import { HabitatsPage } from "./habitats/HabitatsPage";
import { getCanonicalHabitat, listCanonicalHabitats } from "./habitats/catalog";
import { PlannerPage } from "./planner/PlannerPage";
import { CraftingPage } from "./crafting/CraftingPage";
import { listRecipes } from "./crafting/catalog";
import { unavailableLearned, visibleLearnedCount } from "./crafting/learned";
import { ChecklistFab, checklistScope } from "./shopping/ChecklistFab";
import { Modal } from "./ui/components";
import { validateBackup, type SaveState } from "./persistence/store";

import {
  isRememberedRouteAvailable,
  isUnmodifiedLeftClick,
  parseRoute,
  rememberSectionRoute,
  routeKey,
  sectionHref,
} from "./ui/navigation";

export default function App() {
  const [route, setRoute] = useState(location.hash || "#/dex");
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState<SaveState | null>(null);
  const [error, setError] = useState("");
  const catalog = useCatalog();
  const { state, status, error: saveError, ready, replaceNotebook, pendingUndo, undo, undoError } = useProgress();
  const file = useRef<HTMLInputElement>(null);
  const parsed = parseRoute(route);
  const habitatCount = listCanonicalHabitats(catalog).length;
  const recipeIds = useMemo(
    () => new Set(listRecipes(catalog).map((recipe) => recipe.id)),
    [catalog],
  );

  const scrollPositions = useRef(new Map<string, number>());
  const activeRoute = useRef(routeKey(route));
  const navigating = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const availableRoute = (candidate: string) =>
    isRememberedRouteAvailable(candidate, {
      hasPokemon: (id) => catalog.pokemon.some((p) => p.id === id),
      hasHabitat: (id) => Boolean(getCanonicalHabitat(catalog, id)),
      hasRecipe: (id) => recipeIds.has(id),
    });
  const [resumeHrefs, setResumeHrefs] = useState(() => ({
    dex: sectionHref("dex"),
    habitats: sectionHref("habitats"),
    planner: sectionHref("planner"),
    crafting: sectionHref("crafting"),
  }));

  useLayoutEffect(() => {
    rememberSectionRoute(route);
    setResumeHrefs({
      dex: sectionHref("dex", availableRoute),
      habitats: sectionHref("habitats", availableRoute),
      planner: sectionHref("planner", availableRoute),
      crafting: sectionHref("crafting", availableRoute),
    });
  }, [route, catalog]);

  useLayoutEffect(() => {
    if (!ready) return;
    const key = routeKey(route);
    activeRoute.current = key;
    navigating.current = true;
    window.scrollTo({
      top: scrollPositions.current.get(key) ?? 0,
      behavior: "instant",
    });
    const frame = requestAnimationFrame(() => {
      navigating.current = false;
    });
    const animation = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? undefined
      : contentRef.current?.animate([{ opacity: 0.65 }, { opacity: 1 }], {
          duration: 160,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        });
    return () => {
      cancelAnimationFrame(frame);
      animation?.cancel();
    };
  }, [routeKey(route), ready]);

  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const rememberScroll = () => {
      // Ignore native hash scrolling before React has committed the new page.
      if (
        !navigating.current &&
        routeKey(location.hash) === activeRoute.current
      )
        scrollPositions.current.set(activeRoute.current, window.scrollY);
    };
    const captureNavigation = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        'a[href^="#/"]',
      );
      if (!link || routeKey(link.hash) === activeRoute.current) return;
      scrollPositions.current.set(activeRoute.current, window.scrollY);
      navigating.current = true;
    };
    const fn = () => {
      setRoute(location.hash || "#/dex");
    };
    window.addEventListener("hashchange", fn);
    window.addEventListener("scroll", rememberScroll, { passive: true });
    document.addEventListener("click", captureNavigation, true);
    return () => {
      window.removeEventListener("hashchange", fn);
      window.removeEventListener("scroll", rememberScroll);
      document.removeEventListener("click", captureNavigation, true);
      history.scrollRestoration = previousRestoration;
    };
  }, []);

  const dexActive = parsed.page === "dex" || parsed.page === "pokemon";
  const habitatsActive =
    parsed.page === "habitats" || parsed.page === "habitat-detail";
  const plannerActive = parsed.page === "planner";
  const craftingActive =
    parsed.page === "crafting" || parsed.page === "crafting-recipe";
  const resumeSection = (
    event: {
      button: number;
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      preventDefault: () => void;
    },
    sectionActive: boolean,
  ) => {
    if (sectionActive && isUnmodifiedLeftClick(event)) event.preventDefault();
  };

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
      <header className="topbar">
        <a className="brand" href="#/dex">
          <span className="brand-icon">
            <Leaf size={20} />
          </span>
          <span className="brand-copy">
            pokopia<small>FIELDNOTES</small>
          </span>
        </a>
        <nav className="app-nav" aria-label="Primary">
          <a
            href={resumeHrefs.dex}
            className={dexActive ? "active" : ""}
            aria-current={dexActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, dexActive)}
          >
            <BookOpen size={16} />
            <span className="nav-label">Pokédex</span>
            <span className="nav-count">{catalog.pokemon.length}</span>
          </a>
          <a
            href={resumeHrefs.habitats}
            className={habitatsActive ? "active" : ""}
            aria-current={habitatsActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, habitatsActive)}
          >
            <TreePine size={16} />
            <span className="nav-label">Habitats</span>
            <span className="nav-count">{habitatCount}</span>
          </a>
          <a
            href={resumeHrefs.crafting}
            className={craftingActive ? "active" : ""}
            aria-current={craftingActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, craftingActive)}
          >
            <Hammer size={16} />
            <span className="nav-label">Crafting</span>
            <span className="nav-count">{recipeIds.size}</span>
          </a>
          <a
            href={resumeHrefs.planner}
            className={plannerActive ? "active" : ""}
            aria-current={plannerActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, plannerActive)}
          >
            <House size={16} />
            <span className="nav-label">Housemates</span>
          </a>
        </nav>
        <button
          className="notebook-button"
          onClick={() => setBackup(true)}
          title={`My notebook · ${status}`}
          aria-label={`My notebook · ${status}`}
        >
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
        {(undoError || pendingUndo) && (
          <div className="crafting-undo" role="status">
            {undoError ? (
              <span>{undoError}</span>
            ) : (
              <span>Undo {pendingUndo?.label}?</span>
            )}
            {pendingUndo ? (
              <button type="button" className="button secondary" onClick={() => undo()}>
                Undo
              </button>
            ) : null}
          </div>
        )}
        <div ref={contentRef} className="route-content">
          {!ready ? (
            <div className="loading">Opening your notebook…</div>
          ) : parsed.page === "planner" ? (
            <PlannerPage />
          ) : parsed.page === "crafting" || parsed.page === "crafting-recipe" ? (
            <CraftingPage route={parsed} />
          ) : parsed.page === "habitats" ? (
            <HabitatsPage />
          ) : parsed.page === "habitat-detail" ? (
            <HabitatDetail
              key={parsed.habitatId}
              habitatId={parsed.habitatId}
            />
          ) : parsed.page === "pokemon" ? (
            <PokemonDetail key={route} id={parsed.id} />
          ) : (
            <DexPage />
          )}
        </div>
        <footer>
          <span>
            <Leaf size={13} /> Every discovery makes this place a little more
            yours.
          </span>
          <span>Pokopia Fieldnotes · {catalog.version}</span>
        </footer>
      </main>
      <ChecklistFab scope={checklistScope(route)} />
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
            Your discoveries, habitat builds, housemate plan, crafting marks and
            any saved area layouts are stored in this browser. Export a backup to
            move them or keep a copy. Replacing this notebook includes learned
            recipe marks. Material quantity notes from older backups are kept
            unused so they are not dropped.
          </p>
          <div className="backup-stats">
            <strong>
              {Object.values(state.found).filter((a) => a.length).length}{" "}
              friends found
            </strong>
            <strong>
              {Object.keys(state.habitatBuilds || {}).length} habitat builds
            </strong>
            <strong>{state.housematePlan ? 1 : 0} housemate plan</strong>
            <strong>
              {visibleLearnedCount(
                state.crafting?.learnedRecipeIds || [],
                recipeIds,
              )}{" "}
              {visibleLearnedCount(
                state.crafting?.learnedRecipeIds || [],
                recipeIds,
              ) === 1
                ? "recipe marked learned"
                : "recipes marked learned"}
            </strong>
            <strong>
              {unavailableLearned(
                state.crafting?.learnedRecipeIds || [],
                recipeIds,
              ).length}{" "}
              unavailable crafting{" "}
              {unavailableLearned(
                state.crafting?.learnedRecipeIds || [],
                recipeIds,
              ).length === 1
                ? "record"
                : "records"}
            </strong>
            <strong>{Object.keys(state.plans).length} area layouts</strong>
          </div>
          {state.craftingQuarantine ? (
            <p className="notice" role="status">
              Unreadable crafting data was kept aside so the rest of this
              notebook could open: {state.craftingQuarantine.reason} It is
              included in exports until a later build can read it.
            </p>
          ) : null}
          {state.craftingLegacySnapshot ? (
            <p className="notice">
              An older crafting list is preserved in this notebook and will be
              included in exports.
            </p>
          ) : null}
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
                found Pokémon, {Object.keys(pending.habitatBuilds || {}).length}{" "}
                habitat builds, {pending.housematePlan ? 1 : 0} housemate plan,{" "}
                {visibleLearnedCount(
                  pending.crafting?.learnedRecipeIds || [],
                  recipeIds,
                )}{" "}
                learned recipes,{" "}
                {unavailableLearned(
                  pending.crafting?.learnedRecipeIds || [],
                  recipeIds,
                ).length}{" "}
                unavailable crafting records
                {pending.craftingQuarantine
                  ? ", plus unreadable crafting data kept aside"
                  : ""}{" "}
                and {Object.keys(pending.plans).length} area layouts. It will
                replace your current discoveries, plans and crafting marks.
              </p>
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => {
                    replaceNotebook(pending);
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
            Unknown details remain unfilled; game updates can change
            availability and requirements.
          </p>
          {catalog.sources
            .filter((s) => !/serebii\.net/i.test(s.url))
            .map((s) => (
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
