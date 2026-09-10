import { describe, expect, it } from "vitest";
import type { Catalog, Item } from "../src/catalog/types";
import { toggleLearned } from "../src/crafting/learned";
import {
  loadCraftingFields,
  normalizeCraftingState,
} from "../src/crafting/migration";
import { applyUndoStack, type ProgressUndoEntry } from "../src/crafting/undo";
import { emptyCraftingState } from "../src/crafting/types";
import { emptyState, validateBackup } from "../src/persistence/store";

const catalog: Catalog = {
  version: "test",
  pokemon: [],
  kits: [],
  items: [
    {
      id: "plant",
      name: "Plant",
      categories: [],
      source: "https://example.com",
    },
    {
      id: "lumber",
      name: "Lumber",
      categories: [],
      source: "https://example.com",
    },
    {
      id: "bench",
      name: "Bench",
      categories: ["Wooden stuff"],
      source: "https://example.com",
      locations: ["Craft from recipe"],
      recipe: [{ name: "Lumber", quantity: 1 }],
    } satisfies Item,
  ],
  areas: ["Beach"],
  sources: [],
};

describe("D-MIG-01 crafting persistence", () => {
  it("treats a missing crafting payload as empty marks", () => {
    expect(normalizeCraftingState(undefined, catalog)).toEqual(
      emptyCraftingState(),
    );
    const legacy = {
      schemaVersion: 1 as const,
      found: {},
      plans: {},
    };
    expect(validateBackup(legacy, catalog).crafting).toEqual(
      emptyCraftingState(),
    );
  });

  it("migrates version-1 marks including those held only on orphans", () => {
    const raw = {
      version: 1,
      learnedRecipeIds: ["recipe:bench:default"],
      entries: [
        {
          id: "entry:1",
          recipeId: "recipe:bench:default",
          quantityMode: "list",
          target: 2,
          completed: 1,
        },
      ],
      orphans: [
        {
          recipeId: "recipe:ghost:default",
          learned: true,
          entries: [{ id: "ghost-entry" }],
          reason: "This recipe is no longer in the catalog.",
        },
      ],
    };
    const loaded = loadCraftingFields({ crafting: raw }, catalog);
    expect(loaded.crafting.learnedRecipeIds).toEqual([
      "recipe:bench:default",
      "recipe:ghost:default",
    ]);
    expect(loaded.craftingLegacySnapshot).toEqual({
      version: 1,
      learnedRecipeIds: raw.learnedRecipeIds,
      entries: raw.entries,
      orphans: raw.orphans,
    });
  });

  it("retains marks for recipes absent from the catalog", () => {
    const raw = { version: 2, learnedRecipeIds: ["recipe:ghost:default"] };
    expect(normalizeCraftingState(raw, catalog).learnedRecipeIds).toEqual([
      "recipe:ghost:default",
    ]);
  });

  it("loads a version-2 payload unchanged", () => {
    const raw = {
      version: 2,
      learnedRecipeIds: ["recipe:bench:default"],
    };
    expect(normalizeCraftingState(raw, catalog)).toEqual(raw);
  });

  it("rejects a version-3 payload on backup validation", () => {
    expect(() =>
      normalizeCraftingState(
        { version: 3, learnedRecipeIds: [] },
        catalog,
      ),
    ).toThrow(/newer crafting format/);
    expect(() =>
      validateBackup(
        {
          schemaVersion: 1,
          found: {},
          plans: {},
          crafting: { version: 3, learnedRecipeIds: [] },
        },
        catalog,
      ),
    ).toThrow(/newer crafting format/);
  });

  it("quarantines an unreadable payload on load and keeps it through later fields", () => {
    const raw = { version: 3, learnedRecipeIds: ["secret"] };
    const first = loadCraftingFields({ crafting: raw }, catalog);
    expect(first.crafting).toEqual(emptyCraftingState());
    expect(first.craftingQuarantine?.raw).toEqual(raw);
    expect(first.craftingQuarantine?.reason).toMatch(/newer crafting format/);
    const second = loadCraftingFields(
      {
        crafting: emptyCraftingState(),
        craftingQuarantine: first.craftingQuarantine,
      },
      catalog,
    );
    expect(second.craftingQuarantine).toEqual(first.craftingQuarantine);
    const exported = validateBackup(
      {
        schemaVersion: 1,
        found: {},
        plans: {},
        crafting: emptyCraftingState(),
        craftingQuarantine: first.craftingQuarantine,
      },
      catalog,
    );
    expect(exported.craftingQuarantine?.raw).toEqual(raw);
  });
});

describe("D-UNDO-01 scoped undo", () => {
  it("restores only crafting and leaves unrelated progress", () => {
    const before = emptyState();
    const afterMark = {
      ...before,
      crafting: toggleLearned(emptyCraftingState(), "recipe:bench:default"),
      found: { bulbasaur: ["Beach"] },
    };
    const result = applyUndoStack(
      [
        {
          label: "Marked learned",
          state: before,
          fields: ["crafting"],
          after: { crafting: afterMark.crafting },
        },
      ],
      afterMark,
    );
    expect(result.current.crafting).toEqual(emptyCraftingState());
    expect(result.current.found).toEqual({ bulbasaur: ["Beach"] });
    expect(result.stack).toEqual([]);
  });

  it("leaves the stack unchanged when a later crafting edit blocks undo", () => {
    const start = emptyState();
    const marked = {
      ...start,
      crafting: toggleLearned(emptyCraftingState(), "recipe:bench:default"),
    };
    const later = {
      ...marked,
      crafting: toggleLearned(marked.crafting!, "recipe:ghost:default"),
    };
    const stack: ProgressUndoEntry[] = [
      {
        label: "Marked learned",
        state: start,
        fields: ["crafting"],
        after: { crafting: marked.crafting },
      },
    ];
    const refused = applyUndoStack(stack, later);
    expect(refused.error).toMatch(/later change/);
    expect(refused.stack).toEqual(stack);
    expect(refused.current.crafting).toEqual(later.crafting);
  });
});
