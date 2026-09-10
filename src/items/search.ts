import type { Item } from "../catalog/types";
import { itemInTab, type ItemTab } from "./tabs";

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

export function filterItems(items: Item[], tab: ItemTab, filters: ItemFilters) {
  const q = normalizeSearch(filters.search);
  const matched = items.filter((item) => {
    if (!itemInTab(item, tab)) return false;
    if (q && !normalizeSearch(item.name).includes(q)) return false;
    return true;
  });
  return matched.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
