import type { Habitat } from "../catalog/types";

export interface NormalizedRequirement {
  id: string;
  signature: string;
  raw: string;
  label: string;
  kind: "item" | "condition" | "review";
  itemId: string | null;
  quantity: number | null;
}

export type HabitatLocationFlag =
  | "Choose a region"
  | "Habitat missing from catalog"
  | "Possible duplicate";

export interface HabitatLocationRecord {
  id: string;
  habitatId: string;
  habitatNameSnapshot: string;
  region: string | null;
  note: string;
  copies: number;
  createdAt: string;
  updatedAt: string;
  reviewFlags?: HabitatLocationFlag[];
}

export interface HabitatAssociation {
  pokemonId: string;
  areas: string[];
  rarity: string;
  times: string[];
  weather: string[];
  inheritedTimes: boolean;
  inheritedWeather: boolean;
}

export interface CanonicalHabitat {
  id: string;
  name: string;
  image: string | null;
  source: string;
  requirements: string[];
  discoveryRegions: string[];
  regionNotRecorded: boolean;
  associations: HabitatAssociation[];
  possiblePokemonCount: number;
  conflicts: string[];
  representative: Habitat;
}

export type HabitatCatalogFilters = {
  search: string;
  region: string;
  unfoundOnly: boolean;
  scope: "available" | "saved";
  sort: "id" | "name" | "unfound";
};

export const defaultHabitatFilters = (): HabitatCatalogFilters => ({
  search: "",
  region: "",
  unfoundOnly: false,
  scope: "available",
  sort: "id",
});
