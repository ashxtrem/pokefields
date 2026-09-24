import type { Catalog } from "../catalog/types";
import { listCanonicalHabitats } from "./catalog";
import { locationsForHabitat } from "./locations";
import type { HabitatCatalogFilters, HabitatLocationRecord } from "./types";
import type { CanonicalHabitat } from "./types";

export function habitatDexNumber(image: string | null): number | null {
  if (!image) return null;
  const name = image.split(/[/?#]/).filter(Boolean).pop() || "";
  const match = name.match(/^(\d+)\.png$/i);
  return match ? Number(match[1]) : null;
}

function compareByHabitatId(a: CanonicalHabitat, b: CanonicalHabitat) {
  const na = habitatDexNumber(a.image);
  const nb = habitatDexNumber(b.image);
  if (na != null && nb != null && na !== nb) return na - nb;
  if (na != null && nb == null) return -1;
  if (na == null && nb != null) return 1;
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function matchesSearch(
  catalog: Catalog,
  habitatId: string,
  habitatName: string,
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (habitatName.toLowerCase().includes(q)) return true;
  const canonical = listCanonicalHabitats(catalog).find((h) => h.id === habitatId);
  if (!canonical) return false;
  return canonical.associations.some((a) => {
    const p = catalog.pokemon.find((x) => x.id === a.pokemonId);
    return p?.name.toLowerCase().includes(q) || p?.number.toLowerCase().includes(q);
  });
}

function unfoundCount(
  catalog: Catalog,
  habitatId: string,
  found: Record<string, string[]>,
  region: string,
) {
  const canonical = listCanonicalHabitats(catalog).find((h) => h.id === habitatId);
  if (!canonical) return 0;
  const pokemonIds = [
    ...new Set(
      canonical.associations
        .filter((a) => !region || !a.areas.length || a.areas.includes(region))
        .map((a) => a.pokemonId),
    ),
  ];
  return pokemonIds.filter((id) => !(found[id]?.length > 0)).length;
}

/**
 * Available here: catalog discovery-region membership. Saved here: the
 * player's own habitat location records. `Region not recorded` keeps a
 * meaning in both — a catalog gap under Available here, a migrated
 * regionless location under Saved here (§3.1).
 */
export function filterHabitats(
  catalog: Catalog,
  locations: Record<string, HabitatLocationRecord>,
  found: Record<string, string[]>,
  filters: HabitatCatalogFilters,
) {
  const all = listCanonicalHabitats(catalog);
  let results = all.filter((habitat) => {
    if (!matchesSearch(catalog, habitat.id, habitat.name, filters.search))
      return false;

    if (filters.region) {
      if (filters.scope === "available") {
        if (filters.region === "__none__") {
          if (!habitat.regionNotRecorded) return false;
        } else if (!habitat.discoveryRegions.includes(filters.region)) {
          return false;
        }
      } else {
        const rows = locationsForHabitat(locations, habitat.id);
        if (filters.region === "__none__") {
          if (!rows.some((r) => r.region === null)) return false;
        } else if (!rows.some((r) => r.region === filters.region)) {
          return false;
        }
      }
    } else if (filters.scope === "saved") {
      if (!locationsForHabitat(locations, habitat.id).length) return false;
    }

    if (filters.unfoundOnly) {
      const region =
        filters.region && filters.region !== "__none__" ? filters.region : "";
      if (unfoundCount(catalog, habitat.id, found, region) === 0) return false;
    }
    return true;
  });

  results = [...results].sort((a, b) => {
    if (filters.sort === "unfound") {
      const region =
        filters.region && filters.region !== "__none__" ? filters.region : "";
      const ua = unfoundCount(catalog, a.id, found, region);
      const ub = unfoundCount(catalog, b.id, found, region);
      if (ub !== ua) return ub - ua;
    }
    if (filters.sort === "name") {
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    }
    return compareByHabitatId(a, b);
  });
  return results;
}

export function filtersToQuery(filters: HabitatCatalogFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.region) params.set("region", filters.region);
  if (filters.unfoundOnly) params.set("unfound", "1");
  if (filters.scope !== "available") params.set("scope", filters.scope);
  if (filters.sort !== "id") params.set("sort", filters.sort);
  return params.toString();
}

function sortFromQuery(value: string | null): HabitatCatalogFilters["sort"] {
  if (value === "unfound" || value === "name") return value;
  return "id";
}

/** Accepts the current `scope` param and the old `regionMode=builds` URLs as Saved here. */
function scopeFromQuery(
  params: URLSearchParams,
): HabitatCatalogFilters["scope"] {
  if (params.get("scope") === "saved") return "saved";
  if (params.get("regionMode") === "builds") return "saved";
  return "available";
}

export function filtersFromQuery(search: string): HabitatCatalogFilters {
  const params = new URLSearchParams(search);
  return {
    search: params.get("q") || "",
    region: params.get("region") || "",
    unfoundOnly: params.get("unfound") === "1",
    scope: scopeFromQuery(params),
    sort: sortFromQuery(params.get("sort")),
  };
}

export function habitatCatalogHref(filters: HabitatCatalogFilters) {
  const query = filtersToQuery(filters);
  return query ? `#/habitats?${query}` : "#/habitats";
}

export function habitatDetailHref(habitatId: string, filters?: HabitatCatalogFilters) {
  const query = filters ? filtersToQuery(filters) : "";
  return query
    ? `#/habitats/${encodeURIComponent(habitatId)}?${query}`
    : `#/habitats/${encodeURIComponent(habitatId)}`;
}
