export type Dex = "regular" | "event" | "basin";
export interface Habitat {
  id: string;
  name: string;
  image: string | null;
  source: string;
  requirements: string[];
  areas: string[];
  rarity: string;
  times: string[];
  weather: string[];
}
export interface Pokemon {
  id: string;
  name: string;
  number: string;
  nationalNumber: number | null;
  dex: Dex;
  image: string | null;
  types: string[];
  specialties: string[];
  environment: string | null;
  favorites: string[];
  food: string | null;
  habitats: Habitat[];
  areas: string[];
  times: string[];
  weather: string[];
  height: number | null;
  weight: number | null;
  forms: string[];
  source: string;
  partial: boolean;
  additionalSources?: string[];
  event?: string | null;
  contentSource?: string;
  availability?: {
    start?: string;
    end?: string;
    [key: string]: unknown;
  } | null;
  produces?: unknown;
}
export type RecipeKindHint = "craft" | "cook" | "other" | "unknown";
export type RecipeKnowledgeStatus =
  | "documented"
  | "inferred"
  | "conflicting"
  | "unknown"
  | "partial";
export interface RecipeFieldEvidenceJson {
  sourceUrl?: string | null;
  provider: string;
  sourceRevision?: string | null;
  checkedDate?: string;
  retrievedAt?: string;
  locator?: string;
  status?: RecipeKnowledgeStatus;
  note?: string;
}
export interface RecipeConflictJson {
  fields: string[];
  summary: string;
}
export interface RecipeUnlockMethodJson {
  text: string;
  provider: string;
  sourceUrl: string;
  retrievedAt: string;
}
/** Reviewed overlay kept on catalog items so later imports cannot drop it. */
export interface ItemRecipeMeta {
  kind?: RecipeKindHint;
  kindEvidence?: RecipeFieldEvidenceJson;
  specialty?: string | null;
  unlock?: {
    methods: RecipeUnlockMethodJson[];
    conflicts: RecipeUnlockMethodJson[];
  };
  countProvenance?: "pokopiaapi" | "importer-default" | "serebii-item-page";
  locationEvidence?: RecipeFieldEvidenceJson;
  conflicts?: RecipeConflictJson[];
  extraction?: {
    itemPage?: string;
    craftingIndex?: boolean;
    apiUnlock?: boolean;
  };
  evidence?: Record<string, RecipeFieldEvidenceJson>;
}
export interface Item {
  id: string;
  name: string;
  categories: string[];
  source: string;
  locations?: string[];
  recipe?: { name: string; quantity: number }[];
  recipeLocation?: string | null;
  recipeSpecialty?: string | null;
  event?: string | null;
  recipeMeta?: ItemRecipeMeta;
}
export interface Material {
  name: string;
  quantity: number;
}
export interface Kit {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  capacity: number;
  helpers: number;
  specialties: string[];
  materials: Material[];
  buildTime: string;
  source: string;
}
export interface Catalog {
  version: string;
  pokemon: Pokemon[];
  kits: Kit[];
  items: Item[];
  areas: string[];
  sources: { name: string; url: string }[];
}
export const DEX_NAMES: Record<Dex, string> = {
  regular: "Main Pokédex",
  event: "Event Pokédex",
  basin: "Basin Pokédex",
};
