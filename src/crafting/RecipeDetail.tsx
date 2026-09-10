import { useState } from "react";
import { ItemThumb } from "../ui/components";
import { itemHref, itemsListHref } from "../items/tabs";
import { ingredientCountLabel, summarizeLocations } from "./locations";
import { isLearned } from "./learned";
import {
  ITEM_MATCH_UNDOCUMENTED,
  NOT_YET_DOCUMENTED,
  UNLOCK_EMPTY_WHY,
  type CraftingState,
  type NormalizedRecipe,
  type RecipeIngredient,
  type UnlockMethod,
} from "./types";

export function RecipeDetail({
  recipe,
  crafting,
  onToggleLearned,
  ready,
}: {
  recipe: NormalizedRecipe;
  crafting: CraftingState;
  onToggleLearned: () => void;
  ready: boolean;
}) {
  const learned = isLearned(crafting, recipe.id);
  const importerDefault = recipe.countProvenance === "importer-default";
  return (
    <article className="crafting-detail">
      <a className="back-link crafting-back" href={itemsListHref("crafting")}>
        ← Back to recipes
      </a>
      <div className="crafting-detail-head">
        <ItemThumb id={recipe.outputItemId} name={recipe.outputName} large />
        <div>
          <h2>{recipe.outputName}</h2>
          <p className="crafting-cats">
            {recipe.categories.join(" · ") || "Uncategorized"}
          </p>
          <p>
            <a href={itemHref(recipe.outputItemId, "crafting")}>Item page</a>
          </p>
        </div>
      </div>

      <h3>How to learn this recipe</h3>
      <UnlockBlock recipe={recipe} />

      <h3>Ingredients and where they come from</h3>
      <div className="crafting-ingredient-list">
        {recipe.ingredients.map((row) => (
          <IngredientRow
            key={row.rowId}
            recipeName={recipe.outputName}
            row={row}
            importerDefault={importerDefault}
          />
        ))}
      </div>

      {recipe.conflicts.map((conflict) => (
        <div className="notice" key={conflict.summary}>
          {conflict.summary}
        </div>
      ))}

      <label className="crafting-learned-row">
        <input
          type="checkbox"
          checked={learned}
          disabled={!ready}
          onChange={onToggleLearned}
          aria-label={`${learned ? "Unmark" : "Mark"} ${recipe.outputName} learned`}
        />
        <span>I have learned this recipe</span>
      </label>

      {recipe.source ? (
        <p className="crafting-source">
          <a href={recipe.source} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      ) : null}
    </article>
  );
}

function sourceName(row: UnlockMethod) {
  const haystack = `${row.provider} ${row.sourceUrl}`;
  if (/serebii/i.test(haystack)) return "Serebii";
  if (/pokopiaapi|pokopiapi/i.test(haystack)) return "PokopiaAPI";
  return "the recorded source";
}

function UnlockBlock({ recipe }: { recipe: NormalizedRecipe }) {
  const { methods, conflicts } = recipe.unlock;
  if (conflicts.length) {
    return (
      <div className="crafting-learn conflict">
        <p>Sources disagree. Both records are shown, and neither is chosen.</p>
        <ul>
          {conflicts.map((row) => (
            <li key={`${row.provider}:${row.text}`}>
              <p>{row.text}</p>
              <p className="why">
                <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                  {sourceName(row)}
                </a>
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (methods.length) {
    return (
      <div className="crafting-learn">
        {methods.map((row) => (
          <p key={`${row.provider}:${row.text}`}>{row.text}</p>
        ))}
        <p className="why">Recorded on the source page for this item.</p>
      </div>
    );
  }
  return (
    <div className="crafting-learn unknown">
      <p>{NOT_YET_DOCUMENTED}</p>
      <p className="why">{UNLOCK_EMPTY_WHY}</p>
    </div>
  );
}

function IngredientRow({
  recipeName,
  row,
  importerDefault,
}: {
  recipeName: string;
  row: RecipeIngredient;
  importerDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const unresolved = row.identity.type === "unresolved";
  const summary = unresolved
    ? ITEM_MATCH_UNDOCUMENTED
    : row.locations.length
      ? summarizeLocations(row.locations)
      : NOT_YET_DOCUMENTED;
  const count = ingredientCountLabel(row);
  const panelId = `ing-${row.rowId.replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <div className={`crafting-ing ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="crafting-ing-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {row.identity.type === "resolved" ? (
          <ItemThumb id={row.identity.itemId} name={row.originalLabel} />
        ) : (
          <span className="item-thumb" aria-hidden="true">
            ?
          </span>
        )}
        <span className="crafting-ing-name">{row.originalLabel}</span>
        <span className="crafting-qty">
          {count}
          {summary ? ` · ${summary}` : ""}
        </span>
      </button>
      {open ? (
        <div className="crafting-ing-body" id={panelId}>
          {unresolved ? (
            <p>{ITEM_MATCH_UNDOCUMENTED}</p>
          ) : row.locations.length ? (
            <ul
              aria-label={`Where to find ${row.originalLabel} for ${recipeName}`}
            >
              {row.locations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>{NOT_YET_DOCUMENTED}</p>
          )}
          {importerDefault ? (
            <p>This count is an importer default, not a recorded per-craft figure.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MissingRecipe({ recipeId }: { recipeId: string }) {
  return (
    <article className="crafting-detail">
      <a className="back-link crafting-back" href={itemsListHref("crafting")}>
        ← Back to recipes
      </a>
      <h2>That recipe isn’t in this catalog</h2>
      <p>
        The link <code>{recipeId}</code> does not match a current recipe. Return
        to the recipe list to keep browsing.
      </p>
    </article>
  );
}
