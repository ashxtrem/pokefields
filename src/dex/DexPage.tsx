import { useMemo, useState } from "react";
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
import { DEX_NAMES, type Dex, type Pokemon } from "../catalog/types";
import { useProgress } from "../progress/context";
import {
  AreaMarks,
  Empty,
  Modal,
  Portrait,
  SourceLink,
} from "../ui/components";
import { defaultFilters, filterPokemon, type Filters } from "./search";
export function DexPage() {
  const catalog = useCatalog();
  const { state } = useProgress();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expanded, setExpanded] = useState(false);
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
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png"
            alt=""
          />
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
            {results.map((p, i) => (
              <article
                className={`pokemon-card type-${p.types[0]?.toLowerCase()} ${state.found[p.id]?.length ? "discovered" : ""}`}
                key={p.id}
                style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
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
                      <span
                        key={t}
                        className={`type-pill type-${t.toLowerCase()}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="specialty">
                    {p.specialties.length
                      ? p.specialties.join(" · ")
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
export function PokemonDetail({ id }: { id: string }) {
  const catalog = useCatalog();
  const p = catalog.pokemon.find((p) => p.id === id);
  const [tab, setTab] = useState("Overview");
  if (!p)
    return (
      <Empty title="That entry isn’t in this notebook">
        <a href="#/dex">Return to the Pokédex</a>
      </Empty>
    );
  return (
    <div className="detail-page">
      <a className="back-link" href="#/dex">
        ← Back to Pokédex
      </a>
      <div className={`detail-hero type-${p.types[0]?.toLowerCase()}`}>
        <div>
          <div className="eyebrow">
            {DEX_NAMES[p.dex]} · #{p.number}
          </div>
          <h1>{p.name}</h1>
          <div className="type-tags">
            {p.types.map((t) => (
              <span className={`type-pill type-${t.toLowerCase()}`} key={t}>
                {t}
              </span>
            ))}
          </div>
          <p>{p.specialties.join(" · ") || "Specialties not recorded"}</p>
        </div>
        <Portrait pokemon={p} />
      </div>
      <div className="tabs detail-tabs">
        {["Overview", "Habitats & Spawns", "Preferences", "My Progress"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <section className="detail-body">
        {tab === "Overview" && (
          <>
            <div className="info-grid">
              {[
                ["Content", p.event || p.contentSource || "Base game"],
                ["Ideal environment", p.environment],
                ["Specialties", p.specialties.join(", ")],
                ["Height", p.height ? `${p.height} m` : null],
                ["Weight", p.weight ? `${p.weight} kg` : null],
                ["National number", p.nationalNumber],
                ["Forms", p.forms.join(", ") || "No additional forms recorded"],
              ].map(([k, v]) => (
                <div className="info-box" key={k}>
                  <span>{k}</span>
                  <strong>{v || "Not recorded"}</strong>
                </div>
              ))}
            </div>
            {p.partial && (
              <p className="notice">
                This entry has incomplete reference data. Unknown details stay
                unfilled.
              </p>
            )}
            <SourceLink url={p.source} />
            {p.additionalSources?.map((url) => (
              <SourceLink key={url} url={url} label="Female form reference" />
            ))}
          </>
        )}
        {tab === "Habitats & Spawns" && (
          <>
            {p.habitats.length ? (
              p.habitats.map((h) => (
                <div className="habitat-detail" key={h.id}>
                  <div>
                    <span className="eyebrow">ATTRACTING HABITAT</span>
                    <h3>{h.name}</h3>
                  </div>
                  {h.requirements.length ? (
                    <ul>
                      {h.requirements.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="notice">
                      Build requirements are not yet recorded. Check the
                      reference before building.
                    </p>
                  )}
                  <p>
                    <MapPin size={14} />{" "}
                    {h.areas.join(" · ") || "Areas not recorded"}
                  </p>
                  <p>
                    Time:{" "}
                    {(h.times.length ? h.times : p.times).join(", ") ||
                      "Not recorded"}{" "}
                    · Weather:{" "}
                    {(h.weather.length ? h.weather : p.weather).join(", ") ||
                      "Not recorded"}
                  </p>
                  <p>Rarity: {h.rarity}</p>
                  <SourceLink url={h.source} />
                </div>
              ))
            ) : (
              <Empty title="Habitat details still growing">
                No verified habitat has been recorded for this entry.
              </Empty>
            )}
          </>
        )}
        {tab === "Preferences" && (
          <>
            <h3>A place {p.name} will like</h3>
            <p className="muted">
              Ideal environment:{" "}
              <strong>{p.environment || "Not recorded"}</strong>
            </p>
            <div className="preference-grid">
              {p.favorites.map((f) => (
                <div className="info-box" key={f}>
                  <strong>{f}</strong>
                  <span>
                    {catalog.items
                      .filter((i) => i.categories.includes(f))
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(" · ") || "Example items not recorded"}
                  </span>
                </div>
              ))}
            </div>
            {!p.favorites.length && (
              <p className="notice">
                Favorite categories have not been verified for this Pokémon.
              </p>
            )}
            <p>
              Favorite food: <strong>{p.food || "Not recorded"}</strong>
            </p>
            <p className="muted">
              Shared preferences help with furnishing. They are not a friendship
              rating or a guarantee of maximum comfort.
            </p>
            <SourceLink url={p.source} />
            {p.additionalSources?.map((url) => (
              <SourceLink key={url} url={url} label="Female form reference" />
            ))}
          </>
        )}
        {tab === "My Progress" && <AreaMarks pokemon={p} />}
      </section>
    </div>
  );
}
