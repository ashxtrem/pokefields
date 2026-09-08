export interface Plot {
  width: number;
  depth: number;
}
export interface KitChoice {
  id: string;
  limit: number | null;
}
export interface Home {
  id: string;
  kitId: string;
  x: number;
  y: number;
  residents: string[];
}
export interface PlannerInput {
  area: string;
  roster: string[];
  sourceRoster?: string[];
  plot: Plot;
  kits: KitChoice[];
}
export interface Plan extends PlannerInput {
  homes: Home[];
  unplaced: { id: string; reason: string }[];
  catalogVersion: string;
  createdAt: string;
}

export const HOUSEMATE_PLAN_VERSION = 1 as const;
export type PreferenceMatch = "shared" | "different" | "unknown";
export interface RecommendedHome {
  id: string;
  kitId: string;
  residents: string[];
}
export interface UnresolvedResident {
  id: string;
  reason: string;
}
export interface HousematePlan {
  version: typeof HOUSEMATE_PLAN_VERSION;
  roster: string[];
  sourceRoster: string[];
  areaFilter: string | null;
  homes: RecommendedHome[];
  unresolved: UnresolvedResident[];
  catalogVersion: string;
  createdAt: string;
  updatedAt: string;
  convertedFrom?: string;
}
