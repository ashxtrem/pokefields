/**
 * Shapes for tracker data that is no longer active: the old habitat build
 * planner/recorder and the old checkbox/quantity shopping checklists. Kept
 * only so validators can accept legacy backups and the migration
 * (`src/habitats/migration.ts`) can read them before moving them into
 * `habitatBuildLegacySnapshot` / `houseShoppingLegacySnapshot`. Nothing
 * active reads these types.
 */

export type LegacyBuildStatus = "planned" | "built";

export interface LegacyNormalizedRequirement {
  id: string;
  signature: string;
  raw: string;
  label: string;
  kind: "item" | "condition" | "review";
  itemId: string | null;
  quantity: number | null;
}

export interface LegacyRequirementAllocation {
  requirementId: string;
  signature: string;
  raw: string;
  label: string;
  kind: LegacyNormalizedRequirement["kind"];
  required: number;
  gathered: number;
}

export interface LegacyHabitatBuildSnapshot {
  habitatName: string;
  source: string;
  catalogVersion: string;
  requirements: LegacyNormalizedRequirement[];
}

export interface LegacyHabitatBuildRecord {
  id: string;
  habitatId: string;
  status: LegacyBuildStatus;
  region: string | null;
  copies: number;
  locationNote: string;
  createdAt: string;
  updatedAt: string;
  snapshot: LegacyHabitatBuildSnapshot;
  allocations: LegacyRequirementAllocation[];
  originPokemonId?: string;
  reviewFlags?: string[];
}

export interface QuantityRow {
  id: string;
  label: string;
  quantity: number;
  gathered: number;
  signature: string;
}

export interface HouseQuantityList {
  planId: string;
  construction: QuantityRow[];
  furnishings: QuantityRow[];
  environment: QuantityRow[];
}

export interface ShoppingRow {
  id: string;
  label: string;
  quantity: number | null;
  checked: boolean;
}

export interface HabitatChecklist {
  id: string;
  pokemonId: string;
  habitatId: string;
  habitatName: string;
  rows: ShoppingRow[];
}

export interface HouseChecklist {
  planId: string;
  construction: ShoppingRow[];
  furnishings: ShoppingRow[];
}

export interface ShoppingChecklists {
  habitats: Record<string, HabitatChecklist>;
  house?: HouseChecklist;
}
