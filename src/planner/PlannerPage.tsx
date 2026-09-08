import { HomeDetail } from "./HomeDetail";
import { useMemo, useState } from "react";
import { House, Users, Search } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { useProgress } from "../progress/context";
import { furnishings } from "./engine";
import {
  changeHomeKit,
  combinedSupplies,
  convertSpatialPlan,
  eligibleKits,
  explainGroup,
  moveResident,
  planIsStale,
  preferenceLabel,
  recommendHousemates,
  uniqueFoundRoster,
} from "./recommend";
import type { HousematePlan, RecommendedHome } from "./types";
import { Empty, Modal, Portrait, SourceLink } from "../ui/components";

export function PlannerPage() {
  const catalog = useCatalog();
  const { state, update, ready } = useProgress();
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [detailTab, setDetailTab] = useState("Residents");
  const [draft, setDraft] = useState<HousematePlan | null>(null);
  const [convertArea, setConvertArea] = useState("");
  const [changeHomeId, setChangeHomeId] = useState("");
  const foundIds = uniqueFoundRoster(state.found, area || null);
  const saved = state.housematePlan || null;
  const view = draft || saved;
  const active = view?.homes.find((h) => h.id === selected);
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
  const roster = foundIds.filter((id) => !excluded.includes(id));
  const stale = saved ? planIsStale(saved, state.found, catalog) : false;
  const legacyAreas = Object.keys(state.plans).sort();
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
    );
    if (saved) {
      setDraft(next);
      setSelected("");
      return;
    }
    save(next);
    setSelected("");
  };
  const supplies = view ? combinedSupplies(view, catalog) : null;
  const changing = view?.homes.find((h) => h.id === changeHomeId);
  return (
    <>
      <div className="planner-title">
        <div>
          <div className="eyebrow">HOUSEMATES</div>
          <h1>
            Plan homes for
            <br />
            your Pokémon<span className="dot">.</span>
          </h1>
          <p>
            Choose who should live together, then see what to build or gather
            for them.
          </p>
        </div>
        <div className="planner-illustration" aria-hidden="true">
          <House size={90} strokeWidth={1} />
          <span>✦</span>
          <span className="little-tree">♧</span>
        </div>
      </div>
      {!foundIds.length && !area && !view ? (
        <Empty title="No found Pokémon yet">
          Mark Pokémon as found in the Pokédex, then return here to suggest
          housemates. <a href="#/dex">Open Pokédex →</a>
        </Empty>
      ) : (
        <div className="planner-layout">
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
              {available.length ? (
                <div className="roster-options">
                  {available.map((p) => (
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
                  {area
                    ? "No found Pokémon match this area filter."
                    : "No found Pokémon match this search."}{" "}
                  <a href="#/dex">Open Pokédex →</a>
                </p>
              )}
            </div>
            {!!legacyAreas.length && (
              <div className="field">
                <span>Existing layout</span>
                <small>
                  Saved map layouts are kept. Convert residents and home choices
                  once; the original stays.
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
          </aside>
          <section className="planner-workspace">
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
                    <span className="eyebrow">
                      {view.areaFilter || "All found Pokémon"}
                      {draft ? " · preview" : ""}
                    </span>
                    <h2>
                      {view.homes.length}{" "}
                      {view.homes.length === 1 ? "home" : "homes"}
                    </h2>
                    <p>
                      {view.roster.length} selected ·{" "}
                      {view.homes.reduce((s, h) => s + h.residents.length, 0)}{" "}
                      housed
                      {view.unresolved.length
                        ? ` · ${view.unresolved.length} need review`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="home-list housemate-cards">
                  {view.homes.map((home, i) => (
                    <HomeCard
                      key={home.id}
                      home={home}
                      index={i}
                      preview={!!draft}
                      onOpen={(tab) => {
                        setDetailTab(tab);
                        setSelected(home.id);
                      }}
                      onChangeHome={() => setChangeHomeId(home.id)}
                    />
                  ))}
                </div>
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
                                    {catalog.kits.find((k) => k.id === h.kitId)
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
                      Combined supplies{" "}
                      <span>
                        {supplies.construction.length +
                          supplies.furnishings.length}{" "}
                        listed
                      </span>
                    </summary>
                    <p className="muted">
                      Required materials are construction totals. Suggested
                      furnishings are listed separately and counted once per
                      home. Food is ongoing care on each home, not a material
                      total. Quantities are not an inventory check.
                    </p>
                    <h3>Required materials</h3>
                    {supplies.construction.length ? (
                      <ul className="supply-list">
                        {supplies.construction.map((m) => (
                          <li key={m.name}>
                            <span>{m.name}</span>
                            <strong>× {m.quantity}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="notice">
                        Construction quantities are not recorded for the
                        suggested homes.
                      </p>
                    )}
                    <h3>Suggested furnishings</h3>
                    {supplies.furnishings.length ? (
                      <ul className="supply-list">
                        {supplies.furnishings.map((m) => (
                          <li key={m.name}>
                            <span>{m.name}</span>
                            <strong>× {m.quantity}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="notice">
                        No furnishing suggestions for the current groups.
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
          key={`${active.id}-${detailTab}`}
          home={active}
          plan={view}
          tab={detailTab}
          onClose={() => setSelected("")}
          onSave={persistView}
        />
      )}
      {changing && view && (
        <ChangeHomeModal
          home={changing}
          plan={view}
          onClose={() => setChangeHomeId("")}
          onSave={(next) => {
            persistView(next);
            setChangeHomeId("");
          }}
        />
      )}
    </>
  );
}

function HomeCard({
  home,
  index,
  preview,
  onOpen,
  onChangeHome,
}: {
  home: RecommendedHome;
  index: number;
  preview: boolean;
  onOpen: (tab: string) => void;
  onChangeHome: () => void;
}) {
  const catalog = useCatalog();
  const kit = catalog.kits.find((k) => k.id === home.kitId);
  const residents = home.residents
    .map((id) => catalog.pokemon.find((p) => p.id === id)!)
    .filter(Boolean);
  const explanation = explainGroup(residents);
  const setup = furnishings(residents, catalog.items);
  return (
    <article className="housemate-card">
      <span className={`home-list-icon home-color-${index % 4}`}>
        <House size={22} />
      </span>
      <div className="housemate-card-body">
        <div className="housemate-portraits">
          {residents.map((p) => (
            <Portrait key={p.id} pokemon={p} small />
          ))}
        </div>
        <strong>
          {residents.map((p) => p.name).join(", ") || "No residents"}
        </strong>
        <p className={`match-label match-${explanation.match}`}>
          {preferenceLabel(explanation.match)}
        </p>
        <p>{explanation.lines[0]}</p>
        {explanation.lines.slice(1).map((line) => (
          <small key={line}>{line}</small>
        ))}
        <p>
          {kit
            ? `${kit.name} · ${residents.length}/${kit.capacity} residents · ${kit.width} × ${kit.depth} blocks`
            : "Suggested home is no longer in the catalog"}
        </p>
        <p className="muted">
          Suggested for capacity, not confirmed affordability or unlock
          availability.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            disabled={preview}
            onClick={() => onOpen("Residents")}
          >
            Change housemates
          </button>
          <button
            className="button secondary"
            disabled={preview}
            onClick={onChangeHome}
          >
            Change home
          </button>
        </div>
        <details className="what-you-need">
          <summary>What you need</summary>
          <h3>Home construction</h3>
          {kit ? (
            <>
              <p>
                {kit.name}: {kit.width} × {kit.depth} × {kit.height} blocks ·{" "}
                {kit.helpers || "helpers not recorded"} helpers
                {kit.specialties.length
                  ? ` (${kit.specialties.join(", ")})`
                  : ""}{" "}
                · {kit.buildTime || "build time not recorded"}
              </p>
              {kit.materials.length ? (
                <ul className="supply-list">
                  {kit.materials.map((m) => (
                    <li key={m.name}>
                      <span>{m.name}</span>
                      <strong>× {m.quantity}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notice">Materials are not recorded.</p>
              )}
              <SourceLink url={kit.source} />
            </>
          ) : (
            <p className="notice">Construction details are unavailable.</p>
          )}
          <h3>Furnishing suggestions</h3>
          {setup.selected.length ? (
            setup.selected.map(({ item, benefits, categories }) => (
              <p key={item.id}>
                1 × {item.name} — {categories.join(", ")} for{" "}
                {benefits
                  .map((id) => catalog.pokemon.find((p) => p.id === id)!.name)
                  .join(", ")}
              </p>
            ))
          ) : (
            <p className="notice">
              No furnishing item is recorded for this group's favorites.
            </p>
          )}
          {!!setup.uncovered.length && (
            <p className="notice">
              Still needs an item reference: {setup.uncovered.join(", ")}.
            </p>
          )}
          <h3>Individual care</h3>
          {residents.map((p) => (
            <p key={p.id}>
              {p.name}: environment {p.environment || "unknown"}; food{" "}
              {p.food || "unknown"}
            </p>
          ))}
        </details>
      </div>
    </article>
  );
}

function ChangeHomeModal({
  home,
  plan,
  onClose,
  onSave,
}: {
  home: RecommendedHome;
  plan: HousematePlan;
  onClose: () => void;
  onSave: (p: HousematePlan) => void;
}) {
  const catalog = useCatalog();
  const [error, setError] = useState("");
  const kit = catalog.kits.find((k) => k.id === home.kitId);
  const options = eligibleKits(home.residents.length, catalog);
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
              <strong>{option.name}</strong>
              <small>
                {option.width} × {option.depth} blocks · {option.capacity}{" "}
                residents · {option.buildTime || "build time not recorded"} ·{" "}
                {option.helpers || "helpers not recorded"} helpers
              </small>
              {option.materials.length ? (
                <small>
                  {option.materials
                    .map((m) => `${m.quantity} × ${m.name}`)
                    .join(", ")}
                </small>
              ) : (
                <small>Materials not recorded</small>
              )}
            </button>
            {option.source && <SourceLink url={option.source} />}
          </div>
        ))}
      </div>
      {!options.length && (
        <p className="notice">
          No supported home has enough capacity for this group.
        </p>
      )}
    </Modal>
  );
}
