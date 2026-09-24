import { useViewState } from "../ui/navigation";
import { HabitatPokemonChips } from "./HabitatPokemon";
import { useEffect, useMemo, useState } from "react";
import { Check, MapPin, Search, SlidersHorizontal, TreePine } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { habitatImageUrl } from "../dex/glossary";
import { useProgress } from "../progress/context";
import {
  addQuickSaveLocation,
  hasLocationInRegion,
  locationsForHabitat,
  orderedRegionOptions,
  savedLocationCount,
} from "./locations";
import { Empty, Modal } from "../ui/components";
import {
  filterHabitats,
  filtersFromQuery,
  filtersToQuery,
  habitatCatalogHref,
  habitatDetailHref,
} from "./search";
import {
  defaultHabitatFilters,
  type HabitatCatalogFilters,
  type HabitatLocationRecord,
} from "./types";
import type { CanonicalHabitat } from "./types";

function readFiltersFromHash() {
  const query = location.hash.includes("?")
    ? location.hash.slice(location.hash.indexOf("?") + 1)
    : "";
  return filtersFromQuery(query);
}

function withQueryParam(href: string, key: string, value: string) {
  const [base, query] = href.split("?");
  const params = new URLSearchParams(query || "");
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

type CardAction =
  | { kind: "save"; region: string }
  | { kind: "saved"; href: string }
  | { kind: "choose" }
  | { kind: "review"; href: string };

function resolveCardAction(
  habitat: CanonicalHabitat,
  filters: HabitatCatalogFilters,
  locations: Record<string, HabitatLocationRecord>,
): CardAction {
  const region = filters.region;
  if (!region || region === "__none__") {
    if (filters.scope === "saved" && region === "__none__") {
      const record = locationsForHabitat(locations, habitat.id).find(
        (r) => r.region === null,
      );
      return {
        kind: "review",
        href: withQueryParam(
          habitatDetailHref(habitat.id, filters),
          "edit",
          record?.id || "",
        ),
      };
    }
    return { kind: "choose" };
  }
  if (hasLocationInRegion(locations, habitat.id, region)) {
    return {
      kind: "saved",
      href: withQueryParam(
        habitatDetailHref(habitat.id, filters),
        "focus",
        "my-locations",
      ),
    };
  }
  return { kind: "save", region };
}

export function HabitatsPage() {
  const catalog = useCatalog();
  const { state, ready, updateWithUndo } = useProgress();
  const [filters, setFilters] = useViewState(
    "habitats.filters",
    readFiltersFromHash,
  );
  const [expanded, setExpanded] = useViewState("habitats.expanded", false);
  const [picking, setPicking] = useState<CanonicalHabitat | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedFeedback, setSavedFeedback] = useState<{
    habitatId: string;
    recordId: string;
    region: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");

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
  const locations = state.habitatLocations || {};
  const results = useMemo(
    () => filterHabitats(catalog, locations, state.found, filters),
    [catalog, locations, state.found, filters],
  );
  const syncFilters = (next: HabitatCatalogFilters) => {
    setFilters(next);
    const href = habitatCatalogHref(next);
    if (location.hash !== href) location.hash = href;
  };
  const active =
    Number(!!filters.search) +
    Number(!!filters.region) +
    Number(filters.unfoundOnly) +
    Number(filters.scope !== "available") +
    Number(filters.sort !== "id");

  const quickSave = async (habitat: CanonicalHabitat, region: string) => {
    const result = addQuickSaveLocation(locations, habitat, region);
    if (!result) return;
    setSavingIds((m) => ({ ...m, [habitat.id]: true }));
    setAnnouncement("");
    const ok = await updateWithUndo(
      `Saved ${habitat.name} in ${region}`,
      (saved) => ({ ...saved, habitatLocations: result.locations }),
      ["habitatLocations"],
    );
    setSavingIds((m) => {
      const next = { ...m };
      delete next[habitat.id];
      return next;
    });
    if (ok) {
      setSavedFeedback({
        habitatId: habitat.id,
        recordId: result.record.id,
        region,
      });
      setAnnouncement(`Saved ${habitat.name} in ${region}`);
    } else {
      setAnnouncement("Not saved to this device. Export a backup to keep it.");
    }
  };

  const chooseLocation = (habitat: CanonicalHabitat, region: string) => {
    setPicking(null);
    if (hasLocationInRegion(locations, habitat.id, region)) {
      location.hash = withQueryParam(
        habitatDetailHref(habitat.id, filters),
        "focus",
        "my-locations",
      );
      return;
    }
    void quickSave(habitat, region);
  };

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">HABITAT CATALOG</div>
          <h1>
            Choose a habitat,
            <br />
            save where it's built<span className="dot">.</span>
          </h1>
          <p>
            Browse attracting habitats and see which Pokémon you might still
            find there.
          </p>
        </div>
        <div className="hero-garden" aria-hidden="true">
          <TreePine size={72} strokeWidth={1.2} />
        </div>
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
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
              Scope
              <select
                value={filters.scope}
                onChange={(e) =>
                  syncFilters({
                    ...filters,
                    scope: e.target.value as HabitatCatalogFilters["scope"],
                  })
                }
              >
                <option value="available">Available here</option>
                <option value="saved">Saved here</option>
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
            Try another search or clear a filter. This is not the same as
            having no saved locations.
          </Empty>
        ) : (
          <div className="habitat-grid">
            {results.map((habitat) => (
              <HabitatCatalogCard
                key={habitat.id}
                habitat={habitat}
                filters={filters}
                savedCount={savedLocationCount(locations, habitat.id)}
                action={resolveCardAction(habitat, filters, locations)}
                saving={!!savingIds[habitat.id]}
                justSaved={
                  savedFeedback?.habitatId === habitat.id ? savedFeedback : null
                }
                disabled={!ready}
                onSave={(region) => void quickSave(habitat, region)}
                onChoose={() => setPicking(habitat)}
              />
            ))}
          </div>
        )}
      </section>
      {picking && (
        <RegionPickerModal
          habitat={picking}
          areas={catalog.areas}
          onClose={() => setPicking(null)}
          onChoose={(region) => chooseLocation(picking, region)}
        />
      )}
    </>
  );
}

function HabitatCatalogCard({
  habitat,
  filters,
  savedCount,
  action,
  saving,
  justSaved,
  disabled,
  onSave,
  onChoose,
}: {
  habitat: CanonicalHabitat;
  filters: HabitatCatalogFilters;
  savedCount: number;
  action: CardAction;
  saving: boolean;
  justSaved: { recordId: string; region: string } | null;
  disabled: boolean;
  onSave: (region: string) => void;
  onChoose: () => void;
}) {
  const src = habitatImageUrl(habitat.image);
  const summary = savedCount
    ? `${savedCount} saved location${savedCount === 1 ? "" : "s"}`
    : "No saved locations yet";
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
          <span className="status-badge saved-summary">
            <MapPin size={12} /> {summary}
          </span>
          <h3>{habitat.name}</h3>
          {!!habitat.conflicts.length && <p>Needs review</p>}
        </div>
      </a>
      <div className="habitat-card-pokemon">
        <HabitatPokemonChips habitat={habitat} region={filters.region} />
      </div>
      <div className="habitat-card-actions">
        {justSaved ? (
          <>
            <span className="button secondary saved-check">
              <Check size={15} /> Saved here
            </span>
            <a
              className="text-button"
              href={withQueryParam(
                habitatDetailHref(habitat.id, filters),
                "edit",
                justSaved.recordId,
              )}
            >
              Add landmark
            </a>
          </>
        ) : action.kind === "save" ? (
          <button
            type="button"
            className="button"
            disabled={disabled || saving}
            aria-label={`Save ${habitat.name} in ${action.region}`}
            onClick={() => onSave(action.region)}
          >
            {saving ? "Saving…" : `Save in ${action.region}`}
          </button>
        ) : action.kind === "saved" ? (
          <a className="button secondary saved-check" href={action.href}>
            <Check size={15} /> Saved here
          </a>
        ) : action.kind === "review" ? (
          <a className="button secondary" href={action.href}>
            Review location
          </a>
        ) : (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            aria-label={`Choose a location for ${habitat.name}`}
            onClick={onChoose}
          >
            Choose location
          </button>
        )}
      </div>
    </article>
  );
}

function RegionPickerModal({
  habitat,
  areas,
  onClose,
  onChoose,
}: {
  habitat: CanonicalHabitat;
  areas: string[];
  onClose: () => void;
  onChoose: (region: string) => void;
}) {
  const ordered = orderedRegionOptions(areas, habitat.discoveryRegions);
  return (
    <Modal title={`Choose a region for ${habitat.name}`} onClose={onClose}>
      <p className="muted">
        Towns where this habitat is known to appear are listed first.
      </p>
      <div className="region-chips">
        {ordered.map((area) => (
          <button
            type="button"
            key={area}
            className="chip"
            aria-label={`Save ${habitat.name} in ${area}`}
            onClick={() => onChoose(area)}
          >
            {area}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export {
  filtersToQuery,
  filtersFromQuery,
  habitatDetailHref,
  habitatCatalogHref,
};
