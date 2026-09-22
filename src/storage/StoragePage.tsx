import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Package, Plus, Search } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { Empty, ItemThumb } from "../ui/components";
import { CatalogReconciliationBanner } from "./CatalogReconciliationBanner";
import { useStorage } from "./context";
import { StorageImageThumb } from "./StorageImageThumb";
import { hasSeenStorageGuide, markStorageGuideSeen, StorageGuide } from "./StorageGuide";
import { chestsForItemRef, searchStorageItems, storageChestHref, storageNewHref } from "./search";
import type { StorageChest, StorageItemRef } from "./types";

export function StoragePage({ route }: { route: { query: string } }) {
  const catalog = useCatalog();
  const { chests, localItems, ready, unreadableChests, unreadableLocalItems } = useStorage();
  const [query, setQuery] = useState(() => new URLSearchParams(route.query).get("q") || "");
  const [regionFilter, setRegionFilter] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!hasSeenStorageGuide()) {
      setShowGuide(true);
      markStorageGuideSeen();
    }
  }, []);

  const results = useMemo(
    () => searchStorageItems(query, catalog, localItems),
    [query, catalog, localItems],
  );
  const visibleChests = useMemo(
    () => (regionFilter ? chests.filter((chest) => chest.regionId === regionFilter) : chests),
    [chests, regionFilter],
  );

  if (!ready) return <div className="loading">Opening your chests…</div>;

  return (
    <div className="storage-page">
      <header className="storage-hero">
        <div className="storage-hero-row">
          <h1>Storage</h1>
          <button type="button" className="storage-guide-button" onClick={() => setShowGuide(true)}>
            <HelpCircle size={15} aria-hidden="true" />
            Guide
          </button>
        </div>
        <p className="muted">
          Pokopia Fieldnotes remembers where you last recorded an item — search for it, or browse
          your chests below.
        </p>
      </header>
      {showGuide ? <StorageGuide onClose={() => setShowGuide(false)} /> : null}
      <CatalogReconciliationBanner />
      <div className="search-row">
        <div className="search-box">
          <Search size={19} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for an item…"
            aria-label="Search catalog and saved items"
          />
        </div>
      </div>
      {query.trim() ? (
        <SearchResults results={results} chests={chests} />
      ) : (
        <>
          <div className="storage-toolbar">
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              aria-label="Filter chests by region"
            >
              <option value="">All regions</option>
              {catalog.areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <a className="button" href={storageNewHref()}>
              <Plus size={16} />
              New chest
            </a>
          </div>
          {visibleChests.length === 0 ? (
            <Empty title="No chests recorded yet">
              Create a chest to start remembering where you put things — you can save it empty and
              add contents later.
            </Empty>
          ) : (
            <ChestList chests={visibleChests} />
          )}
        </>
      )}
      {unreadableChests + unreadableLocalItems > 0 ? (
        <p className="notice" role="status">
          {unreadableChests + unreadableLocalItems} storage record
          {unreadableChests + unreadableLocalItems === 1 ? "" : "s"} could not be read and were
          skipped so the rest of Storage stayed usable.
        </p>
      ) : null}
    </div>
  );
}

function ChestList({ chests }: { chests: StorageChest[] }) {
  return (
    <ul className="storage-chest-list">
      {chests.map((chest) => (
        <li key={chest.id}>
          <a className="storage-chest-card" href={storageChestHref(chest.id)}>
            {chest.locationImageId ? (
              <StorageImageThumb
                imageId={chest.locationImageId}
                alt=""
                className="storage-chest-thumb"
              />
            ) : (
              <span className="storage-chest-icon">
                <Package size={18} aria-hidden="true" />
              </span>
            )}
            <span className="storage-chest-info">
              <strong>{chest.name}</strong>
              <small>
                {chest.regionId} · {chest.itemRefs.length} unique recorded item
                {chest.itemRefs.length === 1 ? "" : "s"}
              </small>
              {chest.locationNote ? <small>{chest.locationNote}</small> : null}
              <small>Updated {new Date(chest.updatedAt).toLocaleDateString()}</small>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function resultKey(ref: StorageItemRef) {
  return ref.kind === "catalog" ? `catalog:${ref.itemId}` : `local:${ref.localItemId}`;
}

function SearchResults({
  results,
  chests,
}: {
  results: ReturnType<typeof searchStorageItems>;
  chests: StorageChest[];
}) {
  if (!results.length) return <p className="notice">Not recorded in your chests.</p>;
  return (
    <div className="storage-search-results">
      {results.map((result) => {
        const matches = chestsForItemRef(result.ref, chests);
        return (
          <section key={resultKey(result.ref)} className="storage-search-result">
            <div className="storage-search-result-head">
              {result.ref.kind === "catalog" ? (
                <ItemThumb id={result.ref.itemId} name={result.name} />
              ) : (
                <span className="item-thumb" aria-hidden="true">
                  {result.name.slice(0, 1)}
                </span>
              )}
              <strong>{result.name}</strong>
              <span className={`storage-source-badge ${result.source}`}>
                {result.source === "catalog" ? "Catalog" : "Saved by me"}
              </span>
            </div>
            {matches.length === 0 ? (
              <p className="muted">Not recorded in your chests.</p>
            ) : (
              <ChestList chests={matches} />
            )}
          </section>
        );
      })}
    </div>
  );
}
