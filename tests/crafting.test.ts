import { describe, expect, it } from "vitest";
import type { Catalog, Item } from "../src/catalog/types";
import {
  listRecipes,
  normalizeItemRecipe,
} from "../src/crafting/catalog";
import { resolveExactItemId, buildItemIndex } from "../src/crafting/identity";
import { toggleLearned } from "../src/crafting/learned";
import { defaultRecipeFilters, filterRecipes } from "../src/crafting/search";
import { hasRecordedUnlock } from "../src/crafting/locations";
import {
  emptyCraftingState,
  UNLOCK_EMPTY_WHY,
  type NormalizedRecipe,
} from "../src/crafting/types";

const item = (
  id: string,
  name: string,
  extra: Partial<Item> = {},
): Item => ({
  id,
  name,
  categories: extra.categories || ["Wooden stuff"],
  source: "https://example.com",
  ...extra,
});

const catalog = (items: Item[]): Catalog => ({
  version: "test",
  pokemon: [],
  kits: [],
  items,
  areas: [],
  sources: [],
});

function recipe(
  overrides: Partial<NormalizedRecipe> & Pick<NormalizedRecipe, "id" | "outputItemId">,
): NormalizedRecipe {
  return {
    outputName: overrides.outputName || overrides.outputItemId,
    categories: ["Wooden stuff"],
    source: "https://example.com",
    kind: "craft",
    kindEvidence: { provider: "fixture", sourceUrl: "https://example.com" },
    ingredients: overrides.ingredients || [
      {
        rowId: `${overrides.id}:row:0`,
        originalLabel: "Lumber",
        identity: { type: "resolved", itemId: "lumber" },
        quantity: 2,
        countEvidence: { provider: "fixture", sourceUrl: "https://example.com" },
        locations: ["Rocky Ridges (Natural)"],
        locationEvidence: { provider: "fixture", sourceUrl: "https://example.com" },
      },
    ],
    specialty: null,
    unlock: overrides.unlock || { methods: [], conflicts: [] },
    countProvenance: "pokopiaapi",
    conflicts: overrides.conflicts || [],
    ...overrides,
  };
}

describe("D-ID-02 identity", () => {
  it("resolves unique names and reviewed aliases through a catalog index", () => {
    const items = [
      item("lumber", "Lumber"),
      item("lightbrownrock", "Lightbrown Rock"),
      item("ironore", "Iron ore"),
      item("ironornament", "Iron ornament"),
    ];
    const index = buildItemIndex(items);
    expect(resolveExactItemId("Lumber", index)).toBe("lumber");
    expect(resolveExactItemId("light-brown rock", index)).toBe("lightbrownrock");
    expect(resolveExactItemId("Iron ore", index)).toBe("ironore");
    expect(resolveExactItemId("Iron o", items)).toBeNull();
  });
});

describe("recipe normalization", () => {
  it("does not promote item locations into unlock guidance", () => {
    const bench = item("bench", "Bench", {
      locations: ["Rocky Ridges (Natural)", "Craft from recipe"],
      recipe: [{ name: "Lumber", quantity: 1 }],
    });
    const lumber = item("lumber", "Lumber", {
      locations: ["Rocky Ridges (Natural)"],
    });
    const normalized = normalizeItemRecipe(bench, [bench, lumber]);
    expect(normalized?.unlock.methods).toEqual([]);
    expect(normalized?.ingredients[0].locations).toEqual([
      "Rocky Ridges (Natural)",
    ]);
  });

  it("keeps recorded unlock methods with their source", () => {
    const stool = item("stool", "Stool", {
      recipe: [{ name: "Lumber", quantity: 1 }],
      recipeMeta: {
        unlock: {
          methods: [
            {
              text: "Daily Shop Special · Sparkling Water",
              provider: "Serebii item page Recipe section",
              sourceUrl: "https://www.serebii.net/pokemonpokopia/items/stool.shtml",
              retrievedAt: "2026-09-10",
            },
          ],
          conflicts: [],
        },
      },
    });
    const lumber = item("lumber", "Lumber");
    const normalized = normalizeItemRecipe(stool, [stool, lumber]);
    expect(hasRecordedUnlock(normalized!)).toBe(true);
    expect(normalized?.unlock.methods[0].text).toContain("Daily Shop Special");
  });

  it("labels cooking counts as importer defaults", () => {
    const salad = item("salad", "Salad", {
      locations: ["Cook with ingredients"],
      recipe: [{ name: "Leaf", quantity: 1 }],
      recipeSpecialty: "Chop",
    });
    const leaf = item("leaf", "Leaf");
    const normalized = normalizeItemRecipe(salad, [salad, leaf]);
    expect(normalized?.kind).toBe("cook");
    expect(normalized?.countProvenance).toBe("importer-default");
    expect(normalized?.specialty).toBe("Chop");
  });

  it("keeps ingredient conflicts without merging bundles", () => {
    const steps = item("woodensteps", "Wooden steps", {
      recipe: [{ name: "Lumber", quantity: 2 }],
      recipeMeta: {
        conflicts: [
          {
            fields: ["ingredients"],
            summary: "Sources disagree on the ingredient list.",
          },
        ],
      },
    });
    const lumber = item("lumber", "Lumber");
    const normalized = normalizeItemRecipe(steps, [steps, lumber]);
    expect(normalized?.conflicts.length).toBeGreaterThan(0);
    expect(normalized?.ingredients[0].quantity).toBe(2);
  });

  it("marks unresolved ingredients without a location list", () => {
    const lamp = item("lamp", "Lamp", {
      recipe: [{ name: "Unknown Widget", quantity: 1 }],
    });
    const normalized = normalizeItemRecipe(lamp, [lamp]);
    expect(normalized?.ingredients[0].identity.type).toBe("unresolved");
    expect(normalized?.ingredients[0].locations).toEqual([]);
  });
});

describe("learned marks and filters", () => {
  const recipes = [
    recipe({
      id: "recipe:a:default",
      outputItemId: "a",
      outputName: "Alpha",
      unlock: {
        methods: [
          {
            text: "Talk to Slowpoke",
            provider: "Serebii",
            sourceUrl: "https://example.com",
            retrievedAt: "2026-09-10",
          },
        ],
        conflicts: [],
      },
    }),
    recipe({
      id: "recipe:b:default",
      outputItemId: "b",
      outputName: "Beta",
    }),
  ];

  it("never infers a mark from an empty notebook", () => {
    expect(emptyCraftingState().learnedRecipeIds).toEqual([]);
    expect(UNLOCK_EMPTY_WHY).toMatch(/not guessed/i);
  });

  it("toggles learned as a filter lens only", () => {
    const marked = toggleLearned(emptyCraftingState(), "recipe:a:default");
    expect(marked.learnedRecipeIds).toEqual(["recipe:a:default"]);
    expect(
      toggleLearned(marked, "recipe:a:default").learnedRecipeIds,
    ).toEqual([]);
  });

  it("hides learned recipes and sorts recorded guidance first", () => {
    const hidden = filterRecipes(recipes, ["recipe:a:default"], {
      ...defaultRecipeFilters(),
      hideLearned: true,
    });
    expect(hidden.map((row) => row.id)).toEqual(["recipe:b:default"]);
    const ordered = filterRecipes(recipes, [], defaultRecipeFilters());
    expect(ordered.map((row) => row.id)).toEqual([
      "recipe:a:default",
      "recipe:b:default",
    ]);
  });

  it("intersects name and category", () => {
    const none = filterRecipes(recipes, [], {
      ...defaultRecipeFilters(),
      search: "zzz",
    });
    expect(none).toEqual([]);
  });
});

describe("listRecipes", () => {
  it("includes every nonempty recipe once", () => {
    const items = [
      item("lumber", "Lumber"),
      item("bench", "Bench", { recipe: [{ name: "Lumber", quantity: 1 }] }),
      item("plant", "Plant"),
    ];
    expect(listRecipes(catalog(items)).map((row) => row.outputItemId)).toEqual([
      "bench",
    ]);
  });
});
