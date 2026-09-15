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
/** The move benefit stated for a cooked dish on Serebii's cooking table. */
export interface CookingEffect {
  description: string;
  measure: string;
  source: string;
  retrievedAt: string;
}
/** A numbered in-game set an item belongs to. Derived facts only. */
export interface ItemCollection {
  set: "music-cd";
  number: number;
}
export interface Item {
  id: string;
  name: string;
  /** Pokémon preference categories: what a Pokémon likes, not what this is. */
  categories: string[];
  /**
   * Serebii item-index sections this item is listed under, in source wording.
   * An item can belong to several. Absent or empty means unsorted; a section is
   * never inferred for it.
   */
  groups?: string[];
  /**
   * Theme tags (e.g. "fire", "flying") assigned by keyword-matching this
   * item's name against a fixed vocabulary. A heuristic browsing aid, not a
   * sourced fact like `groups` — see scripts/tag-items.mjs.
   */
  tags?: string[];
  collection?: ItemCollection;
  source: string;
  locations?: string[];
  recipe?: { name: string; quantity: number }[];
  recipeLocation?: string | null;
  recipeSpecialty?: string | null;
  cookingEffect?: CookingEffect;
  event?: string | null;
  recipeMeta?: ItemRecipeMeta;
}
export interface Material {
  name: string;
  quantity: number;
}
/**
 * "unknown" is a real state: some build pages leave the liveable-capacity cell
 * blank, which is not the same as a documented zero.
 */
export type KitKind = "residence" | "structure" | "unknown";
export interface Kit {
  id: string;
  name: string;
  /** Only residences house Pokémon; structures must never reach the planner. */
  kind: KitKind;
  /** Null when the source records no footprint, as on the Pokémon Center kits. */
  width: number | null;
  depth: number | null;
  height: number | null;
  /** Null when the source records no liveable capacity, as for structures. */
  capacity: number | null;
  helpers: number | null;
  specialties: string[];
  materials: Material[];
  buildTime: string | null;
  source: string;
}
/** A kit documented well enough to place: a home with a footprint and capacity. */
export interface PlannableKit extends Kit {
  kind: "residence";
  width: number;
  depth: number;
  height: number;
  capacity: number;
}
export function isResidence(kit: Kit): boolean {
  return kit.kind === "residence";
}
/**
 * The only kits the planner and its shopping lists may see. A structure is not
 * a home, and a residence with undocumented dimensions cannot be placed on the
 * grid; neither may reach placement. See docs/items-directory-plan.md 3.3.
 */
export function isPlannable(kit: Kit): kit is PlannableKit {
  return (
    kit.kind === "residence" &&
    typeof kit.width === "number" &&
    typeof kit.depth === "number" &&
    typeof kit.height === "number" &&
    typeof kit.capacity === "number" &&
    kit.capacity > 0
  );
}
export function plannableKits(kits: Kit[]): PlannableKit[] {
  return kits.filter(isPlannable);
}
/**
 * Placement rescans the kit list for every candidate square, so the filtered
 * lookup is memoized per catalog rather than rebuilt inside those loops.
 */
const plannableIndex = new WeakMap<Kit[], Map<string, PlannableKit>>();
export function plannableKitMap(kits: Kit[]): Map<string, PlannableKit> {
  let index = plannableIndex.get(kits);
  if (!index) {
    index = new Map(plannableKits(kits).map((kit) => [kit.id, kit]));
    plannableIndex.set(kits, index);
  }
  return index;
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
