import { useViewState } from "../ui/navigation";
import { BuildModal } from "./BuildModal";
import { HabitatPokemonChips } from "./HabitatPokemon";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, TreePine } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { habitatImageUrl } from "../dex/glossary";
import { useProgress } from "../progress/context";
import { buildBadges, recordsForHabitat } from "../habitats/builds";
import { Empty } from "../ui/components";
import {
  filterHabitats,
  filtersFromQuery,
  filtersToQuery,
  habitatCatalogHref,
  habitatDetailHref,
} from "../habitats/search";
import {
  defaultHabitatFilters,
  type HabitatCatalogFilters,
} from "../habitats/types";
import type { CanonicalHabitat } from "../habitats/types";

function readFiltersFromHash() {
  const query = location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
  return filtersFromQuery(query);
}

export function HabitatsPage() {
  const catalog = useCatalog();
  const { state, ready } = useProgress();
  const [filters, setFilters] = useViewState(
    "habitats.filters",
    readFiltersFromHash,
  );
  const [expanded, setExpanded] = useViewState("habitats.expanded", false);
  const [buildMode, setBuildMode] = useState<"planned" | "built">("planned");
  const [planTarget, setPlanTarget] = useState<CanonicalHabitat | null>(null);

  useEffect(() => {
    const sync = (event?: HashChangeEvent) => {
      const previousHash = event ? new URL(event.oldURL).hash : "";
      const returningToUnfilteredHistory =
        location.hash === "#/habitats" &&
        previousHash.startsWith("#/habitats?");
      if (
        location.hash.startsWith("#/habitats?") ||
        returningToUnfilteredHistory
      )
        setFilters(readFiltersFromHash());
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const builds = state.habitatBuilds || {};
  const results = useMemo(
    () => filterHabitats(catalog, builds, state.found, filters),
    [catalog, builds, state.found, filters],
  );
  const syncFilters = (next: HabitatCatalogFilters) => {
    setFilters(next);
    const href = habitatCatalogHref(next);
    if (location.hash !== href) location.hash = href;
  };
  const active =
    Number(!!filters.search) +
    Number(!!filters.region) +
    Number(filters.status !== "all") +
    Number(filters.unfoundOnly) +
    Number(filters.regionMode !== "available") +
    Number(filters.sort !== "id");
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">HABITAT CATALOG</div>
          <h1>
            Choose a habitat,
            <br />
            prepare its supplies<span className="dot">.</span>
          </h1>
          <p>
            Browse attracting habitats, plan builds, and see which Pokémon you
            might still find there.
          </p>
        </div>
        <div className="hero-garden" aria-hidden="true">
          <TreePine size={72} strokeWidth={1.2} />
        </div>
      </div>
      <section className="dex-section habitats-section">
        <div className="search-row">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="Search habitats"
              placeholder="Search by habitat or Pokémon name…"
              value={filters.search}
              onChange={(e) =>
                syncFilters({ ...filters, search: e.target.value })
              }
            />
          </div>
          <button
            className={`button secondary ${active ? "filtered" : ""}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <SlidersHorizontal size={16} />
            Filters{active > 0 && <span>{active}</span>}
          </button>
        </div>
        <div className="region-chips">
          <button
            type="button"
            className={!filters.region ? "chip active" : "chip"}
            onClick={() => syncFilters({ ...filters, region: "" })}
          >
            All regions
          </button>
          {catalog.areas.map((area) => (
            <button
              type="button"
              key={area}
              className={filters.region === area ? "chip active" : "chip"}
              onClick={() => syncFilters({ ...filters, region: area })}
            >
              {area}
            </button>
          ))}
          <button
            type="button"
            className={filters.region === "__none__" ? "chip active" : "chip"}
            onClick={() => syncFilters({ ...filters, region: "__none__" })}
          >
            Region not recorded
          </button>
        </div>
        {expanded && (
          <div className="filter-panel">
            <label className="filter-label">
              Status
              <select
                value={filters.status}
                onChange={(e) =>
                  syncFilters({
                    ...filters,
                    status: e.target.value as HabitatCatalogFilters["status"],
                  })
                }
              >
                <option value="all">All</option>
                <option value="none">Not started</option>
                <option value="planned">Planned</option>
                <option value="built">Built</option>
              </select>
            </label>
            <label className="filter-label">
              Region mode
              <select
                value={filters.regionMode}
                onChange={(e) =>
                  syncFilters({
                    ...filters,
                    regionMode: e.target
                      .value as HabitatCatalogFilters["regionMode"],
                  })
                }
              >
                <option value="available">Available here</option>
                <option value="builds">My builds here</option>
              </select>
            </label>
            <label className="filter-label">
              Sort
              <select
                value={filters.sort}
                onChange={(e) =>
                  syncFilters({
                    ...filters,
                    sort: e.target.value as HabitatCatalogFilters["sort"],
                  })
                }
              >
                <option value="id">Habitat ID</option>
                <option value="name">Habitat name</option>
                <option value="unfound">Most unfound Pokémon</option>
              </select>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={filters.unfoundOnly}
                onChange={(e) =>
                  syncFilters({ ...filters, unfoundOnly: e.target.checked })
                }
              />
              Can attract Pokémon I haven&apos;t found
            </label>
            <button
              className="text-button"
              onClick={() => syncFilters(defaultHabitatFilters())}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="results-bar">
          <span>
            Showing <strong>{results.length}</strong> habitats
          </span>
        </div>
        {!results.length ? (
          <Empty title="No habitats match these filters">
            Try another search or clear a filter. This is not the same as having
            no build history.
          </Empty>
        ) : (
          <div className="habitat-grid">
            {results.map((habitat) => (
              <HabitatCatalogCard
                key={habitat.id}
                habitat={habitat}
                filters={filters}
                badge={buildBadges(recordsForHabitat(builds, habitat.id))}
                onPlan={() => {
                  setBuildMode("planned");
                  setPlanTarget(habitat);
                }}
                onRecord={() => {
                  setBuildMode("built");
                  setPlanTarget(habitat);
                }}
                disabled={!ready}
              />
            ))}
          </div>
        )}
      </section>
      {planTarget && (
        <BuildModal
          habitatId={planTarget.id}
          habitatName={planTarget.name}
          mode={buildMode}
          onClose={() => setPlanTarget(null)}
        />
      )}
    </>
  );
}

function statusLabel(badge: ReturnType<typeof buildBadges>) {
  if (!badge.planned && !badge.built) return "Not started";
  const parts = [];
  if (badge.built) parts.push(`${badge.built} built`);
  if (badge.planned) parts.push(`${badge.planned} planned`);
  return parts.join(" · ");
}

function HabitatCatalogCard({
  habitat,
  filters,
  badge,
  onPlan,
  onRecord,
  disabled,
}: {
  habitat: CanonicalHabitat;
  filters: HabitatCatalogFilters;
  badge: ReturnType<typeof buildBadges>;
  onPlan: () => void;
  onRecord: () => void;
  disabled: boolean;
}) {
  const src = habitatImageUrl(habitat.image);
  const status = statusLabel(badge);
  const statusClass =
    badge.built && badge.planned
      ? "mixed"
      : badge.built
        ? "built"
        : badge.planned
          ? "planned"
          : "none";
  return (
    <article className="habitat-catalog-card">
      <a
        className="habitat-card-link"
        href={habitatDetailHref(habitat.id, filters)}
      >
        <div className="habitat-card-visual">
          {src ? (
            <img src={src} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="habitat-image-placeholder">No image</div>
          )}
        </div>
        <div className="habitat-card-body">
          <span className={`status-badge status-${statusClass}`}>{status}</span>
          <h3>{habitat.name}</h3>
          {!!habitat.conflicts.length && <p>Needs review</p>}
        </div>
      </a>
      <div className="habitat-card-pokemon">
        <HabitatPokemonChips habitat={habitat} region={filters.region} />
      </div>
      <div className="habitat-card-actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={onPlan}
        >
          Plan build
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={onRecord}
        >
          Record built
        </button>
      </div>
    </article>
  );
}

export {
  filtersToQuery,
  filtersFromQuery,
  habitatDetailHref,
  habitatCatalogHref,
};
