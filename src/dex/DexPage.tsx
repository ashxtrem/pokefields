import { useViewState } from "../ui/navigation";
import { SupplyIcon } from "../shopping/SupplyIcon";
import { BuildModal } from "../habitats/BuildModal";
import { HabitatPokemonChips } from "../habitats/HabitatPokemon";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Check,
  Plus,
  MapPin,
  BookOpen,
} from "lucide-react";
import { useCatalog } from "../catalog/context";
import {
  DEX_NAMES,
  type Catalog,
  type Habitat,
  type Pokemon,
} from "../catalog/types";
import { getCanonicalHabitat } from "../habitats/catalog";
import { useProgress } from "../progress/context";
import {
  AreaMarks,
  Empty,
  ExplainDialog,
  Modal,
  Portrait,
  SpecialtyIcon,
  TermChip,
} from "../ui/components";
import { defaultFilters, filterPokemon, type Filters } from "./search";
import {
  explainTerm,
  foodEntries,
  habitatImageUrl,
  itemImageUrl,
  parseRequirement,
  pokemonArtUrl,
  type TermRef,
} from "./glossary";
import { habitatDetailHref } from "../habitats/search";
import { recordsForHabitat, buildBadges } from "../habitats/builds";

function typeClass(type?: string) {
  const slug = type?.trim().toLowerCase();
  return slug ? `type-${slug}` : "";
}

export function DexPage() {
  const catalog = useCatalog();
  const { state } = useProgress();
  const [filters, setFilters] = useViewState<Filters>(
    "dex.filters",
    defaultFilters,
  );
  const [expanded, setExpanded] = useViewState("dex.expanded", false);
  const [mark, setMark] = useState<Pokemon | null>(null);
  const update = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const results = useMemo(
    () => filterPokemon(catalog.pokemon, state.found, filters),
    [catalog, state.found, filters],
  );
  const total = catalog.pokemon.filter(
    (p) => filters.dex === "all" || p.dex === filters.dex,
  );
  const found = total.filter((p) => state.found[p.id]?.length).length;
  const active = Object.entries(filters).filter(
    ([k, v]) => !["search", "dex", "sort"].includes(k) && v && v !== "all",
  ).length;
  const options = (key: keyof Filters, title: string, values: string[]) => (
    <label className="filter-label">
      {title}
      <select
        value={filters[key]}
        onChange={(e) => update(key, e.target.value)}
      >
        <option value="">Any {title.toLowerCase()}</option>
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
  const unique = (field: "specialties" | "types" | "times" | "weather") =>
    [...new Set(catalog.pokemon.flatMap((p) => p[field]))].sort();
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">YOUR ISLAND FIELD GUIDE</div>
          <h1>
            Every friend starts
            <br />
            with a little discovery<span className="dot">.</span>
          </h1>
          <p>
            Get to know your neighbors. Find their favorite places. Keep a
            little record.
          </p>
        </div>
        <div className="hero-garden" aria-hidden="true">
          <div className="garden-orbit" />
          <span className="garden-spark">✧</span>
          <img src={pokemonArtUrl(1)} alt="" decoding="async" />
          <span className="garden-note">Room to grow 🌱</span>
        </div>
      </div>
      <div className="discovery-strip">
        <div className="strip-icon">
          <BookOpen size={22} />
        </div>
        <div>
          <strong>
            {found} <span>of {total.length} friends found</span>
          </strong>
          <p>A growing collection of good company.</p>
        </div>
        <div className="progress-track">
          <span
            style={{
              width: `${total.length ? (found / total.length) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="progress-number">
          {total.length ? Math.round((found / total.length) * 100) : 0}%
        </span>
      </div>
      <section className="dex-section">
        <div className="section-top">
          <div className="tabs">
            {(["regular", "event", "basin", "all"] as const).map((d) => (
              <button
                key={d}
                className={filters.dex === d ? "active" : ""}
                onClick={() => update("dex", d)}
              >
                {d === "all" ? "All dexes" : DEX_NAMES[d]}
                <span>
                  {d === "all"
                    ? catalog.pokemon.length
                    : catalog.pokemon.filter((p) => p.dex === d).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="search-row">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="Search Pokémon"
              placeholder="Search by name or Pokédex number…"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
            {filters.search && (
              <button
                aria-label="Clear search"
                onClick={() => update("search", "")}
              >
                ×
              </button>
            )}
          </div>
          <select
            aria-label="Found status"
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="all">All discoveries</option>
            <option value="found">Found</option>
            <option value="missing">Not found yet</option>
          </select>
          <button
            className={`button secondary ${active ? "filtered" : ""}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <SlidersHorizontal size={16} />
            Filters{active > 0 && <span>{active}</span>}
          </button>
        </div>
        {expanded && (
          <div className="filter-panel">
            {options("foundArea", "Found area", catalog.areas)}
            {options("spawnArea", "Spawn area", catalog.areas)}
            {options("specialty", "Specialty", unique("specialties"))}
            {options("type", "Type", unique("types"))}
            {options("time", "Time", unique("times"))}
            {options("weather", "Weather", unique("weather"))}
            <button
              className="text-button"
              onClick={() =>
                setFilters({ ...defaultFilters, dex: filters.dex })
              }
            >
              Reset filters
            </button>
          </div>
        )}
        <div className="results-bar">
          <span>
            Showing <strong>{results.length}</strong> friends{" "}
            {filters.search && `for “${filters.search}”`}
          </span>
          <label>
            Sort by{" "}
            <select
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
              aria-label="Sort Pokémon"
            >
              <option value="number">Dex number</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
        {!results.length ? (
          <Empty title="No friends on this page yet">
            Try another name or clear a filter to explore a little further.
          </Empty>
        ) : (
          <div className="pokemon-grid">
            {results.map((p) => (
              <article
                className={`pokemon-card ${typeClass(p.types[0])} ${state.found[p.id]?.length ? "discovered" : ""}`}
                key={p.id}
              >
                <a className="pokemon-link" href={`#/pokemon/${p.id}`}>
                  <div className="card-top">
                    <span>#{p.number}</span>
                    {filters.dex === "all" && (
                      <small>
                        {p.dex === "regular"
                          ? "Main"
                          : p.dex === "event"
                            ? "Event"
                            : "Basin"}
                      </small>
                    )}
                    <ArrowUpRight size={15} />
                  </div>
                  <div className="art-stage">
                    <Portrait pokemon={p} />
                    <span className="art-circle" />
                  </div>
                  <h3>{p.name}</h3>
                  <div className="type-tags">
                    {p.types.map((t) => (
                      <span key={t} className={`type-pill ${typeClass(t)}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <p
                    className="specialty"
                    aria-label={
                      p.specialties.length
                        ? `Specialties: ${p.specialties.join(", ")}`
                        : "Specialty not recorded"
                    }
                  >
                    {p.specialties.length
                      ? p.specialties.map((s) => (
                          <span key={s} className="specialty-mark" title={s}>
                            <SpecialtyIcon name={s} />
                          </span>
                        ))
                      : "Specialty not recorded"}
                  </p>
                </a>
                <button
                  className={`found-button ${state.found[p.id]?.length ? "is-found" : ""}`}
                  onClick={() => setMark(p)}
                  aria-label={`Record found areas for ${p.name}`}
                >
                  {state.found[p.id]?.length ? (
                    <>
                      <Check size={15} />
                      Found in {state.found[p.id].length}{" "}
                      {state.found[p.id].length === 1 ? "area" : "areas"}
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Mark as found
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {mark && (
        <Modal title={`Found ${mark.name}?`} onClose={() => setMark(null)}>
          <AreaMarks pokemon={mark} />
          <button className="button full" onClick={() => setMark(null)}>
            Done
          </button>
        </Modal>
      )}
    </>
  );
}
const DETAIL_TABS = ["Habitats & Spawns", "Preferences"] as const;

function PrefExamples({
  items,
  onOpen,
}: {
  items: { id: string; name: string }[];
  onOpen: (term: TermRef) => void;
}) {
  if (!items.length) return <span>Example items not recorded</span>;
  return (
    <span className="pref-examples">
      {items.map((item) => (
        <button
          type="button"
          className="pref-example"
          key={item.id}
          onClick={() =>
            onOpen({ kind: "item", value: item.name, id: item.id })
          }
          aria-haspopup="dialog"
          aria-label={item.name}
        >
          <img
            src={itemImageUrl(item.id)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {item.name}
        </button>
      ))}
    </span>
  );
}

export function PokemonDetail({ id }: { id: string }) {
  const catalog = useCatalog();
  const { state, ready } = useProgress();
  const p = catalog.pokemon.find((p) => p.id === id);
  const [tab, setTab] = useViewState<string>(
    `pokemon.${id}.tab`,
    "Habitats & Spawns",
  );
  const [planHabitat, setPlanHabitat] = useState<Habitat | null>(null);
  const [term, setTerm] = useState<TermRef | null>(null);
  const [marking, setMarking] = useState(false);
  if (!p)
    return (
      <Empty title="That entry isn’t in this notebook">
        <a href="#/dex">Return to the Pokédex</a>
      </Empty>
    );
  const open = (next: TermRef) => setTerm(next);
  const foods = foodEntries(p.food);
  const shownTab = DETAIL_TABS.includes(tab as (typeof DETAIL_TABS)[number])
    ? tab
    : "Habitats & Spawns";
  const foundAreas = state.found[p.id] || [];
  const pokemonIndex = catalog.pokemon.findIndex((x) => x.id === p.id);
  const prevPokemon =
    pokemonIndex > 0 ? catalog.pokemon[pokemonIndex - 1] : null;
  const nextPokemon =
    pokemonIndex >= 0 && pokemonIndex < catalog.pokemon.length - 1
      ? catalog.pokemon[pokemonIndex + 1]
      : null;
  return (
    <div className="detail-page">
      <div className="detail-page-header">
        <a className="back-link" href="#/dex">
          ← Back to Pokédex
        </a>
        <div className="detail-pager">
          {prevPokemon ? (
            <a
              className="button secondary detail-pager-link"
              href={`#/pokemon/${prevPokemon.id}`}
            >
              ← {prevPokemon.name}
            </a>
          ) : (
            <button className="button secondary" disabled>
              ← Previous
            </button>
          )}
          {nextPokemon ? (
            <a
              className="button secondary detail-pager-link"
              href={`#/pokemon/${nextPokemon.id}`}
            >
              {nextPokemon.name} →
            </a>
          ) : (
            <button className="button secondary" disabled>
              Next →
            </button>
          )}
        </div>
      </div>
      <div className={`detail-hero ${typeClass(p.types[0])}`}>
        <div className="detail-hero-copy">
          <div className="eyebrow">
            {DEX_NAMES[p.dex]} · #{p.number}
          </div>
          <h1>{p.name}</h1>
          <div className="detail-hero-meta">
            <div className="type-tags">
              {p.types.map((t) => (
                <span className={`type-pill ${typeClass(t)}`} key={t}>
                  {t}
                </span>
              ))}
            </div>
            {p.specialties.length ? (
              <div className="term-row">
                {p.specialties.map((s) => (
                  <TermChip
                    key={s}
                    term={{ kind: "specialty", value: s }}
                    onOpen={open}
                  />
                ))}
              </div>
            ) : (
              <p>Specialties not recorded</p>
            )}
          </div>
        </div>
        <div className="detail-hero-art">
          <Portrait pokemon={p} />
          <button
            className={`found-button ${foundAreas.length ? "is-found" : ""}`}
            onClick={() => setMarking(true)}
            aria-label={
              foundAreas.length
                ? `${p.name} found in ${foundAreas.length} ${foundAreas.length === 1 ? "area" : "areas"}. Edit found areas`
                : `Mark ${p.name} as found`
            }
          >
            {foundAreas.length ? (
              <Check size={22} strokeWidth={2} />
            ) : (
              <Plus size={22} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
      <div className="tabs detail-tabs">
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            className={shownTab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section key={shownTab} className="detail-body tab-content">
        {shownTab === "Habitats & Spawns" && (
          <>
            {p.habitats.length ? (
              p.habitats.map((h) => (
                <HabitatCard
                  key={h.id}
                  habitat={h}
                  pokemon={p}
                  onOpen={open}
                  builds={state.habitatBuilds || {}}
                  found={state.found}
                  canEdit={ready}
                  onPlan={() => setPlanHabitat(h)}
                />
              ))
            ) : (
              <Empty title="Habitat details still growing">
                No verified habitat has been recorded for this entry.
              </Empty>
            )}
          </>
        )}
        {shownTab === "Preferences" && (
          <>
            <h3>A place {p.name} will like</h3>
            <p className="muted term-line">
              Ideal environment:{" "}
              {p.environment ? (
                <TermChip
                  term={{ kind: "environment", value: p.environment }}
                  onOpen={open}
                />
              ) : (
                <strong>Not recorded</strong>
              )}
            </p>
            <div className="preference-grid">
              {p.favorites.map((f) => {
                const examples = catalog.items
                  .filter((i) => i.categories.includes(f))
                  .slice(0, 10);
                return (
                  <div className="info-box" key={f}>
                    <button
                      type="button"
                      className="pref-title"
                      onClick={() => open({ kind: "favorite", value: f })}
                    >
                      {f}
                    </button>
                    <PrefExamples items={examples} onOpen={open} />
                  </div>
                );
              })}
            </div>
            {!p.favorites.length && (
              <p className="notice">
                Favorite categories have not been verified for this Pokémon.
              </p>
            )}
            <h3 className="pref-food-heading">Favorite food</h3>
            {foods.length ? (
              <div className="preference-grid">
                {foods.map((entry) => {
                  const examples = explainTerm(
                    {
                      kind: "food",
                      value: entry.flavor,
                      label: entry.label,
                    },
                    catalog.items,
                  ).items;
                  return (
                    <div className="info-box" key={entry.label}>
                      <button
                        type="button"
                        className="pref-title"
                        onClick={() =>
                          open({
                            kind: "food",
                            value: entry.flavor,
                            label: entry.label,
                          })
                        }
                      >
                        {entry.label}
                      </button>
                      <PrefExamples items={examples} onOpen={open} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="notice">Favorite food has not been recorded.</p>
            )}
            <p className="muted">
              Shared preferences help with furnishing. They are not a friendship
              rating or a guarantee of maximum comfort.
            </p>
          </>
        )}
      </section>
      {marking && (
        <Modal title={`Found ${p.name}?`} onClose={() => setMarking(false)}>
          <AreaMarks pokemon={p} onExplain={open} />
          <button className="button full" onClick={() => setMarking(false)}>
            Done
          </button>
        </Modal>
      )}
      {planHabitat && (
        <BuildModal
          habitatId={planHabitat.id}
          habitatName={planHabitat.name}
          mode="planned"
          originPokemonId={p.id}
          onClose={() => setPlanHabitat(null)}
        />
      )}
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </div>
  );
}

function HabitatCard({
  habitat,
  pokemon,
  onOpen,
  builds,
  found,
  canEdit,
  onPlan,
}: {
  habitat: Habitat;
  pokemon: Pokemon;
  onOpen: (term: TermRef) => void;
  builds: Record<string, import("../habitats/types").HabitatBuildRecord>;
  found: Record<string, string[]>;
  canEdit: boolean;
  onPlan: () => void;
}) {
  const catalog = useCatalog();
  const times = habitat.times.length ? habitat.times : pokemon.times;
  const weather = habitat.weather.length ? habitat.weather : pokemon.weather;
  const records = recordsForHabitat(builds, habitat.id);
  const badge = buildBadges(records);
  const canonical = getCanonicalHabitat(catalog, habitat.id);
  return (
    <article className="habitat-card">
      <div className="habitat-visual">
        <a href={habitatDetailHref(habitat.id)}>
          <HabitatImage habitat={habitat} />
        </a>
      </div>
      <div className="habitat-content">
        <div className="habitat-heading">
          <div>
            <span className="eyebrow">ATTRACTING HABITAT</span>
            <h3>
              <a href={habitatDetailHref(habitat.id)}>{habitat.name}</a>
            </h3>
          </div>
          <button
            type="button"
            className="rarity-badge"
            onClick={() => onOpen({ kind: "rarity", value: habitat.rarity })}
          >
            {habitat.rarity === "CommonCommon" ? "Common" : habitat.rarity}
          </button>
        </div>
        <p className="muted">
          {badge.built ? `${badge.built} built` : ""}
          {badge.built && badge.planned ? " · " : ""}
          {badge.planned ? `${badge.planned} planned` : ""}
          {!badge.built && !badge.planned ? "Not started" : ""}
        </p>
        {canonical && (
          <HabitatPokemonChips
            habitat={canonical}
            currentPokemonId={pokemon.id}
            showNames
          />
        )}
        {habitat.requirements.length ? (
          <section
            className="habitat-requirements"
            aria-label={`${habitat.name} requirements`}
          >
            <span className="habitat-section-label">REQUIREMENTS</span>
            {habitat.requirements.map((raw) => {
              const requirement = parseRequirement(raw);
              return (
                <div className="habitat-requirement" key={raw}>
                  <SupplyIcon label={requirement.name} />
                  <button
                    type="button"
                    className="requirement-name"
                    onClick={() =>
                      onOpen({
                        kind: requirement.kind,
                        value: requirement.name,
                        quantity: requirement.quantity,
                        label: raw,
                      })
                    }
                  >
                    {raw.replace(/\s+/g, " ").trim()}
                  </button>
                </div>
              );
            })}
          </section>
        ) : (
          <p className="notice">
            Build requirements are not yet recorded. Check the reference before
            building.
          </p>
        )}
        <dl className="habitat-facts">
          <div>
            <dt>
              <MapPin size={15} /> Locations
            </dt>
            <dd>
              {habitat.areas.length
                ? habitat.areas.map((area) => (
                    <button
                      type="button"
                      key={area}
                      onClick={() => onOpen({ kind: "area", value: area })}
                    >
                      {area}
                    </button>
                  ))
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {times.length
                ? times.map((time) => (
                    <button
                      type="button"
                      key={time}
                      onClick={() => onOpen({ kind: "time", value: time })}
                    >
                      {time}
                    </button>
                  ))
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Weather</dt>
            <dd>
              {weather.length
                ? weather.map((condition) => (
                    <button
                      type="button"
                      key={condition}
                      onClick={() =>
                        onOpen({ kind: "weather", value: condition })
                      }
                    >
                      {condition}
                    </button>
                  ))
                : "Not recorded"}
            </dd>
          </div>
        </dl>
        <div className="habitat-actions">
          <button
            type="button"
            className="button secondary"
            disabled={!canEdit}
            onClick={onPlan}
          >
            Plan build
          </button>
          <a className="text-button" href={habitatDetailHref(habitat.id)}>
            Open habitat page
          </a>
        </div>
      </div>
    </article>
  );
}

function HabitatImage({ habitat }: { habitat: Habitat }) {
  const src = habitatImageUrl(habitat.image);
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed)
    return (
      <div
        className="habitat-image habitat-image-placeholder"
        role="img"
        aria-label={`${habitat.name} habitat image unavailable`}
      >
        Habitat image unavailable
      </div>
    );
  return (
    <img
      className="habitat-image"
      src={src!}
      alt={`${habitat.name} habitat`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
