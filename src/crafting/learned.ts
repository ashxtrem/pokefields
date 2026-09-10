import type { CraftingState } from "./types";

export function isLearned(state: CraftingState, recipeId: string) {
  return state.learnedRecipeIds.includes(recipeId);
}

export function toggleLearned(
  state: CraftingState,
  recipeId: string,
): CraftingState {
  const next = new Set(state.learnedRecipeIds);
  if (next.has(recipeId)) next.delete(recipeId);
  else next.add(recipeId);
  return { version: 2, learnedRecipeIds: [...next] };
}

export function visibleLearnedCount(
  learnedRecipeIds: string[],
  recipeIds: Iterable<string>,
) {
  const known = new Set(recipeIds);
  return learnedRecipeIds.filter((id) => known.has(id)).length;
}

export function unavailableLearned(
  learnedRecipeIds: string[],
  recipeIds: Iterable<string>,
) {
  const known = new Set(recipeIds);
  return learnedRecipeIds.filter((id) => !known.has(id));
}
