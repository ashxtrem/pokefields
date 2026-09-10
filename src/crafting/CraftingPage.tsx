import { useMemo, useState } from "react";
import type { ParsedRoute } from "../ui/navigation";
import { RecipesPanel } from "./RecipesPanel";
import { MissingRecipe, RecipeDetail } from "./RecipeDetail";
import { useCrafting } from "./useCrafting";
import { toggleLearned } from "./learned";
import type { NormalizedRecipe } from "./types";

export function CraftingPage({ route }: { route: ParsedRoute }) {
  const { recipes, crafting, ready, updateWithUndo, recipeById } = useCrafting();
  const [announcement, setAnnouncement] = useState("");
  const selectedId =
    route.page === "crafting-recipe" ? route.recipeId : undefined;
  const selected = selectedId ? recipeById(selectedId) : undefined;
  const uses = useMemo(() => {
    if (route.page !== "crafting" && route.page !== "crafting-recipe") return "";
    return new URLSearchParams(route.query).get("uses") || "";
  }, [route]);

  const onToggleLearned = (recipe: NormalizedRecipe) => {
    const next = toggleLearned(crafting, recipe.id);
    const learned = next.learnedRecipeIds.includes(recipe.id);
    updateWithUndo(
      learned ? "Marked learned" : "Unmarked learned",
      (saved) => ({ ...saved, crafting: next }),
      ["crafting"],
    );
    setAnnouncement(
      learned
        ? `${recipe.outputName} marked learned. Undo is available.`
        : `${recipe.outputName} not marked learned. Undo is available.`,
    );
  };

  const detailActive = route.page === "crafting-recipe";

  return (
    <div className={`crafting-page ${detailActive ? "is-detail" : "is-list"}`}>
      <div className="page-title crafting-title">
        <div>
          <div className="eyebrow">BESIDE THE WORKBENCH</div>
          <h1>
            How do I get this recipe<span className="dot">?</span>
          </h1>
          <p>
            The game already shows you what a recipe costs. This shows how the
            recipe is unlocked, and where each material comes from.
          </p>
        </div>
      </div>
      <div className="crafting-split">
        <RecipesPanel
          recipes={recipes}
          crafting={crafting}
          selectedId={selectedId}
          announcement={announcement}
          usesItemId={uses}
        />
        <div className="crafting-detail-pane">
          {detailActive && !selected ? (
            <MissingRecipe recipeId={selectedId || ""} />
          ) : selected ? (
            <RecipeDetail
              recipe={selected}
              crafting={crafting}
              ready={ready}
              onToggleLearned={() => onToggleLearned(selected)}
            />
          ) : (
            <p className="muted crafting-pick">
              Choose a recipe to see how it is learned and where its materials
              come from.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
