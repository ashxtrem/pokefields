import type { Catalog, Habitat, Pokemon } from "../catalog/types";
import type { CanonicalHabitat, HabitatAssociation } from "./types";

function reqKey(requirements: string[]) {
  return requirements.map((r) => r.replace(/\s+/g, " ").trim()).join("|");
}

function pickRepresentative(
  entries: { habitat: Habitat; pokemon: Pokemon }[],
): Habitat {
  const sorted = [...entries].sort(
    (a, b) => b.habitat.requirements.length - a.habitat.requirements.length,
  );
  return sorted[0].habitat;
}

export function buildHabitatIndex(
  catalog: Catalog,
): Map<string, CanonicalHabitat> {
  const groups = new Map<string, { habitat: Habitat; pokemon: Pokemon }[]>();
  for (const pokemon of catalog.pokemon) {
    for (const habitat of pokemon.habitats) {
      const list = groups.get(habitat.id) || [];
      list.push({ habitat, pokemon });
      groups.set(habitat.id, list);
    }
  }
  const index = new Map<string, CanonicalHabitat>();
  for (const [id, entries] of groups) {
    const names = new Set(entries.map((e) => e.habitat.name));
    const sources = new Set(entries.map((e) => e.habitat.source));
    const reqSets = new Set(entries.map((e) => reqKey(e.habitat.requirements)));
    const conflicts: string[] = [];
    if (names.size > 1)
      conflicts.push("Conflicting habitat names across associations");
    if (sources.size > 1)
      conflicts.push("Conflicting source URLs across associations");
    if (reqSets.size > 1)
      conflicts.push("Conflicting requirement sets across associations");
    const representative = pickRepresentative(entries);
    const pokemonIds = [...new Set(entries.map((e) => e.pokemon.id))];
    const associations: HabitatAssociation[] = entries.map(
      ({ habitat, pokemon }) => ({
        pokemonId: pokemon.id,
        areas: habitat.areas,
        rarity: habitat.rarity,
        times: habitat.times.length ? habitat.times : pokemon.times,
        weather: habitat.weather.length ? habitat.weather : pokemon.weather,
        inheritedTimes: !habitat.times.length && !!pokemon.times.length,
        inheritedWeather: !habitat.weather.length && !!pokemon.weather.length,
      }),
    );
    const discoveryRegions = [
      ...new Set(associations.flatMap((a) => a.areas)),
    ].sort();
    const regionNotRecorded = associations.some((a) => !a.areas.length);
    index.set(id, {
      id,
      name: representative.name,
      image: representative.image,
      source: representative.source,
      requirements: representative.requirements,
      discoveryRegions,
      regionNotRecorded,
      associations,
      possiblePokemonCount: pokemonIds.length,
      conflicts,
      representative,
    });
  }
  return index;
}

export function listCanonicalHabitats(catalog: Catalog) {
  return [...buildHabitatIndex(catalog).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getCanonicalHabitat(catalog: Catalog, habitatId: string) {
  return buildHabitatIndex(catalog).get(habitatId) || null;
}

export function associationsForRegion(
  habitat: CanonicalHabitat,
  region: string | null,
) {
  if (!region) return habitat.associations;
  return habitat.associations.filter(
    (a) => !a.areas.length || a.areas.includes(region),
  );
}

// 252 cards each resolving associations over the full species list adds up, so
// the id lookup is built once per catalog.
const pokemonIndexes = new WeakMap<Catalog, Map<string, Pokemon>>();

export function pokemonById(catalog: Catalog) {
  let index = pokemonIndexes.get(catalog);
  if (!index) {
    index = new Map(catalog.pokemon.map((p) => [p.id, p]));
    pokemonIndexes.set(catalog, index);
  }
  return index;
}
