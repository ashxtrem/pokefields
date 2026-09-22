import { useMemo, useState } from "react";
import { useCatalog } from "../catalog/context";
import { ItemThumb } from "../ui/components";
import { useStorage } from "./context";
import { findNameCollision } from "./localItems";
import { searchStorageItems } from "./search";
import type { StorageItemRef } from "./types";

/**
 * Searches official catalog items and player-created local items, with a "create local item"
 * fallback (warning on a normalized-name collision first, per the master prompt). Shared between
 * manual "add item" and unresolved-slot "identify" flows in ChestDetail.tsx.
 */
export function ItemPicker({
  onPick,
  onCancel,
}: {
  onPick: (ref: StorageItemRef) => void;
  onCancel?: () => void;
}) {
  const catalog = useCatalog();
  const { localItems, createLocalItem } = useStorage();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const results = useMemo(
    () => searchStorageItems(query, catalog, localItems),
    [query, catalog, localItems],
  );
  const collision = query.trim() ? findNameCollision(query, catalog, localItems) : null;

  const createNew = async () => {
    setCreating(true);
    setError("");
    try {
      const item = await createLocalItem({ name: query.trim() });
      onPick({ kind: "local", localItemId: item.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this item.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="storage-item-picker">
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search catalog and saved items…"
        aria-label="Search for an item to add"
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="storage-picker-results">
          {results.map((result) => (
            <li key={result.ref.kind === "catalog" ? `c:${result.ref.itemId}` : `l:${result.ref.localItemId}`}>
              <button type="button" className="storage-picker-row" onClick={() => onPick(result.ref)}>
                {result.ref.kind === "catalog" ? (
                  <ItemThumb id={result.ref.itemId} name={result.name} />
                ) : (
                  <span className="item-thumb" aria-hidden="true">
                    {result.name.slice(0, 1)}
                  </span>
                )}
                <span>{result.name}</span>
                <span className={`storage-source-badge ${result.source}`}>
                  {result.source === "catalog" ? "Catalog" : "Saved by me"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && (
        <div className="storage-picker-create">
          {collision ? (
            <p className="notice">
              {collision.kind === "catalog" ? "A catalog item" : "A saved item"} named "
              {collision.name}" already exists.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  onPick(
                    collision.kind === "catalog"
                      ? { kind: "catalog", itemId: collision.itemId }
                      : { kind: "local", localItemId: collision.localItemId },
                  )
                }
              >
                Use it
              </button>
            </p>
          ) : null}
          <button type="button" className="button secondary" disabled={creating} onClick={createNew}>
            {creating ? "Creating…" : `Create local item "${query.trim()}"`}
          </button>
        </div>
      )}
      {onCancel && (
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
