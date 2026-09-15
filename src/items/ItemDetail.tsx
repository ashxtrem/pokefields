import type { Catalog, Item, Kit } from "../catalog/types";
import {
  ArrowUp,
  Droplets,
  Hammer,
  Leaf,
  Package,
  PackageCheck,
  Scissors,
  Sparkles,
  Waves,
} from "lucide-react";
import { EnvLockNote, ItemThumb } from "../ui/components";
import { useProgress } from "../progress/context";
import { itemEnvLock } from "../dex/glossary";
import {
  recipesConsumingItem,
  recipesForOutputItem,
} from "../crafting/catalog";
import { NOT_YET_DOCUMENTED, recipeHref } from "../crafting/types";
import { habitatDetailHref } from "../habitats/search";
import { locationTargetId } from "./locations";
import { kitForItem, requiredByItem } from "./requiredBy";
import {
  coverageLabel,
  displayGroups,
  displayTags,
  itemHref,
  itemsListHref,
  musicCdCoverage,
  type ItemTab,
} from "./tabs";

function kitKindLabel(kind: Kit["kind"]) {
  if (kind === "residence") return "Residence";
  if (kind === "structure") return "Structure";
  return NOT_YET_DOCUMENTED;
}

function figure(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "")
    return NOT_YET_DOCUMENTED;
  return String(value);
}

export function ItemDetail({
  item,
  catalog,
  tab,
  collected = false,
  ready = true,
  onToggleCollected,
}: {
  item: Item;
  catalog: Catalog;
  tab: ItemTab;
  collected?: boolean;
  ready?: boolean;
  onToggleCollected?: () => void;
}) {
  const kit = kitForItem(catalog, item);
  const recipes = recipesForOutputItem(catalog, item.id);
  const cookingRecipes = recipes.filter((recipe) => recipe.kind === "cook");
  const usedIn = recipesConsumingItem(catalog, item.id);
  const required = requiredByItem(catalog, item.id);
  const groups = displayGroups(item);
  const tags = displayTags(item);
  const collection = item.collection;
  const cdCoverage = collection?.set === "music-cd" ? musicCdCoverage(catalog.items) : null;
  const locations = item.locations || [];
  const { state } = useProgress();
  const envLock = itemEnvLock(item, state.envLevels);
  return (
    <article className="crafting-detail">
      <a className="back-link crafting-back" href={itemsListHref(tab)}>
        ← Back to items
      </a>
      <div className="crafting-detail-head">
        <ItemThumb id={item.id} name={item.name} large />
        <div className="crafting-detail-copy">
          <div className="crafting-detail-title-row">
            <h2>{item.name}</h2>
            {onToggleCollected ? (
              <button
                type="button"
                className="detail-status-toggle"
                aria-pressed={collected}
                aria-label={
                  collected
                    ? `Mark ${item.name} as not collected`
                    : `Mark ${item.name} as collected`
                }
                title={collected ? "Marked collected" : "Mark as collected"}
                disabled={!ready}
                onClick={onToggleCollected}
              >
                {collected ? <PackageCheck size={19} /> : <Package size={19} />}
              </button>
            ) : null}
          </div>
          <p className="crafting-cats">{groups.join(" · ")}</p>
          {item.categories.length ? (
            <p className="crafting-cats">
              Liked as {item.categories.join(" · ")}
            </p>
          ) : null}
          {tags.length ? (
            <p
              className="crafting-cats item-tags"
              title="Suggested by matching the item's name — not a game fact"
            >
              Tagged: {tags.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {recipes.length ? (
        <p>
          <a href={recipeHref(recipes[0].id)}>View recipe details</a>
        </p>
      ) : null}

      {collection ? (
        <>
          <h3>Collection</h3>
          <div className="crafting-learn">
            <p>
              {collection.set === "music-cd" ? "Music CD" : collection.set} #
              {collection.number}
            </p>
            {cdCoverage ? (
              <p className="why">
                {coverageLabel(cdCoverage.documented, cdCoverage.setSize)} in
                this companion. Missing numbers are absent from the source, not
                counted as complete.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <h3>How it is obtained</h3>
      <LocationList
        item={item}
        lines={locations}
        catalog={catalog}
        tab={tab}
      />
      {envLock && <EnvLockNote requirement={envLock} />}

      {item.cookingEffect ? (
        <CookingEffect effect={item.cookingEffect} />
      ) : null}

      {cookingRecipes.length ? (
        <CookingIngredients recipes={cookingRecipes} tab={tab} />
      ) : null}

      {kit ? <KitFacts kit={kit} catalog={catalog} tab={tab} /> : null}

      <h3>What it is used in</h3>
      {usedIn.length ? (
        <ul className="item-use-list">
          {usedIn.map((recipe) => (
            <li key={recipe.id}>
              <a href={recipeHref(recipe.id)}>{recipe.outputName}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Not used as a material in any catalogued recipe.</p>
      )}

      <h3>Where it is required</h3>
      {required.habitats.length || required.kits.length ? (
        <ul className="item-use-list">
          {required.habitats.map((row) => (
            <li key={`${row.habitatId}:${row.raw}`}>
              <a href={habitatDetailHref(row.habitatId)}>{row.habitatName}</a>
              {` · ${row.raw}`}
            </li>
          ))}
          {required.kits.map((row) => (
            <li key={`${row.kitId}:${row.quantity}`}>
              {catalog.items.some((entry) => entry.id === row.kitId) ? (
                <a href={itemHref(row.kitId, tab)}>{row.kitName}</a>
              ) : (
                row.kitName
              )}
              {` · × ${row.quantity}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Not named in a habitat requirement or build-kit material list.
        </p>
      )}

    </article>
  );
}

function CookingEffect({
  effect,
}: {
  effect: NonNullable<Item["cookingEffect"]>;
}) {
  const move = cookingMove(effect.description);
  const stronger = /power(?:s)? up .+\ba lot\b/i.test(effect.description);
  return (
    <>
      <h3>Move boost</h3>
      <div className="cooking-boost">
        <span className="cooking-boost-mark" aria-hidden="true">
          <CookingMoveIcon move={move} />
          <span className="cooking-boost-arrow">
            <ArrowUp size={12} strokeWidth={2.5} />
          </span>
        </span>
        <div className="cooking-boost-content">
          <p>{effect.description}</p>
          <div className="cooking-boost-stats">
            <span>
              {cookingMeasureLabel(effect.measure)}: <strong>{effect.measure}</strong>
            </span>
            {stronger ? (
              <span className="cooking-boost-stronger">
                <ArrowUp size={13} strokeWidth={2.5} /> Stronger boost
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function cookingMeasureLabel(measure: string) {
  return /\b(?:min|sec|hour)s?\b/i.test(measure)
    ? "Boost duration"
    : "PP restored";
}

function cookingMove(description: string) {
  return (
    description
      .match(/power(?:s)? up\s+(.+?)(?:\s+when eaten|[.!]|$)/i)?.[1]
      ?.replace(/\s+a lot$/i, "") || null
  );
}

function CookingMoveIcon({ move }: { move: string | null }) {
  const props = { size: 22, strokeWidth: 1.8 };
  if (move === "Cut") return <Scissors {...props} />;
  if (move === "Leafage") return <Leaf {...props} />;
  if (move === "Water Gun") return <Droplets {...props} />;
  if (move === "Rock Smash") return <Hammer {...props} />;
  if (move === "Surf") return <Waves {...props} />;
  return <Sparkles {...props} />;
}

function CookingIngredients({
  recipes,
  tab,
}: {
  recipes: ReturnType<typeof recipesForOutputItem>;
  tab: ItemTab;
}) {
  return (
    <>
      <h3>Cooking ingredients</h3>
      {recipes.map((recipe) => (
        <div className="cooking-ingredient-list" key={recipe.id}>
          {recipe.ingredients.map((ingredient) =>
            ingredient.identity.type === "resolved" ? (
              <a
                className="cooking-ingredient-row"
                href={itemHref(ingredient.identity.itemId, tab)}
                key={ingredient.rowId}
              >
                <ItemThumb
                  id={ingredient.identity.itemId}
                  name={ingredient.originalLabel}
                />
                <span className="cooking-ingredient-name">
                  {ingredient.originalLabel}
                </span>
                <span className="cooking-ingredient-count">
                  × {ingredient.quantity}
                </span>
              </a>
            ) : (
              <div className="cooking-ingredient-row" key={ingredient.rowId}>
                <span className="item-thumb" aria-hidden="true">
                  ?
                </span>
                <span className="cooking-ingredient-name">
                  {ingredient.originalLabel}
                </span>
                <span className="cooking-ingredient-count">
                  × {ingredient.quantity}
                </span>
              </div>
            ),
          )}
        </div>
      ))}
    </>
  );
}

function LocationList({
  item,
  lines,
  catalog,
  tab,
}: {
  item: Item;
  lines: string[];
  catalog: Catalog;
  tab: ItemTab;
}) {
  if (!lines.length) {
    return (
      <div className="crafting-learn unknown">
        <p>{NOT_YET_DOCUMENTED}</p>
        <p className="why">
          Where this is found has not yet been documented in this companion.
        </p>
      </div>
    );
  }
  return (
    <ul className="item-location-list">
      {lines.map((line) => {
        const target = locationTargetId(line, catalog.items);
        const linkable = target && target !== item.id;
        return (
          <li key={line}>
            {linkable ? <a href={itemHref(target, tab)}>{line}</a> : line}
          </li>
        );
      })}
    </ul>
  );
}

function KitFacts({
  kit,
  catalog,
  tab,
}: {
  kit: Kit;
  catalog: Catalog;
  tab: ItemTab;
}) {
  const footprint =
    kit.width == null && kit.depth == null && kit.height == null
      ? NOT_YET_DOCUMENTED
      : `${figure(kit.width)} × ${figure(kit.depth)} × ${figure(kit.height)}`;
  return (
    <>
      <h3>Build kit</h3>
      <dl className="item-kit-facts">
        <div>
          <dt>Kind</dt>
          <dd>{kitKindLabel(kit.kind)}</dd>
        </div>
        <div>
          <dt>Footprint</dt>
          <dd>{footprint}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{figure(kit.capacity)}</dd>
        </div>
        <div>
          <dt>Helpers</dt>
          <dd>{figure(kit.helpers)}</dd>
        </div>
        <div>
          <dt>Build time</dt>
          <dd>{figure(kit.buildTime)}</dd>
        </div>
      </dl>
      {kit.specialties.length ? (
        <p className="crafting-cats">Specialties: {kit.specialties.join(" · ")}</p>
      ) : null}
      <h3>Materials</h3>
      {kit.materials.length ? (
        <ul className="item-use-list">
          {kit.materials.map((row) => {
            const target = locationTargetId(row.name, catalog.items);
            return (
              <li key={`${row.name}:${row.quantity}`}>
                {target ? (
                  <a href={itemHref(target, tab)}>{row.name}</a>
                ) : (
                  row.name
                )}
                {` · × ${row.quantity}`}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">{NOT_YET_DOCUMENTED}</p>
      )}
    </>
  );
}

export function MissingItem({
  itemId,
  tab,
}: {
  itemId: string;
  tab: ItemTab;
}) {
  return (
    <article className="crafting-detail">
      <a className="back-link crafting-back" href={itemsListHref(tab)}>
        ← Back to items
      </a>
      <h2>That item isn’t in this catalog</h2>
      <p>
        The link <code>{itemId}</code> does not match a current item. Return to
        the item list to keep browsing.
      </p>
    </article>
  );
}
