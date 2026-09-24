import { useViewState } from "../ui/navigation";
import { HomeDetail } from "./HomeDetail";
import { useMemo, useRef, useState } from "react";
import {
  House,
  Users,
  Search,
  Pencil,
  Plus,
  Sun,
  Moon,
  CloudRain,
  Thermometer,
  Snowflake,
  Droplets,
} from "lucide-react";
import { useCatalog } from "../catalog/context";
import { plannableKitMap, plannableKits } from "../catalog/types";
import { useProgress } from "../progress/context";
import { itemEnvLock, recordedEnvLevel, type TermRef } from "../dex/glossary";
import { furnishings } from "./engine";
import {
  addHome,
  setHomeCompleted,
  changeHomeKit,
  combinedSupplies,
  convertSpatialPlan,
  effectiveMaxResidents,
  eligibleKits,
  environmentSupplies,
  estimateHomeCount,
  explainGroup,
  homeEnvironment,
  moveResident,
  planIsStale,
  preferenceLabel,
  recommendHousemates,
  uniqueFoundRoster,
} from "./recommend";
import type {
  HousematePlan,
  HousematePlanSettings,
  RecommendedHome,
} from "./types";
import {
  EnvLevelsModal,
  EnvLockNote,
  ExplainDialog,
  Empty,
  ItemButton,
  ItemThumb,
  Modal,
  Portrait,
  TermChip,
} from "../ui/components";

const PRESETS: {
  id: string;
  label: string;
  settings: HousematePlanSettings;
}[] = [
  {
    id: "1",
    label: "Own space (1)",
    settings: { maxResidents: 1, affinityFloor: false },
  },
  {
    id: "2",
    label: "Pairs (2)",
    settings: { maxResidents: 2, affinityFloor: false },
  },
  {
    id: "balanced",
    label: "Balanced (auto)",
    settings: { maxResidents: 4, affinityFloor: true },
  },
  {
    id: "4",
    label: "Full houses (4)",
    settings: { maxResidents: 4, affinityFloor: false },
  },
];
const DEFAULT_PRESET_ID = "4";

function environmentGroupKey(
  home: RecommendedHome,
  catalog: ReturnType<typeof useCatalog>,
) {
  return homeEnvironment(home, catalog);
}

export function PlannerPage() {
  const catalog = useCatalog();
  const { state, update, ready } = useProgress();
  const [area, setArea] = useViewState("planner.area", "");
  const [search, setSearch] = useViewState("planner.search", "");
  const [excluded, setExcluded] = useViewState<string[]>(
    "planner.excluded",
    [],
  );
  const [unhousedOnly, setUnhousedOnly] = useViewState(
    "planner.unhousedOnly",
    false,
  );
  const [density, setDensity] = useViewState<"detailed" | "compact">(
    "planner.density",
    "detailed",
  );
  const [error, setError] = useState("");
  const [selected, setSelected] = useViewState("planner.selected", "");
  const [detailTab, setDetailTab] = useViewState(
    "planner.detailTab",
    "Residents",
  );
  const [draft, setDraft] = useViewState<HousematePlan | null>(
    "planner.draft",
    null,
  );
  const [convertArea, setConvertArea] = useViewState("planner.convertArea", "");
  const [changeHomeId, setChangeHomeId] = useState("");
  const [presetId, setPresetId] = useViewState(
    "planner.preset",
    DEFAULT_PRESET_ID,
  );
  const [editingKits, setEditingKits] = useState(false);
  const [editingEnvLevels, setEditingEnvLevels] = useState(false);
  const [addingHome, setAddingHome] = useState(false);
  const [term, setTerm] = useState<TermRef | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const foundIds = uniqueFoundRoster(state.found, area || null);
  const saved = state.housematePlan || null;
  const [editingSetup, setEditingSetup] = useViewState(
    "planner.editingSetup",
    () => !saved,
  );
  const view = draft || saved;
  const active = view?.homes.find((h) => h.id === selected);
  const availableKitIds = state.availableKitIds ?? null;
  const envLevels = state.envLevels;
  const preset =
    PRESETS.find((p) => p.id === presetId) || PRESETS[PRESETS.length - 1];

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foundIds
      .map((id) => catalog.pokemon.find((p) => p.id === id)!)
      .filter(
        (p) =>
          p &&
          (!q ||
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.number.toLowerCase().includes(q)),
      );
  }, [foundIds, catalog, search]);
  const housedIds = useMemo(
    () => new Set(saved?.homes.flatMap((h) => h.residents) ?? []),
    [saved],
  );
  const visibleRoster = unhousedOnly
    ? available.filter((p) => !housedIds.has(p.id))
    : available;
  const environmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of available) {
      const key = p.environment || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [available]);
  const roster = foundIds.filter((id) => !excluded.includes(id));
  const stale = saved ? planIsStale(saved, state.found, catalog) : false;
  const legacyAreas = Object.keys(state.plans).sort();
  const estimate = estimateHomeCount(
    roster,
    catalog,
    preset.settings,
    availableKitIds,
  );
  const effectiveCap = effectiveMaxResidents(
    preset.settings,
    catalog,
    availableKitIds,
  );
  const save = (next: HousematePlan) =>
    update((s) => ({ ...s, housematePlan: next }));
  const persistView = (next: HousematePlan) => {
    if (draft) setDraft(next);
    else save(next);
  };
  const generate = () => {
    setError("");
    if (!roster.length) {
      setError("Select at least one found Pokémon, or open the Pokédex first.");
      return;
    }
    const next = recommendHousemates(
      {
        roster,
        sourceRoster: foundIds,
        areaFilter: area || null,
      },
      catalog,
      undefined,
      { settings: preset.settings, availableKitIds },
    );
    if (saved) {
      setDraft(next);
      setSelected("");
    } else {
      save(next);
      setSelected("");
    }
    setEditingSetup(false);
    requestAnimationFrame(() =>
      workspaceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };
  const supplies = view ? combinedSupplies(view, catalog, envLevels) : null;
  const environmentGuidanceRows = view
    ? environmentSupplies(view, catalog, envLevels)
    : [];
  const changing = view?.homes.find((h) => h.id === changeHomeId);
  const housedCount = view
    ? view.homes.reduce((s, h) => s + h.residents.length, 0)
    : 0;
  const groupedHomes = useMemo(() => {
    if (!view) return [];
    const groups = new Map<string, RecommendedHome[]>();
    for (const home of view.homes) {
      const key =
        environmentGroupKey(home, catalog) ||
        (home.residents.length ? "Mixed or unrecorded" : "Empty");
      const list = groups.get(key) || [];
      list.push(home);
      groups.set(key, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [view, catalog]);
  const showSetup = !view || editingSetup;

  return (
    <>
      <div className="planner-title">
        <div>
          <h1>
            Plan homes for your Pokémon<span className="dot">.</span>
          </h1>
          <p>
            Choose who should live together, then see what to build or gather
            for them.
          </p>
        </div>
      </div>
      {!foundIds.length && !area && !view ? (
        <Empty title="No found Pokémon yet">
          Mark Pokémon as found in the Pokédex, then return here to suggest
          housemates. <a href="#/dex">Open Pokédex →</a>
        </Empty>
      ) : (
        <div className={`planner-layout ${showSetup ? "" : "collapsed"}`}>
          {showSetup ? (
            <aside className="planner-setup">
              <div className="setup-heading">
                <Users size={19} />
                <h2>Select Pokémon</h2>
              </div>
              <label className="field">
                <span>Area filter</span>
                <select
                  aria-label="Area filter"
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setExcluded([]);
                    setError("");
                  }}
                >
                  <option value="">All areas with found Pokémon</option>
                  {catalog.areas.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <small>
                  Filters discovery records. It does not assert where a Pokémon
                  can live.
                </small>
              </label>
              <label className="field">
                <span>Search</span>
                <span className="search-box roster-search">
                  <Search size={16} />
                  <input
                    aria-label="Search found Pokémon"
                    placeholder="Name or number"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </span>
              </label>
              <div className="field">
                <span>
                  Selected <small>{roster.length}</small>
                </span>
                <div className="roster-toolbar">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setExcluded((x) =>
                        x.filter(
                          (id) => !visibleRoster.some((p) => p.id === id),
                        ),
                      )
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setExcluded((x) => [
                        ...new Set([...x, ...visibleRoster.map((p) => p.id)]),
                      ])
                    }
                  >
                    Select none
                  </button>
                  <label className="unhoused-filter">
                    <input
                      type="checkbox"
                      checked={unhousedOnly}
                      onChange={(e) => setUnhousedOnly(e.target.checked)}
                    />
                    Not yet housed
                  </label>
                </div>
                {!!environmentCounts.length && (
                  <p className="muted roster-env-counts">
                    {environmentCounts
                      .map(([env, count]) => `${env} ${count}`)
                      .join(" · ")}
                  </p>
                )}
                {visibleRoster.length ? (
                  <div className="roster-options">
                    {visibleRoster.map((p) => (
                      <label
                        key={p.id}
                        className={excluded.includes(p.id) ? "excluded" : ""}
                      >
                        <input
                          type="checkbox"
                          checked={!excluded.includes(p.id)}
                          onChange={() =>
                            setExcluded((x) =>
                              x.includes(p.id)
                                ? x.filter((i) => i !== p.id)
                                : [...x, p.id],
                            )
                          }
                        />
                        <Portrait pokemon={p} small />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    {unhousedOnly
                      ? "Every found Pokémon matching this filter already has a home."
                      : area
                        ? "No found Pokémon match this area filter."
                        : "No found Pokémon match this search."}{" "}
                    <a href="#/dex">Open Pokédex →</a>
                  </p>
                )}
              </div>
              <div className="field">
                <span>Household size</span>
                <div className="preset-options">
                  {PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={presetId === p.id ? "chip active" : "chip"}
                      onClick={() => setPresetId(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <small>
                  {preset.settings.affinityFloor
                    ? "Balanced stops a group early rather than filling a bed with a resident sharing no favorite category."
                    : "The cap is an upper bound; a smaller group stays smaller."}{" "}
                  {effectiveCap < preset.settings.maxResidents
                    ? `Effective cap is ${effectiveCap}: your available kits don't support ${preset.settings.maxResidents}.`
                    : ""}
                </small>
                <p className="home-estimate">
                  → about {estimate} {estimate === 1 ? "home" : "homes"}
                </p>
              </div>
              <div className="field">
                <span>Available kits</span>
                <small>
                  Limit suggestions to kits you have actually unlocked. Defaults
                  to every kit in the catalog.
                </small>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditingKits(true)}
                >
                  {availableKitIds
                    ? `${availableKitIds.length} of ${plannableKits(catalog.kits).length} kits selected`
                    : `All ${plannableKits(catalog.kits).length} kits available`}
                </button>
              </div>
              <div className="field">
                <span>Town levels</span>
                <small>
                  Set the environment level you have actually reached in each
                  town. Furnishing suggestions flag items above your level.
                </small>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditingEnvLevels(true)}
                >
                  {area
                    ? `${area} Lv. ${recordedEnvLevel(area, state.envLevels)}`
                    : "Set town levels"}
                </button>
              </div>
              {!!legacyAreas.length && (
                <div className="field">
                  <span>Existing layout</span>
                  <small>
                    Saved map layouts are kept. Convert residents and home
                    choices once; the original stays.
                  </small>
                  <select
                    aria-label="Convert existing plan"
                    value={convertArea}
                    onChange={(e) => setConvertArea(e.target.value)}
                  >
                    <option value="">Choose an area layout</option>
                    {legacyAreas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <button
                    className="button secondary"
                    disabled={!convertArea || !ready}
                    onClick={() => {
                      const spatial = state.plans[convertArea];
                      if (!spatial) return;
                      const next = convertSpatialPlan(spatial, catalog);
                      if (saved) setDraft(next);
                      else save(next);
                      setConvertArea("");
                    }}
                  >
                    Convert residents
                  </button>
                </div>
              )}
              <button
                className="button full"
                disabled={!ready || !roster.length}
                onClick={generate}
              >
                Suggest housemates
              </button>
              {saved && (
                <small className="muted">
                  Generating again keeps this plan until you apply the new
                  suggestions.
                </small>
              )}
              {view && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditingSetup(false)}
                >
                  Hide setup
                </button>
              )}
            </aside>
          ) : (
            <div className="planner-setup-summary">
              <div>
                <strong>{view!.roster.length} selected</strong>
                <span> · {view!.areaFilter || "All found Pokémon"}</span>
                <span> · {preset.label}</span>
              </div>
              <div className="setup-summary-actions">
                <button
                  type="button"
                  className="chip env-level-chip"
                  onClick={() => setEditingEnvLevels(true)}
                  title="Set town environment levels"
                >
                  {view!.areaFilter || "Withered Wastelands"} Lv.{" "}
                  {recordedEnvLevel(
                    view!.areaFilter || "Withered Wastelands",
                    state.envLevels,
                  )}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditingSetup(true)}
                >
                  <Pencil size={14} /> Edit selection
                </button>
              </div>
            </div>
          )}
          <section className="planner-workspace" ref={workspaceRef}>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            {stale && saved && !draft && (
              <div className="notice">
                Your discoveries or catalog have changed. This saved plan is
                preserved, including edits. Review it or apply new suggestions
                when ready.
              </div>
            )}
            {draft && saved && (
              <div className="notice">
                <strong>Replacement suggestions are ready.</strong>
                <p>The saved plan is unchanged until you apply this preview.</p>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() => {
                      save(draft);
                      setDraft(null);
                      setSelected("");
                    }}
                  >
                    Apply suggestions
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setDraft(null);
                      setSelected("");
                    }}
                  >
                    Keep saved plan
                  </button>
                </div>
              </div>
            )}
            {view ? (
              <>
                <div className="canvas-heading">
                  <div>
                    <span className="planner-scope">
                      {view.areaFilter || "All found Pokémon"}
                      {draft ? " · preview" : ""}
                    </span>
                    <h2>
                      {view.homes.length}{" "}
                      {view.homes.length === 1 ? "home" : "homes"}
                    </h2>
                  </div>
                  {!draft && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setAddingHome(true)}
                    >
                      <Plus size={15} /> Add a home
                    </button>
                  )}
                </div>
                <div className="result-summary-strip">
                  <div>
                    <strong>{view.homes.length}</strong>
                    <span>{view.homes.length === 1 ? "home" : "homes"}</span>
                  </div>
                  <div>
                    <strong>{housedCount}</strong>
                    <span>assigned</span>
                  </div>
                  <div>
                    <strong>{view.unresolved.length}</strong>
                    <span>needs review</span>
                  </div>
                  <div>
                    <strong>
                      {view.homes.filter((home) => home.completed).length}
                    </strong>
                    <span>built & moved in</span>
                  </div>
                </div>
                <p className="muted card-disclaimer">
                  Suggested for capacity, not confirmed affordability or unlock
                  availability.
                </p>
                <div className="housemate-toolbar">
                  <p id="home-completion-help">
                    Check a home once it is built and its Pokémon have moved in.
                    Changing residents or the home clears its check.
                  </p>
                  <div
                    className="housemate-density"
                    role="group"
                    aria-label="Card detail"
                  >
                    {(["detailed", "compact"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={density === mode}
                        onClick={() => setDensity(mode)}
                      >
                        {mode === "detailed" ? "Detailed" : "Compact"}
                      </button>
                    ))}
                  </div>
                </div>
                {groupedHomes.map(([groupKey, homes]) => (
                  <section className="home-group" key={groupKey}>
                    <h3 className="home-group-heading">{groupKey}</h3>
                    <div className="home-list housemate-cards">
                      {homes.map((home) => (
                        <HomeCard
                          key={home.id}
                          home={home}
                          preview={!!draft}
                          compact={density === "compact"}
                          onComplete={(completed) =>
                            persistView(
                              setHomeCompleted(view, home.id, completed),
                            )
                          }
                          onOpen={(tab) => {
                            setDetailTab(tab);
                            setSelected(home.id);
                          }}
                          onChangeHome={() => setChangeHomeId(home.id)}
                          onExplain={setTerm}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                {!!view.unresolved.length && (
                  <div className="notice">
                    <strong>Needs review</strong>
                    <p>
                      These Pokémon are still selected. They were not dropped;
                      no supported home fit the group.
                    </p>
                    {view.unresolved.map((r) => {
                      const p = catalog.pokemon.find((x) => x.id === r.id);
                      return (
                        <div className="unresolved-row" key={r.id}>
                          {p && <Portrait pokemon={p} small />}
                          <div>
                            <strong>{p?.name || r.id}</strong>
                            <p>{r.reason}</p>
                          </div>
                          {!!view.homes.length && !draft && saved && (
                            <label>
                              Move into
                              <select
                                aria-label={`Move ${p?.name || r.id} into a home`}
                                defaultValue=""
                                onChange={(e) => {
                                  const to = e.target.value;
                                  e.currentTarget.value = "";
                                  if (!to) return;
                                  try {
                                    save(
                                      moveResident(
                                        saved,
                                        "unresolved",
                                        to,
                                        r.id,
                                        catalog,
                                      ),
                                    );
                                    setError("");
                                  } catch (err) {
                                    setError((err as Error).message);
                                  }
                                }}
                              >
                                <option value="">Choose a home</option>
                                <option value="new">New group</option>
                                {view.homes.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {plannableKitMap(catalog.kits).get(h.kitId)
                                      ?.name || h.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {supplies && (
                  <details className="supplies">
                    <summary>
                      What these homes need{" "}
                      <span>
                        {supplies.construction.length +
                          supplies.furnishings.length +
                          environmentGuidanceRows.length}{" "}
                        listed
                      </span>
                    </summary>
                    <p className="muted">
                      Reference only. Construction totals, furnishing
                      suggestions and environment guidance remain separate.
                      Food and care are not shopping progress.
                    </p>
                    <h3>Required materials</h3>
                    {supplies.construction.length ? (
                      <HouseQuantityPreview
                        rows={supplies.construction}
                        onExplain={setTerm}
                        context="home"
                      />
                    ) : (
                      <p className="notice">
                        Construction quantities are not recorded for the
                        suggested homes.
                      </p>
                    )}
                    <h3>Suggested furnishings</h3>
                    {supplies.furnishings.length ? (
                      <HouseQuantityPreview
                        rows={supplies.furnishings}
                        onExplain={setTerm}
                      />
                    ) : (
                      <p className="notice">
                        No furnishing suggestions for the current groups.
                      </p>
                    )}
                    <h3>Environment guidance</h3>
                    <p className="muted">
                      App guidance for producing each home's recorded ideal
                      environment, not a recorded requirement.
                    </p>
                    {environmentGuidanceRows.length ? (
                      <HouseQuantityPreview
                        rows={environmentGuidanceRows}
                        onExplain={setTerm}
                      />
                    ) : (
                      <p className="notice">
                        No home currently has one shared recorded environment.
                      </p>
                    )}
                  </details>
                )}
              </>
            ) : (
              <div className="planner-empty">
                <div className="empty-plot" aria-hidden="true">
                  <House size={46} />
                </div>
                <span className="eyebrow">WHO LIVES TOGETHER?</span>
                <h2>
                  Select Pokémon,
                  <br />
                  then suggest housemates.
                </h2>
                <p>
                  Groups use recorded environments and shared favorite
                  categories. Homes are suggested for capacity, not cost or
                  unlocks.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      {active && view && (
        <HomeDetail
          key={active.id}
          home={active}
          plan={view}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelected("")}
          onSave={persistView}
        />
      )}
      {changing && view && (
        <ChangeHomeModal
          home={changing}
          plan={view}
          availableKitIds={availableKitIds}
          onClose={() => setChangeHomeId("")}
          onSave={(next) => {
            persistView(next);
            setChangeHomeId("");
          }}
        />
      )}
      {editingKits && (
        <AvailableKitsModal
          selected={availableKitIds}
          onClose={() => setEditingKits(false)}
          onSave={(next) => {
            update((s) => ({ ...s, availableKitIds: next }));
            setEditingKits(false);
          }}
        />
      )}
      {addingHome && view && (
        <AddHomeModal
          availableKitIds={availableKitIds}
          onClose={() => setAddingHome(false)}
          onSave={(next) => {
            persistView(next);
            setAddingHome(false);
          }}
          plan={view}
        />
      )}
      {editingEnvLevels && (
        <EnvLevelsModal
          highlightArea={area || view?.areaFilter || "Withered Wastelands"}
          onClose={() => setEditingEnvLevels(false)}
        />
      )}
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </>
  );
}

function HouseQuantityPreview({
  rows,
  onExplain,
  context,
}: {
  rows: { name: string; quantity: number }[];
  onExplain: (term: TermRef) => void;
  /** Set for build materials so the popup explains what the total is for. */
  context?: TermRef["context"];
}) {
  const catalog = useCatalog();
  const { state } = useProgress();
  const envLevels = state.envLevels;
  return (
    <ul className="supply-list checklist-rows">
      {rows.map((row) => {
        const item = catalog.items.find((entry) => entry.name === row.name);
        const lock =
          context === "home" ? null : itemEnvLock(item || {}, envLevels);
        return (
          <li key={row.name + row.quantity}>
            <span className="supply-item-copy">
              <ItemButton
                name={row.name}
                quantity={context ? row.quantity : undefined}
                context={context}
                onOpen={onExplain}
              />
              {lock && <EnvLockNote requirement={lock} />}
            </span>
            <strong>× {row.quantity}</strong>
          </li>
        );
      })}
    </ul>
  );
}

const ENVIRONMENT_CLASS: Record<string, string> = {
  Bright: "env-bright",
  Dark: "env-dark",
  Warm: "env-warm",
  Cool: "env-cool",
  Humid: "env-humid",
  Dry: "env-dry",
};

const ENVIRONMENT_ICON = {
  Bright: Sun,
  Dark: Moon,
  Warm: Thermometer,
  Cool: Snowflake,
  Humid: CloudRain,
  Dry: Droplets,
};

function HomeCard({
  home,
  preview,
  compact,
  onComplete,
  onOpen,
  onChangeHome,
  onExplain,
}: {
  home: RecommendedHome;
  preview: boolean;
  compact: boolean;
  onComplete: (completed: boolean) => void;
  onOpen: (tab: string) => void;
  onChangeHome: () => void;
  onExplain: (term: TermRef) => void;
}) {
  const catalog = useCatalog();
  const { state } = useProgress();
  const kit = plannableKitMap(catalog.kits).get(home.kitId);
  const residents = home.residents
    .map((id) => catalog.pokemon.find((p) => p.id === id)!)
    .filter(Boolean);
  const explanation = explainGroup(residents);
  const setup = furnishings(residents, catalog.items, state.envLevels);
  const env = homeEnvironment(home, catalog);
  const envClass = env ? ENVIRONMENT_CLASS[env] || "" : "";
  const EnvironmentIcon =
    ENVIRONMENT_ICON[env as keyof typeof ENVIRONMENT_ICON];
  const spare = kit ? kit.capacity - residents.length : 0;
  return (
    <article
      className={`housemate-card ${envClass} ${home.completed ? "is-complete" : ""} ${compact ? "is-compact" : ""}`}
      aria-label={`${kit?.name || "Home"}: ${residents.map((p) => p.name).join(", ") || "No residents"}`}
    >
      <header className="housemate-card-header">
        <span
          className={`home-list-icon ${envClass || "env-unknown"}`}
          aria-hidden="true"
        >
          {kit ? (
            <ItemThumb id={kit.id} name={kit.name} />
          ) : (
            <House size={22} />
          )}
        </span>
        <h4>{kit?.name || "Home"}</h4>
        {env && (
          <TermChip
            term={{ kind: "environment", value: env }}
            onOpen={onExplain}
          >
            {EnvironmentIcon && (
              <EnvironmentIcon size={13} aria-hidden="true" />
            )}{" "}
            {env}
          </TermChip>
        )}
        <label
          className="home-completion"
          title="Home built and Pokémon moved in"
        >
          <input
            type="checkbox"
            checked={!!home.completed}
            disabled={preview || !residents.length}
            onChange={(event) => onComplete(event.target.checked)}
            aria-label={`Home built and Pokémon moved in: ${residents.map((p) => p.name).join(", ") || "empty home"}`}
            aria-describedby="home-completion-help"
          />
          <span>{home.completed ? "Done" : "To do"}</span>
        </label>
      </header>
      <div className="housemate-residents">
        <div className="housemate-portraits">
          {residents.map((p) => (
            <a
              className="housemate-avatar"
              key={p.id}
              href={`#/pokemon/${p.id}`}
              aria-label={`${p.name} · ${p.types[0] || "Type unrecorded"}`}
            >
              <Portrait pokemon={p} small />
              <span className="housemate-tooltip" role="tooltip">
                {p.name} · {p.types[0] || "Type unrecorded"}
              </span>
            </a>
          ))}
        </div>
        <span className="housemate-capacity">
          {residents.length
            ? `${residents.length} resident${residents.length === 1 ? "" : "s"}`
            : "No residents"}
          {spare > 0 && ` · ${spare} free`}
        </span>
      </div>
      <p className={`match-label match-${explanation.match}`}>
        {preferenceLabel(explanation.match)}
      </p>
      {compact ? (
        <p className="housemate-compact-summary">
          {setup.selected.length} suggested furnishing
          {setup.selected.length === 1 ? "" : "s"}
          {setup.uncovered.length
            ? ` · ${setup.uncovered.length} categories need references`
            : ""}
        </p>
      ) : (
        <div className="card-furnishings">
          <button
            type="button"
            className="card-section-heading"
            disabled={preview}
            onClick={() => onOpen("Furnishings")}
          >
            Suggested furnishings <span>{setup.selected.length}</span>
          </button>
          {setup.selected.length ? (
            <ul className="card-furnishing-list">
              {setup.selected.map(
                ({ item, categories, locked, envRequirement }) => (
                  <li key={item.id} className={locked ? "locked" : undefined}>
                    <span className="furnishing-thumbnail">
                      <ItemThumb id={item.id} name={item.name} />
                    </span>
                    <div className="furnishing-copy">
                      <ItemButton
                        name={item.name}
                        id={item.id}
                        onOpen={onExplain}
                      />
                      <div className="furnishing-tags">
                        {categories.map((category) => (
                          <span key={category}>{category}</span>
                        ))}
                      </div>
                      {locked && envRequirement && (
                        <EnvLockNote requirement={envRequirement} />
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="muted">
              No furnishing item is recorded for this group's favorites.
            </p>
          )}
          {!!setup.uncovered.length && (
            <p className="muted">
              Still needs an item reference: {setup.uncovered.join(", ")}.
            </p>
          )}
        </div>
      )}
      <footer className="housemate-action-dock">
        <button
          className="button secondary"
          disabled={preview}
          onClick={onChangeHome}
        >
          <House size={16} /> Change home
        </button>
        <button
          className="button"
          disabled={preview}
          onClick={() => onOpen("Residents")}
        >
          <Users size={16} /> Housemates
        </button>
      </footer>
    </article>
  );
}

function ChangeHomeModal({
  home,
  plan,
  availableKitIds,
  onClose,
  onSave,
}: {
  home: RecommendedHome;
  plan: HousematePlan;
  availableKitIds: string[] | null;
  onClose: () => void;
  onSave: (p: HousematePlan) => void;
}) {
  const catalog = useCatalog();
  const [error, setError] = useState("");
  const [term, setTerm] = useState<TermRef | null>(null);
  const kit = plannableKitMap(catalog.kits).get(home.kitId);
  const options = eligibleKits(home.residents.length, catalog, availableKitIds);
  return (
    <Modal title="Change home" onClose={onClose} wide>
      <p className="muted">
        Only supported homes with enough capacity are listed. Review
        construction requirements before choosing. This is not ranked by cost.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="kit-options kit-replacement">
        {options.map((option) => (
          <div
            className={`kit-option ${option.id === kit?.id ? "selected" : ""}`}
            key={option.id}
          >
            <button
              type="button"
              className="kit-choose"
              onClick={() => {
                try {
                  onSave(changeHomeKit(plan, home.id, option.id, catalog));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <ItemThumb id={option.id} name={option.name} large />
              <strong>{option.name}</strong>
              <small>
                {option.width} × {option.depth} blocks · {option.capacity}{" "}
                residents · {option.buildTime || "build time not recorded"} ·{" "}
                {option.helpers || "helpers not recorded"} helpers
              </small>
            </button>
            {option.materials.length ? (
              <small className="material-line">
                {option.materials.map((m, i) => (
                  <span key={m.name}>
                    {i ? ", " : ""}
                    {m.quantity} ×{" "}
                    <ItemButton
                      name={m.name}
                      quantity={m.quantity}
                      context="home"
                      onOpen={setTerm}
                    />
                  </span>
                ))}
              </small>
            ) : (
              <small>Materials not recorded</small>
            )}
          </div>
        ))}
      </div>
      {!options.length && (
        <p className="notice">
          No supported home has enough capacity for this group.
        </p>
      )}
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </Modal>
  );
}

function AvailableKitsModal({
  selected,
  onClose,
  onSave,
}: {
  selected: string[] | null;
  onClose: () => void;
  onSave: (next: string[] | null) => void;
}) {
  const catalog = useCatalog();
  const [draft, setDraft] = useState<string[]>(
    selected ?? plannableKits(catalog.kits).map((k) => k.id),
  );
  const allSelected = draft.length === plannableKits(catalog.kits).length;
  return (
    <Modal title="Available kits" onClose={onClose} wide>
      <p className="muted">
        Limit housemate suggestions to kits you have actually unlocked. This
        does not affect the Change home options on an existing group.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="text-button"
          onClick={() => setDraft(plannableKits(catalog.kits).map((k) => k.id))}
        >
          Select all
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setDraft([])}
        >
          Select none
        </button>
      </div>
      <div className="kit-options">
        {plannableKits(catalog.kits).map((kit) => (
          <label className="kit-option" key={kit.id}>
            <input
              type="checkbox"
              checked={draft.includes(kit.id)}
              onChange={() =>
                setDraft((d) =>
                  d.includes(kit.id)
                    ? d.filter((id) => id !== kit.id)
                    : [...d, kit.id],
                )
              }
            />
            <strong>{kit.name}</strong>
            <small>{kit.capacity} residents</small>
          </label>
        ))}
      </div>
      <div className="button-row">
        <button
          className="button"
          onClick={() => onSave(allSelected ? null : draft)}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function AddHomeModal({
  plan,
  availableKitIds,
  onClose,
  onSave,
}: {
  plan: HousematePlan;
  availableKitIds: string[] | null;
  onClose: () => void;
  onSave: (p: HousematePlan) => void;
}) {
  const catalog = useCatalog();
  const [error, setError] = useState("");
  const options = eligibleKits(1, catalog, availableKitIds);
  return (
    <Modal title="Add a home" onClose={onClose} wide>
      <p className="muted">
        Creates an empty group you can fill by hand from the resident lists. It
        is dropped automatically if it ends up empty again.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="kit-options">
        {options.map((option) => (
          <div className="kit-option" key={option.id}>
            <button
              type="button"
              className="kit-choose"
              onClick={() => {
                try {
                  onSave(addHome(plan, option.id, catalog));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <ItemThumb id={option.id} name={option.name} large />
              <strong>{option.name}</strong>
              <small>
                {option.width} × {option.depth} blocks · {option.capacity}{" "}
                residents
              </small>
            </button>
          </div>
        ))}
      </div>
      {!options.length && (
        <p className="notice">No supported home is currently available.</p>
      )}
    </Modal>
  );
}
