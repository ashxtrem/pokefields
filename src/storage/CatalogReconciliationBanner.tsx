import { useMemo, useState } from "react";
import { useCatalog } from "../catalog/context";
import { useStorage } from "./context";
import { suggestCatalogLinks } from "./reconciliation";

const DISMISSED_KEY = "pkm.storage.reconciliation.dismissedForCatalogVersion";

/**
 * Suggests (never auto-applies) linking a player-created local item to a newly-arrived official
 * catalog item after a catalog refresh — see docs/storage-locator-feature-master-prompt.md's
 * "Catalog refresh reconciliation." Dismissing hides suggestions for the current catalog version
 * only; a later catalog change shows them again.
 */
export function CatalogReconciliationBanner() {
  const catalog = useCatalog();
  const { localItems, linkLocalItemToCatalog } = useStorage();
  const suggestions = useMemo(() => suggestCatalogLinks(localItems, catalog), [localItems, catalog]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === catalog.version;
    } catch {
      return false;
    }
  });

  if (dismissed || suggestions.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, catalog.version);
    } catch {
      /* sessionStorage can be missing or blocked */
    }
  };

  return (
    <div className="notice storage-reconciliation">
      <strong>Possible catalog matches for your saved items</strong>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.localItemId}>
            "{suggestion.localItemName}" looks like the catalog item "{suggestion.catalogItemName}".{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => linkLocalItemToCatalog(suggestion.localItemId, suggestion.catalogItemId)}
            >
              Link to catalog item
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="text-button" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}
