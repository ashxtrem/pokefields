import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Catalog } from "../src/catalog/types";
import { recipeHref } from "../src/crafting/types";
import { locationTargetId } from "../src/items/locations";
import { kitForItem, requiredByItem } from "../src/items/requiredBy";
import {
  collectibleSets,
  coverageLabel,
  defaultItemTabRoutes,
  displayGroups,
  itemInTab,
  itemsListHref,
  musicCdCoverage,
  rememberedItemTabHref,
  tabCounts,
  tabFromQuery,
} from "../src/items/tabs";

const catalog = JSON.parse(
  readFileSync("public/data/catalog.json", "utf8"),
) as Catalog;

describe("item directory tabs", () => {
  it("counts each tab from the catalog, not from prose", () => {
    const counts = tabCounts(catalog.items);
    expect(counts.all).toBe(catalog.items.length);
    expect(counts.crafting).toBe(
      catalog.items.filter((item) => Boolean(item.recipe && item.recipe.length))
        .length,
    );
    expect(counts.food).toBe(
      catalog.items.filter(
        (item) =>
          (item.groups || []).includes("Food") ||
          item.recipeMeta?.kind === "cook",
      ).length,
    );
    expect(counts.buildings).toBe(
      catalog.items.filter(
        (item) =>
          (item.groups || []).includes("Buildings") ||
          (item.groups || []).includes("Kits"),
      ).length,
    );
    expect(counts.collectibles).toBe(
      catalog.items.filter((item) => {
        const groups = item.groups || [];
        return (
          groups.includes("Key Items") ||
          groups.includes("Lost Relics (L)") ||
          groups.includes("Lost Relics (S)") ||
          groups.includes("Fossils") ||
          Boolean(item.collection)
        );
      }).length,
    );
    expect(counts.all).toBeGreaterThan(counts.crafting);
    expect(
      catalog.items.filter((item) => {
        const tabs = (["crafting", "food", "buildings", "collectibles"] as const)
          .filter((tab) => itemInTab(item, tab)).length;
        return tabs >= 2;
      }).length,
    ).toBeGreaterThan(0);
  });

  it("lets a multi-section item appear under every tab it belongs to", () => {
    const egg = catalog.items.find((item) => item.id === "luckyegg")!;
    expect(itemInTab(egg, "all")).toBe(true);
    expect(itemInTab(egg, "collectibles")).toBe(true);
    expect(itemInTab(egg, "food")).toBe(false);
    expect(displayGroups(egg)).toContain("Lost Relics (small)");
  });

  it("reads unsorted items as Unsorted and does not invent a section", () => {
    const unsorted = catalog.items.filter((item) => !item.groups?.length);
    expect(unsorted.length).toBeGreaterThan(0);
    expect(displayGroups(unsorted[0])).toEqual(["Unsorted"]);
  });

  it("states music CD coverage from the highest number, not the documented count", () => {
    const coverage = musicCdCoverage(catalog.items);
    expect(coverage.documented).toBeGreaterThan(0);
    expect(coverage.setSize).toBeGreaterThan(coverage.documented);
    expect(coverageLabel(coverage.documented, coverage.setSize)).toBe(
      `${coverage.documented} of ${coverage.setSize} documented`,
    );
    expect(coverageLabel(coverage.documented, coverage.setSize)).not.toBe(
      `${coverage.documented} of ${coverage.documented} documented`,
    );
    const disc = catalog.items.find((item) => item.id === "pallettown")!;
    expect(disc.collection).toEqual({ set: "music-cd", number: 2 });
    expect(itemInTab(disc, "collectibles")).toBe(true);
    const sets = collectibleSets(catalog.items);
    const relics = sets.find((set) => set.id === "lost-relics-s");
    expect(relics).toBeDefined();
    expect(relics!.setSize).toBeNull();
    expect(coverageLabel(relics!.documented, relics!.setSize)).toBe(
      `${relics!.documented} documented`,
    );
  });

  it("groups wallpapers as such without inventing a set number", () => {
    const paper = catalog.items.find((item) =>
      /\(wallpaper\)/i.test(item.name),
    )!;
    expect(displayGroups(paper)).toContain("Wallpaper");
    expect(paper.collection).toBeUndefined();
  });
});

describe("item directory routes", () => {
  it("keeps recipe links on the Items recipe path", () => {
    expect(recipeHref("recipe:stool:default")).toBe(
      "#/items/recipe/recipe%3Astool%3Adefault",
    );
  });

  it("opens the crafting tab for a uses= query with no tab", () => {
    expect(tabFromQuery("uses=lumber")).toBe("crafting");
    expect(tabFromQuery("tab=food&uses=lumber")).toBe("food");
  });

  it("resumes the last item on a tab and falls back when that item is gone", () => {
    const remembered = {
      ...defaultItemTabRoutes(),
      collectibles: "#/items/pallettown?tab=collectibles",
      food: "#/items/missing-soup?tab=food",
    };
    expect(rememberedItemTabHref("collectibles", remembered)).toBe(
      "#/items/pallettown?tab=collectibles",
    );
    expect(
      rememberedItemTabHref("food", remembered, (href) => href.includes("missing") ? false : true),
    ).toBe(itemsListHref("food"));
  });
});

describe("item detail facts", () => {
  it("links kit-sourced locations to the kit item", () => {
    expect(locationTargetId("Relaxing park kit (Build Kit)", catalog.items)).toBe(
      "relaxingparkkit",
    );
  });

  it("shows a structure kit without treating undocumented figures as zero", () => {
    const item = catalog.items.find((row) => row.id === "concertstagekit")!;
    const kit = kitForItem(catalog, item)!;
    expect(kit.kind).toBe("structure");
    const centre = kitForItem(
      catalog,
      catalog.items.find((row) => row.id === "beachpokemoncenterkit")!,
    )!;
    expect(centre.width).toBeNull();
  });

  it("finds habitat requirements that name an item", () => {
    const tallGrass = catalog.items.find((item) => item.id === "tallgrass");
    if (!tallGrass) return;
    const uses = requiredByItem(catalog, tallGrass.id);
    expect(uses.habitats.length).toBeGreaterThan(0);
  });
});
