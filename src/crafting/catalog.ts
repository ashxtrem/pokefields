import type { Catalog, Item, ItemRecipeMeta } from "../catalog/types";
import {
  buildItemIndex,
  itemById,
  resolveExactItemId,
  type ItemIndex,
} from "./identity";
import enrichmentJson from "./data/enrichment.json";
import {
  defaultRecipeId,
  unresolvedIngredientKey,
  type CountProvenance,
  type FieldEvidence,
  type NormalizedRecipe,
  type RecipeConflict,
  type RecipeIngredient,
  type RecipeKind,
  type RecipeUnlock,
  type UnlockMethod,
} from "./types";

const enrichmentFile = enrichmentJson as {
  reviewedAt: string;
  records: Record<string, ItemRecipeMeta>;
};

function evidence(
  partial: Partial<FieldEvidence> & Pick<FieldEvidence, "provider">,
): FieldEvidence {
  return {
    sourceUrl: partial.sourceUrl ?? null,
    provider: partial.provider,
    sourceRevision: partial.sourceRevision,
    checkedDate: partial.checkedDate ?? enrichmentFile.reviewedAt,
    retrievedAt: partial.retrievedAt,
    locator: partial.locator,
    status: partial.status,
    note: partial.note,
  };
}

function overlayFor(item: Item): ItemRecipeMeta {
  return {
    ...(enrichmentFile.records[item.id] || {}),
    ...(item.recipeMeta || {}),
  };
}

function kindFromItem(
  item: Item,
  overlay: ItemRecipeMeta,
): { kind: RecipeKind; evidence: FieldEvidence } {
  if (overlay.kind) {
    return {
      kind: overlay.kind,
      evidence: overlay.kindEvidence
        ? evidence({
            provider: overlay.kindEvidence.provider,
            status: overlay.kindEvidence.status,
            locator: overlay.kindEvidence.locator,
            sourceUrl: overlay.kindEvidence.sourceUrl ?? item.source,
            retrievedAt: overlay.kindEvidence.retrievedAt,
            checkedDate: overlay.kindEvidence.checkedDate,
            note: overlay.kindEvidence.note,
          })
        : evidence({
            provider: "reviewed enrichment",
            status: overlay.kind === "unknown" ? "unknown" : "documented",
            locator: `recipeMeta.kind for ${item.id}`,
            sourceUrl: item.source,
          }),
    };
  }
  const text = (item.locations || []).join(" ");
  if (/cook with ingredients/i.test(text)) {
    return {
      kind: "cook",
      evidence: evidence({
        provider: "Serebii cooking table via catalog locations",
        status: "documented",
        locator: "locations includes Cook with ingredients",
        sourceUrl: item.source,
      }),
    };
  }
  if (/craft from recipe/i.test(text)) {
    return {
      kind: "craft",
      evidence: evidence({
        provider: "catalog locations",
        status: "documented",
        locator: "locations includes Craft from recipe",
        sourceUrl: item.source,
      }),
    };
  }
  return {
    kind: "unknown",
    evidence: evidence({
      provider: "catalog",
      status: "unknown",
      locator: "no documented kind signal",
      sourceUrl: item.source,
      note: "Kind is not inferred from style categories.",
    }),
  };
}

function unlockFromItem(item: Item, overlay: ItemRecipeMeta): RecipeUnlock {
  const methods = (overlay.unlock?.methods || []).filter(
    (row): row is UnlockMethod => Boolean(row?.text),
  );
  const conflicts = (overlay.unlock?.conflicts || []).filter(
    (row): row is UnlockMethod => Boolean(row?.text),
  );
  if (methods.length || conflicts.length) return { methods, conflicts };
  const legacy = item.recipeLocation?.trim() || "";
  if (legacy) {
    const method: UnlockMethod = {
      text: legacy,
      provider: "PokopiaAPI",
      sourceUrl: item.source,
      retrievedAt:
        overlay.locationEvidence?.retrievedAt ||
        overlay.locationEvidence?.checkedDate ||
        enrichmentFile.reviewedAt,
    };
    return { methods: [method], conflicts: [] };
  }
  return { methods: [], conflicts: [] };
}

function countProvenanceOf(
  item: Item,
  overlay: ItemRecipeMeta,
  kind: RecipeKind,
): CountProvenance {
  if (overlay.countProvenance) return overlay.countProvenance;
  if (kind === "cook") return "importer-default";
  return "pokopiaapi";
}

function normalizeIngredient(
  part: { name: string; quantity: number },
  index: number,
  recipeId: string,
  indexMap: ItemIndex,
  item: Item,
  overlay: ItemRecipeMeta,
  provenance: CountProvenance,
  conflicting: boolean,
): RecipeIngredient {
  const rowId = `${recipeId}:row:${index}`;
  const itemId = resolveExactItemId(part.name, indexMap);
  const quantity =
    typeof part.quantity === "number" &&
    Number.isSafeInteger(part.quantity) &&
    part.quantity > 0
      ? part.quantity
      : 0;
  const identity = itemId
    ? ({ type: "resolved", itemId } as const)
    : ({
        type: "unresolved",
        key: unresolvedIngredientKey(recipeId, rowId),
      } as const);
  const material = itemId ? itemById(indexMap, itemId) : undefined;
  const locations = material?.locations || [];
  return {
    rowId,
    originalLabel: part.name,
    identity,
    quantity,
    countEvidence: evidence({
      provider:
        provenance === "importer-default"
          ? "importer default"
          : "PokopiaAPI pinned snapshot",
      status: conflicting
        ? "conflicting"
        : provenance === "importer-default"
          ? "inferred"
          : quantity > 0
            ? "documented"
            : "unknown",
      locator: `recipe[${index}]`,
      sourceUrl: item.source,
      note:
        provenance === "importer-default"
          ? "Cooking table quantities were importer defaults of 1, not observed per-craft counts."
          : undefined,
    }),
    locations,
    locationEvidence: locations.length
      ? evidence({
          provider:
            overlay.locationEvidence?.provider || "PokopiaAPI pinned snapshot",
          status: overlay.locationEvidence?.status || "documented",
          locator: overlay.locationEvidence?.locator || "items.json locations",
          sourceUrl:
            overlay.locationEvidence?.sourceUrl ?? material?.source ?? item.source,
          retrievedAt: overlay.locationEvidence?.retrievedAt,
          checkedDate: overlay.locationEvidence?.checkedDate,
        })
      : null,
  };
}

export function isRecipeCandidate(item: Item) {
  return Boolean(item.recipe && item.recipe.length > 0);
}

export function normalizeItemRecipe(
  item: Item,
  items: Item[] | ItemIndex,
): NormalizedRecipe | null {
  if (!isRecipeCandidate(item)) return null;
  const index = Array.isArray(items) ? buildItemIndex(items) : items;
  const overlay = overlayFor(item);
  const id = defaultRecipeId(item.id);
  const { kind, evidence: kindEvidence } = kindFromItem(item, overlay);
  const conflicts: RecipeConflict[] = overlay.conflicts || [];
  const conflictingBundle = conflicts.some((row) =>
    row.fields.includes("ingredients"),
  );
  const provenance = countProvenanceOf(item, overlay, kind);
  const ingredients = item.recipe!.map((part, indexRow) =>
    normalizeIngredient(
      part,
      indexRow,
      id,
      index,
      item,
      overlay,
      provenance,
      conflictingBundle,
    ),
  );
  return {
    id,
    outputItemId: item.id,
    outputName: item.name,
    categories: item.categories || [],
    source: item.source,
    kind,
    kindEvidence,
    ingredients,
    specialty: overlay.specialty ?? item.recipeSpecialty ?? null,
    unlock: unlockFromItem(item, overlay),
    countProvenance: provenance,
    conflicts,
  };
}

export function listRecipes(catalog: Catalog): NormalizedRecipe[] {
  const index = buildItemIndex(catalog.items);
  return catalog.items
    .map((item) => normalizeItemRecipe(item, index))
    .filter((recipe): recipe is NormalizedRecipe => Boolean(recipe));
}

export function recipeById(
  catalog: Catalog,
  recipeId: string,
): NormalizedRecipe | undefined {
  return listRecipes(catalog).find((recipe) => recipe.id === recipeId);
}

export function recipesForOutputItem(
  catalog: Catalog,
  itemId: string,
): NormalizedRecipe[] {
  return listRecipes(catalog).filter((recipe) => recipe.outputItemId === itemId);
}

export function recipesConsumingItem(
  catalog: Catalog,
  itemId: string,
): NormalizedRecipe[] {
  return listRecipes(catalog).filter((recipe) =>
    recipe.ingredients.some(
      (row) => row.identity.type === "resolved" && row.identity.itemId === itemId,
    ),
  );
}

export function recipeCategories(recipes: NormalizedRecipe[]) {
  const names = new Set<string>();
  let uncategorized = false;
  for (const recipe of recipes) {
    if (!recipe.categories.length) uncategorized = true;
    for (const category of recipe.categories) names.add(category);
  }
  return {
    names: [...names].sort(),
    uncategorized,
  };
}
