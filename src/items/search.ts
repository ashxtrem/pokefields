import type { Item } from "../catalog/types";
import { itemInTab, TAG_DISPLAY, type ItemTab } from "./tabs";

export interface ItemFilters {
  search: string;
  sort: "name";
}

export const defaultItemFilters = (): ItemFilters => ({
  search: "",
  sort: "name",
});

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Extra search words that reach a tag even though the word never appears in
 * the tag id or its display label (e.g. searching "bird" should surface
 * items tagged "flying").
 */
const TAG_SEARCH_SYNONYMS: Record<string, string[]> = {
  flying: ["bird", "birds"],
  ghost: ["spooky", "halloween"],
  electric: ["lightning", "spark"],
};

function itemSearchText(item: Item): string {
  const tags = item.tags || [];
  const labels = tags.map((id) => TAG_DISPLAY[id] || id);
  const synonyms = tags.flatMap((id) => TAG_SEARCH_SYNONYMS[id] || []);
  return normalizeSearch([item.name, ...tags, ...labels, ...synonyms].join(" "));
}

export function filterItems(items: Item[], tab: ItemTab, filters: ItemFilters) {
  const q = normalizeSearch(filters.search);
  const matched = items.filter((item) => {
    if (!itemInTab(item, tab)) return false;
    if (q && !itemSearchText(item).includes(q)) return false;
    return true;
  });
  return matched.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
