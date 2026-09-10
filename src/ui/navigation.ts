import {
  useLayoutEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// Visit-scoped UI memory: never mixed into the user's saved game progress.
const viewState = new Map<string, unknown>();
export function useViewState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    viewState.has(key)
      ? (viewState.get(key) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );
  useLayoutEffect(() => {
    viewState.set(key, value);
  }, [key, value]);
  return [value, setValue];
}

export function routeKey(route: string) {
  const raw = route || "#/dex";
  const [path, query = ""] = raw.split("?");
  const tab = new URLSearchParams(query).get("tab");
  return tab ? `${path}?tab=${tab}` : path;
}

export type NavSection = "dex" | "habitats" | "planner" | "items";

export type ParsedRoute =
  | { page: "habitat-detail"; habitatId: string; query: string }
  | { page: "habitats"; query: string }
  | { page: "planner"; query: string }
  | { page: "items-recipe"; recipeId: string; query: string }
  | { page: "item-detail"; itemId: string; query: string }
  | { page: "items"; query: string }
  | { page: "pokemon"; id: string; query: string }
  | { page: "dex"; query: string };

export const SECTION_LIST_HREF: Record<NavSection, string> = {
  dex: "#/dex",
  habitats: "#/habitats",
  planner: "#/planner",
  items: "#/items",
};

const SECTION_ROUTES_KEY = "pkm.nav.sections";

const sectionRoutes = new Map<NavSection, string>();
let sectionRoutesHydrated = false;

function splitHash(hash: string) {
  const raw = hash || "#/dex";
  const [pathPart, query = ""] = raw.replace(/^#/, "").split("?");
  return { path: pathPart.replace(/^\/+/, ""), query };
}

function withCraftingTab(query: string) {
  const params = new URLSearchParams(query);
  if (!params.get("tab")) params.set("tab", "crafting");
  return params.toString();
}

export function parseRoute(hash: string): ParsedRoute {
  const { path, query } = splitHash(hash);
  if (path.startsWith("habitats/")) {
    return {
      page: "habitat-detail" as const,
      habitatId: decodeURIComponent(path.slice("habitats/".length)),
      query,
    };
  }
  if (path === "habitats" || path.startsWith("habitats")) {
    return { page: "habitats" as const, query };
  }
  if (path === "planner" || path.startsWith("planner")) {
    return { page: "planner" as const, query };
  }
  if (path.startsWith("items/recipe/")) {
    return {
      page: "items-recipe" as const,
      recipeId: decodeURIComponent(path.slice("items/recipe/".length)),
      query,
    };
  }
  if (path === "items/recipe") {
    return { page: "items-recipe" as const, recipeId: "", query };
  }
  if (path.startsWith("crafting/recipe/")) {
    return {
      page: "items-recipe" as const,
      recipeId: decodeURIComponent(path.slice("crafting/recipe/".length)),
      query,
    };
  }
  if (path === "crafting" || path.startsWith("crafting")) {
    return { page: "items" as const, query: withCraftingTab(query) };
  }
  if (path.startsWith("items/") && path !== "items") {
    return {
      page: "item-detail" as const,
      itemId: decodeURIComponent(path.slice("items/".length)),
      query,
    };
  }
  if (path === "items" || path.startsWith("items")) {
    return { page: "items" as const, query };
  }
  if (path.startsWith("pokemon/")) {
    return {
      page: "pokemon" as const,
      id: decodeURIComponent(path.slice("pokemon/".length)),
      query,
    };
  }
  return { page: "dex" as const, query };
}

/** Canonical Items URLs for shipped `#/crafting*` hashes. Null when already canonical. */
export function canonicalItemsHref(hash: string): string | null {
  const { path, query } = splitHash(hash);
  if (path.startsWith("crafting/recipe/")) {
    const recipeId = decodeURIComponent(path.slice("crafting/recipe/".length));
    const q = query ? `?${query}` : "";
    return `#/items/recipe/${encodeURIComponent(recipeId)}${q}`;
  }
  if (path === "crafting" || path.startsWith("crafting")) {
    const next = withCraftingTab(query);
    return next ? `#/items?${next}` : "#/items?tab=crafting";
  }
  return null;
}

export function navSection(route: string): NavSection {
  const page = parseRoute(route).page;
  if (page === "habitats" || page === "habitat-detail") return "habitats";
  if (page === "planner") return "planner";
  if (page === "items" || page === "items-recipe" || page === "item-detail")
    return "items";
  return "dex";
}

function asNavSection(value: string): NavSection | null {
  if (value === "crafting" || value === "items") return "items";
  if (value === "dex" || value === "habitats" || value === "planner")
    return value;
  return null;
}

function readStoredSectionRoutes() {
  try {
    const raw = sessionStorage.getItem(SECTION_ROUTES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [section, href] of Object.entries(parsed)) {
      const mapped = asNavSection(section);
      if (mapped && typeof href === "string" && href)
        sectionRoutes.set(mapped, href);
    }
  } catch {
    /* sessionStorage can be missing or blocked */
  }
}

function persistSectionRoutes() {
  try {
    sessionStorage.setItem(
      SECTION_ROUTES_KEY,
      JSON.stringify(Object.fromEntries(sectionRoutes)),
    );
  } catch {
    /* sessionStorage can be missing or blocked */
  }
}

function hydrateSectionRoutes() {
  if (sectionRoutesHydrated) return;
  sectionRoutesHydrated = true;
  readStoredSectionRoutes();
}

export function rememberSectionRoute(route: string) {
  hydrateSectionRoutes();
  const section = navSection(route);
  sectionRoutes.set(section, route || SECTION_LIST_HREF[section]);
  persistSectionRoutes();
}

export function lastSectionRoute(section: NavSection) {
  hydrateSectionRoutes();
  return sectionRoutes.get(section) || SECTION_LIST_HREF[section];
}

export function isRememberedRouteAvailable(
  route: string,
  options: {
    hasPokemon: (id: string) => boolean;
    hasHabitat: (id: string) => boolean;
    hasRecipe?: (id: string) => boolean;
    hasItem?: (id: string) => boolean;
  },
) {
  const parsed = parseRoute(route);
  if (parsed.page === "pokemon")
    return Boolean(parsed.id) && options.hasPokemon(parsed.id);
  if (parsed.page === "habitat-detail")
    return Boolean(parsed.habitatId) && options.hasHabitat(parsed.habitatId);
  if (parsed.page === "items-recipe")
    return Boolean(parsed.recipeId) && (options.hasRecipe?.(parsed.recipeId) ?? true);
  if (parsed.page === "item-detail")
    return Boolean(parsed.itemId) && (options.hasItem?.(parsed.itemId) ?? true);
  return true;
}

export function sectionHref(
  section: NavSection,
  available: (route: string) => boolean = () => true,
) {
  const remembered = lastSectionRoute(section);
  if (!available(remembered)) return SECTION_LIST_HREF[section];
  return remembered;
}

export function isUnmodifiedLeftClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function resetNavigationMemory() {
  sectionRoutes.clear();
  sectionRoutesHydrated = false;
  try {
    sessionStorage.removeItem(SECTION_ROUTES_KEY);
  } catch {
    /* sessionStorage can be missing or blocked */
  }
}
