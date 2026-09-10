import { useLayoutEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Empty, ItemThumb } from "../ui/components";
import { useViewState } from "../ui/navigation";
import { recipeCategories } from "./catalog";
import { hasRecordedUnlock } from "./locations";
import {
  activeFilterCount,
  defaultRecipeFilters,
  filterRecipes,
  type RecipeFilters,
} from "./search";
import {
  NOT_YET_DOCUMENTED,
  UNLOCK_RECORDED,
  recipeHref,
  type CraftingState,
  type NormalizedRecipe,
} from "./types";

export function RecipesPanel({
  recipes,
  crafting,
  selectedId,
  announcement,
  usesItemId,
}: {
  recipes: NormalizedRecipe[];
  crafting: CraftingState;
  selectedId?: string;
  announcement: string;
  usesItemId?: string;
}) {
  const [filters, setFilters] = useViewState(
    "crafting.filters",
    defaultRecipeFilters,
  );
  const [listScroll, setListScroll] = useViewState("crafting.listScroll", 0);
  const listRef = useRef<HTMLDivElement>(null);
  const merged = { ...filters, usesItemId: usesItemId || "" };
  const categories = recipeCategories(recipes);
  const learnedCount = crafting.learnedRecipeIds.filter((id) =>
    recipes.some((recipe) => recipe.id === id),
  ).length;
  const recorded = recipes.filter(hasRecordedUnlock).length;
  const results = filterRecipes(recipes, crafting.learnedRecipeIds, merged);
  const active = activeFilterCount(merged);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listScroll;
  }, []);

  const update = (patch: Partial<RecipeFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="crafting-recipes">
      <div className="search-row crafting-tools">
        <div className="search-box">
          <Search size={19} />
          <input
            type="text"
            aria-label="Search recipes by item name"
            placeholder="Search recipes…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          {filters.search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => update({ search: "" })}
            >
              ×
            </button>
          ) : null}
        </div>
        <select
          aria-label="Category"
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.uncategorized ? (
            <option value="uncategorized">Uncategorized</option>
          ) : null}
          {categories.names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Recipe order"
          value={filters.sort}
          onChange={(e) =>
            update({ sort: e.target.value as RecipeFilters["sort"] })
          }
        >
          <option value="guidance">Recorded guidance first</option>
          <option value="name">Name A–Z</option>
        </select>
        <button
          type="button"
          className="crafting-hide"
          aria-pressed={filters.hideLearned}
          onClick={() => update({ hideLearned: !filters.hideLearned })}
        >
          Hide learned
        </button>
      </div>
      <p className="crafting-learned-count">
        Showing {results.length} of {recipes.length}. {recorded} have unlock
        guidance; {recipes.length - recorded} do not. {learnedCount} marked
        learned
        {active ? `. ${active} filters on` : "."}
      </p>
      {merged.usesItemId ? (
        <p className="notice">
          Showing recipes that use this material.
          <a className="text-button" href="#/crafting">
            Clear material filter
          </a>
        </p>
      ) : null}
      {active || filters.search ? (
        <div className="results-bar">
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(defaultRecipeFilters())}
          >
            Clear filters
          </button>
        </div>
      ) : null}
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      {!results.length ? (
        <Empty title="No recipes match these filters">
          Clear a filter or search for another item name.
        </Empty>
      ) : (
        <div
          ref={listRef}
          className="crafting-result-list"
          role="list"
          onScroll={(e) => setListScroll(e.currentTarget.scrollTop)}
        >
          {results.map((recipe) => (
            <a
              key={recipe.id}
              href={recipeHref(recipe.id)}
              className={`crafting-row ${selectedId === recipe.id ? "selected" : ""}`}
              role="listitem"
              aria-current={selectedId === recipe.id ? "page" : undefined}
            >
              <ItemThumb id={recipe.outputItemId} name={recipe.outputName} />
              <span className="crafting-row-copy">
                <strong>{recipe.outputName}</strong>
                <small>
                  {recipe.categories.join(" · ") || "Uncategorized"}
                </small>
              </span>
              <span
                className={`crafting-chip ${hasRecordedUnlock(recipe) ? "known" : "mark"}`}
              >
                {hasRecordedUnlock(recipe) ? UNLOCK_RECORDED : NOT_YET_DOCUMENTED}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
