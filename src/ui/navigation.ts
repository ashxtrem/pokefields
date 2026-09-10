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
  return (route || "#/dex").split("?")[0];
}

export type NavSection = "dex" | "habitats" | "planner" | "crafting";

export type ParsedRoute =
  | { page: "habitat-detail"; habitatId: string; query: string }
  | { page: "habitats"; query: string }
  | { page: "planner"; query: string }
  | { page: "crafting-recipe"; recipeId: string; query: string }
  | { page: "crafting"; query: string }
  | { page: "pokemon"; id: string; query: string }
  | { page: "dex"; query: string };

export const SECTION_LIST_HREF: Record<NavSection, string> = {
  dex: "#/dex",
  habitats: "#/habitats",
  planner: "#/planner",
  crafting: "#/crafting",
};

const SECTION_ROUTES_KEY = "pkm.nav.sections";

const sectionRoutes = new Map<NavSection, string>();
let sectionRoutesHydrated = false;

export function parseRoute(hash: string): ParsedRoute {
  const raw = hash || "#/dex";
  const [pathPart, query = ""] = raw.replace(/^#/, "").split("?");
  const path = pathPart.replace(/^\/+/, "");
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
  if (path.startsWith("crafting/recipe/")) {
    return {
      page: "crafting-recipe" as const,
      recipeId: decodeURIComponent(path.slice("crafting/recipe/".length)),
      query,
    };
  }
  if (path === "crafting" || path.startsWith("crafting")) {
    return { page: "crafting" as const, query };
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

export function navSection(route: string): NavSection {
  const page = parseRoute(route).page;
  if (page === "habitats" || page === "habitat-detail") return "habitats";
  if (page === "planner") return "planner";
  if (page === "crafting" || page === "crafting-recipe") return "crafting";
  return "dex";
}

function isNavSection(value: string): value is NavSection {
  return (
    value === "dex" ||
    value === "habitats" ||
    value === "planner" ||
    value === "crafting"
  );
}

function readStoredSectionRoutes() {
  try {
    const raw = sessionStorage.getItem(SECTION_ROUTES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [section, href] of Object.entries(parsed)) {
      if (isNavSection(section) && typeof href === "string" && href)
        sectionRoutes.set(section, href);
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
  },
) {
  const parsed = parseRoute(route);
  if (parsed.page === "pokemon")
    return Boolean(parsed.id) && options.hasPokemon(parsed.id);
  if (parsed.page === "habitat-detail")
    return Boolean(parsed.habitatId) && options.hasHabitat(parsed.habitatId);
  if (parsed.page === "crafting-recipe")
    return Boolean(parsed.recipeId) && (options.hasRecipe?.(parsed.recipeId) ?? true);
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
