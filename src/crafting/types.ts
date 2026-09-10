export type RecipeId = `recipe:${string}:default` | string;

export type UnresolvedIngredientKey = string & {
  readonly __unresolvedIngredient: unique symbol;
};

export type RecipeKind = "craft" | "cook" | "other" | "unknown";
export type KnowledgeStatus =
  | "documented"
  | "inferred"
  | "conflicting"
  | "unknown"
  | "partial";
export type CountProvenance =
  | "pokopiaapi"
  | "importer-default"
  | "serebii-item-page";

export interface FieldEvidence {
  sourceUrl: string | null;
  provider: string;
  sourceRevision?: string | null;
  checkedDate?: string;
  retrievedAt?: string;
  locator?: string;
  status?: KnowledgeStatus;
  note?: string;
}

export type IngredientIdentity =
  | { type: "resolved"; itemId: string }
  | { type: "unresolved"; key: UnresolvedIngredientKey };

export interface RecipeIngredient {
  rowId: string;
  originalLabel: string;
  identity: IngredientIdentity;
  quantity: number;
  countEvidence: FieldEvidence;
  locations: string[];
  locationEvidence: FieldEvidence | null;
}

export interface UnlockMethod {
  text: string;
  provider: string;
  sourceUrl: string;
  retrievedAt: string;
}

export interface RecipeUnlock {
  methods: UnlockMethod[];
  conflicts: UnlockMethod[];
}

export interface RecipeConflict {
  fields: string[];
  summary: string;
}

export interface NormalizedRecipe {
  id: RecipeId;
  outputItemId: string;
  outputName: string;
  categories: string[];
  source: string;
  kind: RecipeKind;
  kindEvidence: FieldEvidence;
  ingredients: RecipeIngredient[];
  specialty: string | null;
  unlock: RecipeUnlock;
  countProvenance: CountProvenance;
  conflicts: RecipeConflict[];
}

export interface CraftingUnavailable {
  recipeId: string;
  reason: string;
}

export interface CraftingState {
  version: 2;
  learnedRecipeIds: string[];
}

export interface CraftingQuarantine {
  raw: unknown;
  reason: string;
  quarantinedAt: string;
}

export const CRAFTING_STATE_VERSION = 2 as const;

export function emptyCraftingState(): CraftingState {
  return {
    version: CRAFTING_STATE_VERSION,
    learnedRecipeIds: [],
  };
}

export function defaultRecipeId(itemId: string): RecipeId {
  return `recipe:${itemId}:default`;
}

export function unresolvedIngredientKey(
  recipeId: string,
  rowId: string,
): UnresolvedIngredientKey {
  return `unresolved:${recipeId}:${rowId}` as UnresolvedIngredientKey;
}

export function recipeHref(recipeId: string) {
  return `#/crafting/recipe/${encodeURIComponent(recipeId)}`;
}

export const NOT_YET_DOCUMENTED = "Not yet documented";
export const NOT_MARKED_LEARNED = "Not marked learned";
export const ITEM_MATCH_UNDOCUMENTED = "Item match not yet documented.";
export const UNLOCK_RECORDED = "Unlock recorded";
export const UNLOCK_EMPTY_WHY =
  "Unlock guidance has not yet been documented in this companion. It is not guessed from where the finished item can be found.";

export const HABITAT_HOUSE_GATHERED_DISCLOSURE =
  "Gathered counts here are list progress only — how much of this list you consider covered.";
