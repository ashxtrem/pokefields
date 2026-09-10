import type { Catalog, Item, Kit } from "../catalog/types";
import { ItemThumb } from "../ui/components";
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
  const usedIn = recipesConsumingItem(catalog, item.id);
  const required = requiredByItem(catalog, item.id);
  const groups = displayGroups(item);
  const collection = item.collection;
  const cdCoverage = collection?.set === "music-cd" ? musicCdCoverage(catalog.items) : null;
  const locations = item.locations || [];
  return (
    <article className="crafting-detail">
      <a className="back-link crafting-back" href={itemsListHref(tab)}>
        ← Back to items
      </a>
      <div className="crafting-detail-head">
        <ItemThumb id={item.id} name={item.name} large />
        <div>
          <h2>{item.name}</h2>
          <p className="crafting-cats">{groups.join(" · ")}</p>
          {item.categories.length ? (
            <p className="crafting-cats">
              Liked as {item.categories.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {recipes.length ? (
        <p>
          <a href={recipeHref(recipes[0].id)}>How to learn this recipe</a>
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

      {onToggleCollected ? (
        <label className="crafting-learned-row">
          <input
            type="checkbox"
            checked={collected}
            disabled={!ready}
            onChange={onToggleCollected}
            aria-label={`${collected ? "Unmark" : "Mark"} ${item.name} collected`}
          />
          <span>I have this collectible</span>
        </label>
      ) : null}

      {item.source ? (
        <p className="crafting-source">
          <a href={item.source} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      ) : null}
    </article>
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
