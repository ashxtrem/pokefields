import type { Item } from "../catalog/types";
import { isRecipeCandidate } from "../crafting/catalog";

export const ITEM_TABS = [
  "all",
  "crafting",
  "food",
  "buildings",
  "collectibles",
] as const;

export type ItemTab = (typeof ITEM_TABS)[number];

export const ITEM_TAB_DEFS: { id: ItemTab; label: string }[] = [
  { id: "all", label: "All Items" },
  { id: "crafting", label: "Crafting Recipes" },
  { id: "food", label: "Food & Cooking" },
  { id: "buildings", label: "Buildings" },
  { id: "collectibles", label: "Collectibles" },
];

const COLLECTIBLE_GROUPS = [
  "Key Items",
  "Lost Relics (L)",
  "Lost Relics (S)",
  "Fossils",
] as const;

const GROUP_DISPLAY: Record<string, string> = {
  "Misc.": "Miscellaneous",
  "Lost Relics (L)": "Lost Relics (large)",
  "Lost Relics (S)": "Lost Relics (small)",
};

export function isItemTab(value: string | null): value is ItemTab {
  return Boolean(value && (ITEM_TABS as readonly string[]).includes(value));
}

export function tabFromQuery(query: string): ItemTab {
  const params = new URLSearchParams(query);
  const uses = params.get("uses");
  const tab = params.get("tab");
  if (isItemTab(tab)) return tab;
  if (uses) return "crafting";
  return "all";
}

export function itemsListHref(
  tab: ItemTab = "all",
  extra: { uses?: string } = {},
) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (extra.uses && tab === "crafting") params.set("uses", extra.uses);
  const q = params.toString();
  return q ? `#/items?${q}` : "#/items";
}

export function defaultItemTabRoutes(): Record<ItemTab, string> {
  return {
    all: itemsListHref("all"),
    crafting: itemsListHref("crafting"),
    food: itemsListHref("food"),
    buildings: itemsListHref("buildings"),
    collectibles: itemsListHref("collectibles"),
  };
}

export function rememberedItemTabHref(
  tab: ItemTab,
  remembered: Record<ItemTab, string>,
  available: (href: string) => boolean = () => true,
) {
  const href = remembered[tab] || itemsListHref(tab);
  return available(href) ? href : itemsListHref(tab);
}

export function itemHref(itemId: string, tab?: ItemTab) {
  const q = tab && tab !== "all" ? `?tab=${tab}` : "";
  return `#/items/${encodeURIComponent(itemId)}${q}`;
}

export function itemInTab(item: Item, tab: ItemTab): boolean {
  if (tab === "all") return true;
  if (tab === "crafting") return isRecipeCandidate(item);
  const groups = item.groups || [];
  if (tab === "food")
    return groups.includes("Food") || item.recipeMeta?.kind === "cook";
  if (tab === "buildings")
    return groups.includes("Buildings") || groups.includes("Kits");
  return (
    COLLECTIBLE_GROUPS.some((group) => groups.includes(group)) ||
    Boolean(item.collection)
  );
}

export function tabCounts(items: Item[]): Record<ItemTab, number> {
  const counts: Record<ItemTab, number> = {
    all: 0,
    crafting: 0,
    food: 0,
    buildings: 0,
    collectibles: 0,
  };
  for (const item of items) {
    counts.all++;
    if (itemInTab(item, "crafting")) counts.crafting++;
    if (itemInTab(item, "food")) counts.food++;
    if (itemInTab(item, "buildings")) counts.buildings++;
    if (itemInTab(item, "collectibles")) counts.collectibles++;
  }
  return counts;
}

export function displayGroupName(raw: string) {
  return GROUP_DISPLAY[raw] || raw;
}

export function isWallpaper(item: Item) {
  return /\(wallpaper\)/i.test(item.name);
}

export function displayGroups(item: Item): string[] {
  const names = (item.groups || []).map(displayGroupName);
  if (isWallpaper(item) && !names.includes("Wallpaper")) names.push("Wallpaper");
  return names.length ? names : ["Unsorted"];
}

export function musicCdCoverage(items: Item[]) {
  const discs = items.filter((item) => item.collection?.set === "music-cd");
  const documented = discs.length;
  const setSize = discs.reduce(
    (highest, item) => Math.max(highest, item.collection!.number),
    0,
  );
  return { documented, setSize };
}

export function coverageLabel(documented: number, setSize: number | null) {
  if (setSize == null || setSize <= 0) return `${documented} documented`;
  return `${documented} of ${setSize} documented`;
}

export type CollectibleSet = {
  id: string;
  label: string;
  items: Item[];
  documented: number;
  setSize: number | null;
};

function byName(a: Item, b: Item) {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

export function collectibleSets(items: Item[]): CollectibleSet[] {
  const collectibles = items.filter((item) => itemInTab(item, "collectibles"));
  const music = collectibles
    .filter((item) => item.collection?.set === "music-cd")
    .sort(
      (a, b) =>
        (a.collection?.number || 0) - (b.collection?.number || 0) || byName(a, b),
    );
  const grouped = (group: string, id: string, label: string): CollectibleSet => {
    const rows = collectibles
      .filter(
        (item) =>
          item.collection?.set !== "music-cd" &&
          (item.groups || []).includes(group),
      )
      .sort(byName);
    return {
      id,
      label,
      items: rows,
      documented: rows.length,
      setSize: null,
    };
  };
  const coverage = musicCdCoverage(items);
  return [
    {
      id: "music-cd",
      label: "Music CDs",
      items: music,
      documented: coverage.documented,
      setSize: coverage.setSize || null,
    },
    grouped("Lost Relics (L)", "lost-relics-l", "Lost Relics (large)"),
    grouped("Lost Relics (S)", "lost-relics-s", "Lost Relics (small)"),
    grouped("Fossils", "fossils", "Fossils"),
    grouped("Key Items", "key-items", "Key Items"),
  ].filter((set) => set.items.length);
}
