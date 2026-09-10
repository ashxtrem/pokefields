import type { Catalog, Item } from "../catalog/types";
import { buildItemIndex, resolveExactItemId } from "../crafting/identity";
import { listCanonicalHabitats } from "../habitats/catalog";
import { normalizeRequirements } from "../habitats/requirements";

export interface HabitatUse {
  habitatId: string;
  habitatName: string;
  raw: string;
}

export interface KitUse {
  kitId: string;
  kitName: string;
  quantity: number;
}

export interface ItemRequiredBy {
  habitats: HabitatUse[];
  kits: KitUse[];
}

const requiredIndex = new WeakMap<Catalog, Map<string, ItemRequiredBy>>();

function emptyUse(): ItemRequiredBy {
  return { habitats: [], kits: [] };
}

function indexFor(catalog: Catalog) {
  let index = requiredIndex.get(catalog);
  if (index) return index;
  index = new Map();
  const items = buildItemIndex(catalog.items);
  for (const habitat of listCanonicalHabitats(catalog)) {
    for (const req of normalizeRequirements(habitat.representative, catalog.items)) {
      if (!req.itemId) continue;
      const row = index.get(req.itemId) || emptyUse();
      row.habitats.push({
        habitatId: habitat.id,
        habitatName: habitat.name,
        raw: req.raw,
      });
      index.set(req.itemId, row);
    }
  }
  for (const kit of catalog.kits) {
    for (const material of kit.materials) {
      const itemId = resolveExactItemId(material.name, items);
      if (!itemId) continue;
      const row = index.get(itemId) || emptyUse();
      row.kits.push({
        kitId: kit.id,
        kitName: kit.name,
        quantity: material.quantity,
      });
      index.set(itemId, row);
    }
  }
  requiredIndex.set(catalog, index);
  return index;
}

export function requiredByItem(catalog: Catalog, itemId: string): ItemRequiredBy {
  return indexFor(catalog).get(itemId) || emptyUse();
}

export function kitForItem(catalog: Catalog, item: Item) {
  return catalog.kits.find((kit) => kit.id === item.id);
}
