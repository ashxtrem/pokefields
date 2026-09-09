import type { Catalog } from "../catalog/types";
import { listCanonicalHabitats } from "./catalog";
import { buildBadges, recordsForHabitat } from "./builds";
import type { HabitatCatalogFilters } from "./types";
import type { CanonicalHabitat, HabitatBuildRecord } from "./types";

export function habitatDexNumber(image: string | null): number | null {
  if (!image) return null;
  try {
    const name =
      new URL(image, "https://www.serebii.net").pathname.split("/").pop() || "";
    const match = name.match(/^(\d+)\.png$/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
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

function matchesStatus(
  badge: ReturnType<typeof buildBadges>,
  status: HabitatCatalogFilters["status"],
) {
  if (status === "all") return true;
  if (status === "none") return badge.planned === 0 && badge.built === 0;
  if (status === "planned") return badge.planned > 0;
  if (status === "built") return badge.built > 0;
  return true;
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

export function filterHabitats(
  catalog: Catalog,
  builds: Record<string, HabitatBuildRecord>,
  found: Record<string, string[]>,
  filters: HabitatCatalogFilters,
) {
  const all = listCanonicalHabitats(catalog);
  let results = all.filter((habitat) => {
    const records = recordsForHabitat(builds, habitat.id);
    const badge = buildBadges(records);
    if (!matchesSearch(catalog, habitat.id, habitat.name, filters.search))
      return false;
    if (!matchesStatus(badge, filters.status)) return false;

    if (filters.region) {
      if (filters.regionMode === "available") {
        if (
          filters.region !== "__none__" &&
          !habitat.discoveryRegions.includes(filters.region) &&
          !(filters.region === "all" && habitat.regionNotRecorded)
        ) {
          if (
            filters.region !== "all" &&
            !habitat.discoveryRegions.includes(filters.region)
          )
            return false;
        }
        if (
          filters.region !== "all" &&
          filters.region !== "__none__" &&
          !habitat.discoveryRegions.includes(filters.region) &&
          !habitat.regionNotRecorded
        )
          return false;
      } else {
        const inRegion = records.some(
          (r) => r.region === filters.region || (!r.region && filters.region === "__none__"),
        );
        if (!inRegion) return false;
      }
    }

    if (filters.unfoundOnly) {
      const region = filters.region && filters.region !== "all" ? filters.region : "";
      if (unfoundCount(catalog, habitat.id, found, region) === 0) return false;
    }
    return true;
  });

  if (filters.region === "__none__") {
    results = results.filter((h) => h.regionNotRecorded);
  } else if (filters.region && filters.region !== "all") {
    if (filters.regionMode === "available") {
      results = results.filter(
        (h) =>
          h.discoveryRegions.includes(filters.region) ||
          (h.regionNotRecorded && filters.region === "all"),
      );
    }
  }

  results = [...results].sort((a, b) => {
    if (filters.sort === "unfound") {
      const region =
        filters.region && filters.region !== "all" && filters.region !== "__none__"
          ? filters.region
          : "";
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
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.unfoundOnly) params.set("unfound", "1");
  if (filters.regionMode !== "available") params.set("regionMode", filters.regionMode);
  if (filters.sort !== "id") params.set("sort", filters.sort);
  return params.toString();
}

function sortFromQuery(value: string | null): HabitatCatalogFilters["sort"] {
  if (value === "unfound" || value === "name") return value;
  return "id";
}

export function filtersFromQuery(search: string): HabitatCatalogFilters {
  const params = new URLSearchParams(search);
  return {
    search: params.get("q") || "",
    region: params.get("region") || "",
    status: (params.get("status") as HabitatCatalogFilters["status"]) || "all",
    unfoundOnly: params.get("unfound") === "1",
    regionMode:
      params.get("regionMode") === "builds" ? "builds" : "available",
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
