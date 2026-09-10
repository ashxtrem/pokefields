import type { Item } from "../catalog/types";
import aliasesJson from "./data/aliases.json";

const aliases = aliasesJson as Record<string, string>;

/** Exact identity for persistence and aggregation. Never the glossary prefix matcher. */
export function normalizeIngredientName(label: string) {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

export function aliasItemId(label: string): string | undefined {
  return aliases[normalizeIngredientName(label)];
}

export function reviewedAliases(): Record<string, string> {
  return { ...aliases };
}

export interface ItemIndex {
  byId: Map<string, Item>;
  byNormalizedName: Map<string, string[]>;
}

/** One index per catalog. D-ID-02 lookups must not rescan every item. */
export function buildItemIndex(items: Item[]): ItemIndex {
  const byId = new Map<string, Item>();
  const byNormalizedName = new Map<string, string[]>();
  for (const item of items) {
    byId.set(item.id, item);
    const key = normalizeIngredientName(item.name);
    const list = byNormalizedName.get(key);
    if (list) list.push(item.id);
    else byNormalizedName.set(key, [item.id]);
  }
  return { byId, byNormalizedName };
}

function asIndex(items: Item[] | ItemIndex): ItemIndex {
  return Array.isArray(items) ? buildItemIndex(items) : items;
}

/**
 * D-ID-02: unique exact normalized-name matches and reviewed aliases only.
 * Prefix/fuzzy matches are unfit for persistence keys.
 */
export function resolveExactItemId(
  label: string,
  items: Item[] | ItemIndex,
): string | null {
  const index = asIndex(items);
  const aliasId = aliasItemId(label);
  if (aliasId && index.byId.has(aliasId)) return aliasId;
  const hits = index.byNormalizedName.get(normalizeIngredientName(label)) || [];
  if (hits.length === 1) return hits[0];
  return null;
}

export function itemById(items: Item[] | ItemIndex, id: string): Item | undefined {
  return asIndex(items).byId.get(id);
}
