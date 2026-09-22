import type { Catalog } from "../catalog/types";
import { normalizeItemName, type LocalStorageItem } from "./types";

/**
 * Catalog-version-change reconciliation: suggests, never auto-merges. Uses normalized-name
 * matching only — the master prompt allows "optional visual similarity" too, but that would mean
 * running the recognition descriptor against every local-item thumbnail, which is out of scope
 * for this pass; name matching alone already satisfies "show suggestions, not automatic merges."
 */

export interface ReconciliationSuggestion {
  localItemId: string;
  localItemName: string;
  catalogItemId: string;
  catalogItemName: string;
  reason: "exact-name" | "close-name";
}

export function suggestCatalogLinks(
  localItems: LocalStorageItem[],
  catalog: Catalog,
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];
  for (const item of localItems) {
    if (item.linkedCatalogItemId || item.mergedIntoLocalItemId) continue;
    const exact = catalog.items.find((c) => normalizeItemName(c.name) === item.normalizedName);
    if (exact) {
      suggestions.push({
        localItemId: item.id,
        localItemName: item.name,
        catalogItemId: exact.id,
        catalogItemName: exact.name,
        reason: "exact-name",
      });
      continue;
    }
    const close = catalog.items.find((c) => {
      const normalized = normalizeItemName(c.name);
      return (
        normalized.length > 3 &&
        item.normalizedName.length > 3 &&
        (normalized.includes(item.normalizedName) || item.normalizedName.includes(normalized))
      );
    });
    if (close) {
      suggestions.push({
        localItemId: item.id,
        localItemName: item.name,
        catalogItemId: close.id,
        catalogItemName: close.name,
        reason: "close-name",
      });
    }
  }
  return suggestions;
}
