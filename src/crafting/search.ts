import type { NormalizedRecipe } from "./types";
import { hasRecordedUnlock } from "./locations";

export interface RecipeFilters {
  search: string;
  category: string;
  hideLearned: boolean;
  sort: "guidance" | "name";
  usesItemId: string;
}

export const defaultRecipeFilters = (): RecipeFilters => ({
  search: "",
  category: "",
  hideLearned: false,
  sort: "guidance",
  usesItemId: "",
});

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function filterRecipes(
  recipes: NormalizedRecipe[],
  learnedIds: Iterable<string>,
  filters: RecipeFilters,
) {
  const learned = new Set(learnedIds);
  const q = normalizeSearch(filters.search);
  const matched = recipes.filter((recipe) => {
    if (q && !normalizeSearch(recipe.outputName).includes(q)) return false;
    if (filters.category === "uncategorized" && recipe.categories.length)
      return false;
    if (
      filters.category &&
      filters.category !== "uncategorized" &&
      !recipe.categories.includes(filters.category)
    )
      return false;
    if (filters.hideLearned && learned.has(recipe.id)) return false;
    if (filters.usesItemId) {
      const consumes = recipe.ingredients.some(
        (row) =>
          row.identity.type === "resolved" &&
          row.identity.itemId === filters.usesItemId,
      );
      if (!consumes) return false;
    }
    return true;
  });
  const order = new Map(recipes.map((recipe, index) => [recipe.id, index]));
  return matched.sort((a, b) => {
    if (filters.sort === "guidance") {
      const ag = hasRecordedUnlock(a) ? 0 : 1;
      const bg = hasRecordedUnlock(b) ? 0 : 1;
      if (ag !== bg) return ag - bg;
      return (order.get(a.id) || 0) - (order.get(b.id) || 0);
    }
    return a.outputName.localeCompare(b.outputName);
  });
}

export function activeFilterCount(filters: RecipeFilters) {
  return [
    filters.category,
    filters.hideLearned ? "hide" : "",
    filters.usesItemId,
  ].filter(Boolean).length;
}
