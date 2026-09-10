import { useLayoutEffect, useMemo, useState } from "react";
import { useCatalog } from "../catalog/context";
import { RecipesPanel } from "../crafting/RecipesPanel";
import { MissingRecipe, RecipeDetail } from "../crafting/RecipeDetail";
import { useCrafting } from "../crafting/useCrafting";
import { toggleLearned } from "../crafting/learned";
import type { NormalizedRecipe } from "../crafting/types";
import {
  isUnmodifiedLeftClick,
  parseRoute,
  useViewState,
  type ParsedRoute,
} from "../ui/navigation";
import { isCollected, toggleCollected } from "./collected";
import { ItemDetail, MissingItem } from "./ItemDetail";
import { ItemsPanel } from "./ItemsPanel";
import {
  ITEM_TAB_DEFS,
  defaultItemTabRoutes,
  itemInTab,
  itemsListHref,
  rememberedItemTabHref,
  tabCounts,
  tabFromQuery,
  type ItemTab,
} from "./tabs";

const TAB_COPY: Record<
  ItemTab,
  { eyebrow: string; title: string; mark: "?" | "."; body: string }
> = {
  all: {
    eyebrow: "EVERYTHING ON RECORD",
    title: "What is this, and how do I get it",
    mark: "?",
    body: "Look up any item in the catalog — materials, furniture, kits, and the many things that have no recipe of their own.",
  },
  crafting: {
    eyebrow: "BESIDE THE WORKBENCH",
    title: "How do I get this recipe",
    mark: "?",
    body: "The game already shows you what a recipe costs. This shows how the recipe is unlocked, and where each material comes from.",
  },
  food: {
    eyebrow: "THE COOKING POT",
    title: "Food and the dishes you cook",
    mark: ".",
    body: "Ingredients, snacks, and cooked dishes. Cooking recipes stay on their own page, the same way other recipes do.",
  },
  buildings: {
    eyebrow: "KITS AND STRUCTURES",
    title: "What can I build here",
    mark: "?",
    body: "Building kits and the structures they make. Homes the planner can place stay residences; stages and centres are documented here without being offered as houses.",
  },
  collectibles: {
    eyebrow: "NUMBERED SETS",
    title: "How much of the set is documented",
    mark: "?",
    body: "Music CDs, relics, fossils, and key items. Coverage is what the source recorded, not a claim that a set is complete.",
  },
};

export function ItemsPage({ route }: { route: ParsedRoute }) {
  const catalog = useCatalog();
  const { recipes, crafting, ready, updateWithUndo, recipeById, state } =
    useCrafting();
  const [announcement, setAnnouncement] = useState("");
  const [tabRoutes, setTabRoutes] = useViewState(
    "items.tabRoutes",
    defaultItemTabRoutes,
  );
  const requested = tabFromQuery(route.query);
  const tab =
    route.page === "items-recipe" &&
    !new URLSearchParams(route.query).get("tab")
      ? "crafting"
      : requested;
  const copy = TAB_COPY[tab];
  const counts = useMemo(() => tabCounts(catalog.items), [catalog.items]);
  const uses = useMemo(() => {
    if (route.page !== "items" && route.page !== "items-recipe") return "";
    return new URLSearchParams(route.query).get("uses") || "";
  }, [route]);
  const selectedRecipeId =
    route.page === "items-recipe" ? route.recipeId : undefined;
  const selectedRecipe = selectedRecipeId
    ? recipeById(selectedRecipeId)
    : undefined;
  const selectedItemId =
    route.page === "item-detail" ? route.itemId : undefined;
  const selectedItem = selectedItemId
    ? catalog.items.find((item) => item.id === selectedItemId)
    : undefined;
  const detailActive =
    route.page === "items-recipe" || route.page === "item-detail";
  const collectedIds = state.collected || [];
  const itemAvailable = (href: string) => {
    const parsed = parseRoute(href);
    if (parsed.page === "item-detail")
      return catalog.items.some((item) => item.id === parsed.itemId);
    if (parsed.page === "items-recipe")
      return Boolean(recipeById(parsed.recipeId));
    return true;
  };

  useLayoutEffect(() => {
    const href = location.hash || itemsListHref(tab);
    setTabRoutes((current) =>
      current[tab] === href ? current : { ...current, [tab]: href },
    );
  }, [tab, route, setTabRoutes]);

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

  const onToggleCollected = (itemId: string, name: string) => {
    const next = toggleCollected(state.collected, itemId);
    const collected = next.includes(itemId);
    updateWithUndo(
      collected ? "Marked collected" : "Unmarked collected",
      (saved) => ({ ...saved, collected: next }),
      ["collected"],
    );
    setAnnouncement(
      collected
        ? `${name} marked collected. Undo is available.`
        : `${name} not marked collected. Undo is available.`,
    );
  };

  return (
    <div className={`crafting-page ${detailActive ? "is-detail" : "is-list"}`}>
      <div className="page-title crafting-title">
        <div>
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>
            {copy.title}
            <span className="dot">{copy.mark}</span>
          </h1>
          <p>{copy.body}</p>
        </div>
      </div>
      <nav className="tabs items-tabs" aria-label="Item sections">
        {ITEM_TAB_DEFS.map((def) => {
          const active = tab === def.id;
          const href = rememberedItemTabHref(def.id, tabRoutes, itemAvailable);
          return (
            <a
              key={def.id}
              href={href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (active && isUnmodifiedLeftClick(event)) event.preventDefault();
              }}
            >
              {def.label}{" "}
              <span>{counts[def.id]}</span>
            </a>
          );
        })}
      </nav>
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      <div className="crafting-split">
        {tab === "crafting" ? (
          <RecipesPanel
            recipes={recipes}
            crafting={crafting}
            selectedId={selectedRecipeId}
            announcement={announcement}
            usesItemId={uses}
          />
        ) : (
          <ItemsPanel
            key={tab}
            items={catalog.items}
            tab={tab}
            selectedId={selectedItemId}
            collectedIds={collectedIds}
          />
        )}
        <div className="crafting-detail-pane">
          {route.page === "items-recipe" && !selectedRecipe ? (
            <MissingRecipe recipeId={selectedRecipeId || ""} />
          ) : selectedRecipe ? (
            <RecipeDetail
              recipe={selectedRecipe}
              crafting={crafting}
              ready={ready}
              onToggleLearned={() => onToggleLearned(selectedRecipe)}
            />
          ) : route.page === "item-detail" && !selectedItem ? (
            <MissingItem itemId={selectedItemId || ""} tab={tab} />
          ) : selectedItem ? (
            <ItemDetail
              item={selectedItem}
              catalog={catalog}
              tab={tab}
              collected={isCollected(collectedIds, selectedItem.id)}
              ready={ready}
              onToggleCollected={
                itemInTab(selectedItem, "collectibles")
                  ? () => onToggleCollected(selectedItem.id, selectedItem.name)
                  : undefined
              }
            />
          ) : (
            <p className="muted crafting-pick">{pickPrompt(tab)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function pickPrompt(tab: ItemTab) {
  if (tab === "crafting")
    return "Choose a recipe to see how it is learned and where its materials come from.";
  if (tab === "collectibles")
    return "Choose a collectible to see its set, number, and how it is obtained.";
  if (tab === "buildings")
    return "Choose a building or kit to see how it is unlocked and what is documented to build it.";
  return "Choose an item to see what it is and how it is obtained.";
}
