import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  Package,
  House,
  Leaf,
  Download,
  Upload,
  Settings,
  TreePine,
  ExternalLink,
} from "lucide-react";
import { useCatalog } from "./catalog/context";
import { useProgress } from "./progress/context";
import { DexPage, PokemonDetail } from "./dex/DexPage";
import { HabitatDetail } from "./habitats/HabitatDetail";
import { HabitatsPage } from "./habitats/HabitatsPage";
import { getCanonicalHabitat, listCanonicalHabitats } from "./habitats/catalog";
import { PlannerPage } from "./planner/PlannerPage";
import { ItemsPage } from "./items/ItemsPage";
import { listRecipes } from "./crafting/catalog";
import { unavailableLearned, visibleLearnedCount } from "./crafting/learned";
import { unavailableCollected, visibleCollectedCount } from "./items/collected";
import { EnvLevelsModal, Modal } from "./ui/components";
import type { SaveState } from "./persistence/store";
import { ChestDetail, MissingChest } from "./storage/ChestDetail";
import { ChestForm } from "./storage/ChestForm";
import { StoragePage } from "./storage/StoragePage";
import { useStorage } from "./storage/context";
import { useScanSession } from "./storage/scanSession";
import { allImageRows } from "./storage/db";
import { buildBackupEnvelope, validateBackupEnvelope, type ParsedBackup } from "./storage/backup";
import { MAX_BACKUP_IMPORT_BYTES } from "./storage/constants";
import {
  openPrivacyPolicy,
  PRIVACY_POLICY_URL,
} from "./platform/externalLinks";
import { exportNotebookBackup } from "./platform/backupExport";

import {
  canonicalItemsHref,
  isRememberedRouteAvailable,
  isUnmodifiedLeftClick,
  parseRoute,
  rememberSectionRoute,
  routeKey,
  sectionHref,
} from "./ui/navigation";

function liveHash() {
  const hash = location.hash || "#/dex";
  const canonical = canonicalItemsHref(hash);
  if (canonical && canonical !== hash) {
    history.replaceState(null, "", canonical);
    return canonical;
  }
  return hash;
}

export default function App() {
  const [route, setRoute] = useState(liveHash);
  const [backup, setBackup] = useState(false);
  const [editingEnvLevels, setEditingEnvLevels] = useState(false);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [confirmingScanStop, setConfirmingScanStop] = useState(false);
  const catalog = useCatalog();
  const androidBuild = import.meta.env.VITE_DISTRIBUTION === "android";
  const { state, status, error: saveError, ready, replaceNotebook, pendingUndo, undo, undoError } = useProgress();
  const storageCtx = useStorage();
  const {
    session: scanSession,
    toast: scanToast,
    stopScan,
    dismissToast,
    requestReview,
  } = useScanSession();
  const { chests: storageChests, localItems: storageLocalItems, ready: storageReady } = storageCtx;
  const file = useRef<HTMLInputElement>(null);
  const parsed = parseRoute(route);
  const habitatCount = listCanonicalHabitats(catalog).length;
  const recipeIds = useMemo(
    () => new Set(listRecipes(catalog).map((recipe) => recipe.id)),
    [catalog],
  );
  const itemIds = useMemo(
    () => catalog.items.map((item) => item.id),
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
      hasItem: (id) => catalog.items.some((item) => item.id === id),
      hasChest: (id) => storageChests.some((chest) => chest.id === id),
    });
  const [resumeHrefs, setResumeHrefs] = useState(() => ({
    dex: sectionHref("dex"),
    habitats: sectionHref("habitats"),
    planner: sectionHref("planner"),
    items: sectionHref("items"),
    storage: sectionHref("storage"),
  }));

  useLayoutEffect(() => {
    rememberSectionRoute(route);
    setResumeHrefs({
      dex: sectionHref("dex", availableRoute),
      habitats: sectionHref("habitats", availableRoute),
      planner: sectionHref("planner", availableRoute),
      items: sectionHref("items", availableRoute),
      storage: sectionHref("storage", availableRoute),
    });
  }, [route, catalog, storageChests]);

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
      setRoute(liveHash());
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
  const itemsActive =
    parsed.page === "items" ||
    parsed.page === "items-recipe" ||
    parsed.page === "item-detail";
  const storageActive =
    parsed.page === "storage" || parsed.page === "storage-new" || parsed.page === "storage-chest";
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

  const exportFile = async () => {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const images = await allImageRows();
      const envelope = await buildBackupEnvelope(
        state,
        storageChests,
        storageLocalItems,
        images,
      );
      await exportNotebookBackup(JSON.stringify(envelope));
    } catch {
      setError(
        androidBuild
          ? "Could not export the backup. Try again or check that a sharing app is available."
          : "Could not export the backup. Try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/dex">
          <span className="brand-icon">
            <Leaf size={20} />
          </span>
          <span className="brand-copy">
            {androidBuild ? (
              "pokefields"
            ) : (
              <>
                pokopia<small>FIELDNOTES</small>
              </>
            )}
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
            href={resumeHrefs.items}
            className={itemsActive ? "active" : ""}
            aria-current={itemsActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, itemsActive)}
          >
            <Package size={16} />
            <span className="nav-label">Items</span>
            <span className="nav-count">{catalog.items.length}</span>
          </a>
          <a
            href={resumeHrefs.storage}
            className={storageActive ? "active" : ""}
            aria-current={storageActive ? "page" : undefined}
            onClick={(event) => resumeSection(event, storageActive)}
          >
            <Archive size={16} />
            <span className="nav-label">Storage</span>
            <span className="nav-count">{storageChests.length}</span>
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
          <Settings size={18} aria-hidden="true" />
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
        {scanSession &&
        (scanSession.phase === "preparing" || scanSession.phase === "matching") ? (
          <div className="storage-scan-shell-status" role="status" aria-live="polite">
            <button
              type="button"
              className="storage-scan-shell-open"
              onClick={() => {
                requestReview(scanSession.chestId);
                location.hash = `#/storage/${encodeURIComponent(scanSession.chestId)}`;
              }}
            >
              <strong>Scanning {scanSession.chestName}…</strong>
              <span>
                {scanSession.phase === "preparing"
                  ? "Reading the page"
                  : `${scanSession.progress.done} of ${scanSession.progress.total} slots`}
              </span>
            </button>
            <div
              className={`storage-scan-bar ${scanSession.phase === "preparing" ? "indeterminate" : ""}`}
              aria-hidden="true"
            >
              <span
                style={{
                  transform:
                    scanSession.phase === "preparing"
                      ? undefined
                      : `scaleX(${scanSession.progress.total ? scanSession.progress.done / scanSession.progress.total : 0})`,
                }}
              />
            </div>
            <button type="button" className="text-button" onClick={() => setConfirmingScanStop(true)}>
              Cancel
            </button>
          </div>
        ) : null}
        {scanToast ? (
          <div className="storage-scan-toast" role="status">
            {scanToast.chestId ? (
              <button
                type="button"
                className="storage-scan-toast-open"
                onClick={() => {
                  requestReview(scanToast.chestId!);
                  location.hash = `#/storage/${encodeURIComponent(scanToast.chestId!)}`;
                }}
              >
                {scanToast.message}
              </button>
            ) : (
              <span>{scanToast.message}</span>
            )}
            <button type="button" className="text-button" onClick={dismissToast}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div ref={contentRef} className="route-content">
          {!ready ? (
            <div className="loading">Opening your notebook…</div>
          ) : parsed.page === "planner" ? (
            <PlannerPage />
          ) : parsed.page === "items" ||
            parsed.page === "items-recipe" ||
            parsed.page === "item-detail" ? (
            <ItemsPage route={parsed} />
          ) : parsed.page === "storage" ? (
            <StoragePage route={parsed} />
          ) : parsed.page === "storage-new" ? (
            <ChestForm mode="create" />
          ) : parsed.page === "storage-chest" ? (
            !storageReady ? (
              <div className="loading">Opening this chest…</div>
            ) : storageChests.some((chest) => chest.id === parsed.chestId) ? (
              <ChestDetail key={parsed.chestId} chestId={parsed.chestId} />
            ) : (
              <MissingChest />
            )
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
          <span>
            {`${androidBuild ? "pokefields" : "Pokopia Fieldnotes"} · ${catalog.version}`}
          </span>
        </footer>
      </main>
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
            Your discoveries, saved habitat locations, housemate plan, crafting
            marks, collectible marks and any saved area layouts are stored in
            this browser. Export a backup to move them or keep a copy.
            Replacing this notebook includes learned recipe marks and
            collected items. Material quantity notes from older backups are
            kept unused so they are not dropped.
          </p>
          <div className="backup-stats">
            <strong>
              {Object.values(state.found).filter((a) => a.length).length}{" "}
              friends found
            </strong>
            <strong>
              {Object.keys(state.habitatLocations || {}).length} saved habitat
              locations
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
            <strong>
              {visibleCollectedCount(state.collected, itemIds)}{" "}
              {visibleCollectedCount(state.collected, itemIds) === 1
                ? "collectible marked"
                : "collectibles marked"}
            </strong>
            <strong>
              {unavailableCollected(state.collected, itemIds).length}{" "}
              unavailable collected{" "}
              {unavailableCollected(state.collected, itemIds).length === 1
                ? "record"
                : "records"}
            </strong>
            <strong>{Object.keys(state.plans).length} area layouts</strong>
            <strong>
              {storageChests.length} storage chest{storageChests.length === 1 ? "" : "s"}
            </strong>
            <strong>
              {storageLocalItems.length} local item{storageLocalItems.length === 1 ? "" : "s"}
            </strong>
          </div>
          <div className="button-row notebook-actions">
            <button
              className="button secondary"
              onClick={() => setEditingEnvLevels(true)}
            >
              Town environment levels
            </button>
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
          {state.habitatBuildLegacySnapshot || state.houseShoppingLegacySnapshot ? (
            <p className="notice">
              Old build-planning data is preserved in this notebook and
              included in exports, but is no longer shown.
            </p>
          ) : null}
          <div className="button-row notebook-actions">
            <button
              className="button"
              onClick={exportFile}
              disabled={exporting}
              aria-busy={exporting}
            >
              <Download size={17} />
              {exporting ? "Preparing backup…" : "Export backup"}
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
                if (f.size > MAX_BACKUP_IMPORT_BYTES)
                  throw Error(
                    `Backup exceeds the ${(MAX_BACKUP_IMPORT_BYTES / (1024 * 1024)).toFixed(0)} MB limit.`,
                  );
                setPending(validateBackupEnvelope(JSON.parse(await f.text()), catalog));
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
                {Object.values(pending.state.found).filter((a) => a.length).length}{" "}
                found Pokémon,{" "}
                {Object.keys(pending.state.habitatLocations || {}).length}{" "}
                saved habitat locations, {pending.state.housematePlan ? 1 : 0}{" "}
                housemate plan,{" "}
                {visibleLearnedCount(
                  pending.state.crafting?.learnedRecipeIds || [],
                  recipeIds,
                )}{" "}
                learned recipes,{" "}
                {unavailableLearned(
                  pending.state.crafting?.learnedRecipeIds || [],
                  recipeIds,
                ).length}{" "}
                unavailable crafting records,{" "}
                {visibleCollectedCount(pending.state.collected, itemIds)} collected
                items,{" "}
                {unavailableCollected(pending.state.collected, itemIds).length}{" "}
                unavailable collected records
                {pending.state.craftingQuarantine
                  ? ", plus unreadable crafting data kept aside"
                  : ""}{" "}
                and {Object.keys(pending.state.plans).length} area layouts.{" "}
                {pending.storage
                  ? `It also contains ${pending.storage.chests.length} storage chest${pending.storage.chests.length === 1 ? "" : "s"}, ${pending.storage.localItems.length} local item${pending.storage.localItems.length === 1 ? "" : "s"} and ${pending.storage.images.length} image${pending.storage.images.length === 1 ? "" : "s"}, which will replace your current Storage data.`
                  : "This backup has no Storage data — your current chests and local items will be kept as they are."}{" "}
                It will replace your current discoveries, plans, crafting marks and
                collected marks.
              </p>
              <div className="button-row">
                <button
                  className="button"
                  onClick={async () => {
                    replaceNotebook(pending.state);
                    if (pending.storage)
                      await storageCtx.replaceAllData(
                        pending.storage.chests,
                        pending.storage.localItems,
                        pending.storage.images,
                      );
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
          <h3>About &amp; Legal</h3>
          <p className="legal-action">
            <a
              className="legal-link"
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault();
                void openPrivacyPolicy().catch(() =>
                  setError("Could not open the privacy policy."),
                );
              }}
            >
              Privacy policy <ExternalLink size={14} aria-hidden="true" />
            </a>
          </p>
          <p className="muted">
            Opens the public pokefields privacy policy in your browser.
          </p>
          <hr />
          <h3>About the reference data</h3>
          <p className="muted">
            Unknown details remain unfilled; game updates can change
            availability and requirements.
          </p>
          {import.meta.env.VITE_DISTRIBUTION === "web" && catalog.sources
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
      {editingEnvLevels && (
        <EnvLevelsModal onClose={() => setEditingEnvLevels(false)} />
      )}
      {confirmingScanStop ? (
        <Modal title="Stop this scan?" onClose={() => setConfirmingScanStop(false)}>
          <p>
            Stopping keeps the slots already identified in this review. Slots still loading will be
            dropped. Nothing is saved to this chest until you accept.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => {
                setConfirmingScanStop(false);
                stopScan();
              }}
            >
              Stop scan
            </button>
            <button type="button" className="button secondary" onClick={() => setConfirmingScanStop(false)}>
              Keep scanning
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
