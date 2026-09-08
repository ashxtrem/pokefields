import type { Pokemon } from "../catalog/types";
export interface Filters {
  search: string;
  dex: string;
  status: string;
  foundArea: string;
  spawnArea: string;
  specialty: string;
  type: string;
  time: string;
  weather: string;
  sort: string;
}
export const defaultFilters: Filters = {
  search: "",
  dex: "regular",
  status: "all",
  foundArea: "",
  spawnArea: "",
  specialty: "",
  type: "",
  time: "",
  weather: "",
  sort: "number",
};
export function filterPokemon(
  pokemon: Pokemon[],
  found: Record<string, string[]>,
  f: Filters,
) {
  const q = f.search.toLowerCase().replace(/^#/, "").trim();
  return pokemon
    .filter(
      (p) =>
        (f.dex === "all" || p.dex === f.dex) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.id.includes(q) ||
          p.number.toLowerCase().includes(q) ||
          String(p.nationalNumber) === q) &&
        (f.status === "all" ||
          (f.status === "found"
            ? found[p.id]?.length
            : !found[p.id]?.length)) &&
        (!f.foundArea || found[p.id]?.includes(f.foundArea)) &&
        (!f.spawnArea || p.areas.includes(f.spawnArea)) &&
        (!f.specialty || p.specialties.includes(f.specialty)) &&
        (!f.type || p.types.includes(f.type)) &&
        (!f.time || p.times.includes(f.time)) &&
        (!f.weather || p.weather.includes(f.weather)),
    )
    .sort((a, b) =>
      f.sort === "name"
        ? a.name.localeCompare(b.name)
        : ["regular", "event", "basin"].indexOf(a.dex) -
            ["regular", "event", "basin"].indexOf(b.dex) ||
          a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
}
