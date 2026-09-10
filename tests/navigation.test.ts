import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalItemsHref,
  isRememberedRouteAvailable,
  lastSectionRoute,
  navSection,
  parseRoute,
  rememberSectionRoute,
  resetNavigationMemory,
  routeKey,
  sectionHref,
} from "../src/ui/navigation";

const always = () => true;
const catalog = {
  hasPokemon: (id: string) => id === "ivysaur",
  hasHabitat: (id: string) => id === "fieldofflowers",
  hasRecipe: (id: string) => id === "recipe:stool:default",
  hasItem: (id: string) => id === "pallettown",
};

beforeEach(() => {
  resetNavigationMemory();
});

describe("parseRoute and navSection", () => {
  it("groups Pokémon details with the Pokédex section", () => {
    expect(parseRoute("#/pokemon/ivysaur").page).toBe("pokemon");
    expect(navSection("#/pokemon/ivysaur")).toBe("dex");
  });

  it("groups habitat details with Habitats", () => {
    expect(parseRoute("#/habitats/fieldofflowers").page).toBe("habitat-detail");
    expect(navSection("#/habitats/fieldofflowers")).toBe("habitats");
  });

  it("groups item and recipe details with Items and matches specific paths first", () => {
    expect(parseRoute("#/items/recipe/recipe%3Astool%3Adefault")).toEqual({
      page: "items-recipe",
      recipeId: "recipe:stool:default",
      query: "",
    });
    expect(parseRoute("#/items/pallettown")).toEqual({
      page: "item-detail",
      itemId: "pallettown",
      query: "",
    });
    expect(parseRoute("#/items?tab=collectibles")).toEqual({
      page: "items",
      query: "tab=collectibles",
    });
    expect(navSection("#/items/recipe/recipe:stool:default")).toBe("items");
    expect(navSection("#/items/pallettown")).toBe("items");
  });

  it("treats shipped crafting hashes as Items routes", () => {
    expect(parseRoute("#/crafting/recipe/recipe%3Astool%3Adefault")).toEqual({
      page: "items-recipe",
      recipeId: "recipe:stool:default",
      query: "",
    });
    expect(parseRoute("#/crafting/list").page).toBe("items");
    expect(parseRoute("#/crafting").query).toBe("tab=crafting");
    expect(parseRoute("#/crafting?uses=lumber").query).toContain("uses=lumber");
    expect(parseRoute("#/crafting?uses=lumber").query).toContain("tab=crafting");
    expect(navSection("#/crafting/recipe/recipe:stool:default")).toBe("items");
    expect(navSection("#/crafting/list")).toBe("items");
  });

  it("keeps query parameters on remembered habitat routes", () => {
    expect(parseRoute("#/habitats?region=Beach")).toEqual({
      page: "habitats",
      query: "region=Beach",
    });
  });

  it("keeps Items tab in the scroll key so directory tabs restore independently", () => {
    expect(routeKey("#/items?tab=collectibles")).toBe("#/items?tab=collectibles");
    expect(routeKey("#/items?tab=food")).toBe("#/items?tab=food");
    expect(routeKey("#/items?tab=crafting&uses=lumber")).toBe(
      "#/items?tab=crafting",
    );
    expect(routeKey("#/habitats?region=Beach")).toBe("#/habitats");
    expect(routeKey("#/items/pallettown?tab=collectibles")).toBe(
      "#/items/pallettown?tab=collectibles",
    );
  });
});

describe("crafting redirects", () => {
  it("rewrites shipped crafting hashes to Items URLs and keeps uses= deep links", () => {
    expect(canonicalItemsHref("#/crafting")).toBe("#/items?tab=crafting");
    expect(canonicalItemsHref("#/crafting?uses=lumber")).toBe(
      "#/items?uses=lumber&tab=crafting",
    );
    expect(canonicalItemsHref("#/crafting/recipe/recipe:stool:default")).toBe(
      "#/items/recipe/recipe%3Astool%3Adefault",
    );
    expect(canonicalItemsHref("#/items?tab=crafting")).toBeNull();
  });
});

describe("section resumption", () => {
  it("resumes the last Pokémon after visiting a habitat", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers");
    expect(sectionHref("dex", always)).toBe("#/pokemon/ivysaur");
    expect(sectionHref("habitats", always)).toBe("#/habitats/fieldofflowers");
  });

  it("lets an explicit list visit replace the section memory", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/dex");
    rememberSectionRoute("#/habitats/fieldofflowers");
    expect(sectionHref("dex", always)).toBe("#/dex");
    expect(sectionHref("habitats", always)).toBe("#/habitats/fieldofflowers");
  });

  it("falls back to the section list when a remembered entry is gone", () => {
    rememberSectionRoute("#/pokemon/missingno");
    rememberSectionRoute("#/habitats/unknown-glade");
    rememberSectionRoute("#/items/missing-item");
    const available = (route: string) =>
      isRememberedRouteAvailable(route, catalog);
    expect(sectionHref("dex", available)).toBe("#/dex");
    expect(sectionHref("habitats", available)).toBe("#/habitats");
    expect(sectionHref("items", available)).toBe("#/items");
  });

  it("keeps chronological memory updates without replacing other sections", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers");
    rememberSectionRoute("#/planner");
    rememberSectionRoute("#/habitats");
    expect(lastSectionRoute("dex")).toBe("#/pokemon/ivysaur");
    expect(lastSectionRoute("habitats")).toBe("#/habitats");
    expect(lastSectionRoute("planner")).toBe("#/planner");
  });

  it("resumes an items recipe independently of other sections", () => {
    rememberSectionRoute("#/items/recipe/recipe:stool:default");
    rememberSectionRoute("#/planner");
    expect(sectionHref("items", always)).toBe(
      "#/items/recipe/recipe:stool:default",
    );
    expect(sectionHref("planner", always)).toBe("#/planner");
  });

  it("restores a shipped-build crafting sessionStorage key as Items", () => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(
      "pkm.nav.sections",
      JSON.stringify({
        crafting: "#/crafting/recipe/recipe:stool:default",
      }),
    );
    expect(lastSectionRoute("items")).toBe(
      "#/crafting/recipe/recipe:stool:default",
    );
    expect(
      isRememberedRouteAvailable("#/crafting/recipe/recipe:stool:default", catalog),
    ).toBe(true);
  });

  it("restores section routes after a session reload", () => {
    if (typeof sessionStorage === "undefined") return;
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers?region=Beach");
    const stored = sessionStorage.getItem("pkm.nav.sections");
    expect(stored).toBeTruthy();
    resetNavigationMemory();
    sessionStorage.setItem("pkm.nav.sections", stored!);
    expect(lastSectionRoute("dex")).toBe("#/pokemon/ivysaur");
    expect(lastSectionRoute("habitats")).toBe(
      "#/habitats/fieldofflowers?region=Beach",
    );
  });
});
