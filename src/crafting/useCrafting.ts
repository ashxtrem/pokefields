import { useMemo } from "react";
import { useCatalog } from "../catalog/context";
import { useProgress } from "../progress/context";
import { listRecipes } from "./catalog";
import { emptyCraftingState } from "./types";

export function useCrafting() {
  const catalog = useCatalog();
  const progress = useProgress();
  const recipes = useMemo(() => listRecipes(catalog), [catalog]);
  const crafting = progress.state.crafting || emptyCraftingState();
  return {
    catalog,
    recipes,
    crafting,
    recipeById: (id: string) => recipes.find((recipe) => recipe.id === id),
    ...progress,
  };
}
