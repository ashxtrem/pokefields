import { useLayoutEffect, useMemo, useRef } from "react";
import { Search } from "lucide-react";
import type { Item } from "../catalog/types";
import { Empty, ItemThumb } from "../ui/components";
import { useViewState } from "../ui/navigation";
import { defaultItemFilters, filterItems } from "./search";
import {
  collectibleSets,
  coverageLabel,
  displayGroups,
  itemHref,
  itemInTab,
  type ItemTab,
} from "./tabs";

export function ItemsPanel({
  items,
  tab,
  selectedId,
  collectedIds = [],
}: {
  items: Item[];
  tab: ItemTab;
  selectedId?: string;
  collectedIds?: string[];
}) {
  const [filters, setFilters] = useViewState("items.filters", defaultItemFilters);
  const [listScroll, setListScroll] = useViewState(
    `items.listScroll.${tab}`,
    0,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const tabTotal = useMemo(
    () => items.filter((item) => itemInTab(item, tab)).length,
    [items, tab],
  );
  const results = filterItems(items, tab, filters);
  const resultIds = useMemo(
    () => new Set(results.map((item) => item.id)),
    [results],
  );
  const sets =
    tab === "collectibles"
      ? collectibleSets(items)
          .map((set) => ({
            ...set,
            items: set.items.filter((item) => resultIds.has(item.id)),
          }))
          .filter((set) => set.items.length)
      : null;

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listScroll;
  }, [selectedId]);

  return (
    <div className="crafting-recipes items-panel">
      <div className="search-row crafting-tools">
        <div className="search-box">
          <Search size={19} />
          <input
            type="text"
            aria-label="Search items by name"
            placeholder="Search items…"
            value={filters.search}
            onChange={(e) =>
              setFilters((current) => ({ ...current, search: e.target.value }))
            }
          />
          {filters.search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() =>
                setFilters((current) => ({ ...current, search: "" }))
              }
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <p className="crafting-learned-count">
        Showing {results.length} of {tabTotal}.
      </p>
      {filters.search ? (
        <div className="results-bar">
          <button
            type="button"
            className="text-button"
            onClick={() => setFilters(defaultItemFilters())}
          >
            Clear search
          </button>
        </div>
      ) : null}
      {!results.length ? (
        <Empty title="No items match this search">
          Clear the search or try another name.
        </Empty>
      ) : sets ? (
        <div
          ref={listRef}
          className="crafting-result-list"
          onScroll={(e) => setListScroll(e.currentTarget.scrollTop)}
        >
          {sets.map((set) => (
            <section key={set.id} className="item-set">
              <header className="item-set-head">
                <h3>{set.label}</h3>
                <p>{coverageLabel(set.documented, set.setSize)}</p>
              </header>
              <div role="list">
                {set.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    tab={tab}
                    selected={selectedId === item.id}
                    collected={collectedIds.includes(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          ref={listRef}
          className="crafting-result-list"
          role="list"
          onScroll={(e) => setListScroll(e.currentTarget.scrollTop)}
        >
          {results.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              tab={tab}
              selected={selectedId === item.id}
              collected={collectedIds.includes(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  tab,
  selected,
  collected,
}: {
  item: Item;
  tab: ItemTab;
  selected: boolean;
  collected: boolean;
}) {
  const groups = displayGroups(item);
  const number =
    item.collection?.set === "music-cd" ? `#${item.collection.number}` : "";
  return (
    <a
      href={itemHref(item.id, tab)}
      className={`crafting-row ${selected ? "selected" : ""}`}
      role="listitem"
      aria-current={selected ? "page" : undefined}
    >
      <ItemThumb id={item.id} name={item.name} />
      <span className="crafting-row-copy">
        <strong>{item.name}</strong>
        <small>
          {number ? `${number} · ` : ""}
          {groups.join(" · ")}
        </small>
      </span>
      {collected ? <span className="crafting-chip known">Collected</span> : null}
    </a>
  );
}
