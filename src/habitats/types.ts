import type { Habitat } from "../catalog/types";

export type BuildStatus = "planned" | "built";

export interface NormalizedRequirement {
  id: string;
  signature: string;
  raw: string;
  label: string;
  kind: "item" | "condition" | "review";
  itemId: string | null;
  quantity: number | null;
}

export interface RequirementAllocation {
  requirementId: string;
  signature: string;
  raw: string;
  label: string;
  kind: NormalizedRequirement["kind"];
  required: number;
  gathered: number;
}

export interface HabitatBuildSnapshot {
  habitatName: string;
  source: string;
  catalogVersion: string;
  requirements: NormalizedRequirement[];
}

export interface HabitatBuildRecord {
  id: string;
  habitatId: string;
  status: BuildStatus;
  region: string | null;
  copies: number;
  locationNote: string;
  createdAt: string;
  updatedAt: string;
  snapshot: HabitatBuildSnapshot;
  allocations: RequirementAllocation[];
  originPokemonId?: string;
  reviewFlags?: string[];
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

export type BuildBadge = {
  planned: number;
  built: number;
};

export type HabitatCatalogFilters = {
  search: string;
  region: string;
  status: "all" | "none" | "planned" | "built";
  unfoundOnly: boolean;
  regionMode: "available" | "builds";
  sort: "id" | "name" | "unfound";
};

export const defaultHabitatFilters = (): HabitatCatalogFilters => ({
  search: "",
  region: "",
  status: "all",
  unfoundOnly: false,
  regionMode: "available",
  sort: "id",
});
