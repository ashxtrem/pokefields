import { describe, expect, it } from "vitest";
import type { Catalog, Item } from "../src/catalog/types";
import {
  toggleCollected,
  unavailableCollected,
  visibleCollectedCount,
} from "../src/items/collected";
import { applyUndoStack, type ProgressUndoEntry } from "../src/crafting/undo";
import { emptyState, validateBackup } from "../src/persistence/store";

const catalog: Catalog = {
  version: "test",
  pokemon: [],
  kits: [],
  items: [
    {
      id: "pallettown",
      name: "Pallet Town",
      categories: ["Round stuff"],
      source: "https://example.com",
      collection: { set: "music-cd", number: 2 },
    } satisfies Item,
  ],
  areas: ["Beach"],
  sources: [],
};

describe("collected marks", () => {
  it("imports a pre-change backup with no marks and nothing else altered", () => {
    const legacy = {
      schemaVersion: 1 as const,
      found: { bulbasaur: ["Beach"] },
      plans: {},
    };
    const imported = validateBackup(
      { ...legacy, found: {} },
      catalog,
    );
    expect(imported.collected).toBeUndefined();
    expect(imported.found).toEqual({});
    expect(imported.schemaVersion).toBe(1);
  });

  it("round-trips marks including ids absent from the catalog", () => {
    const marked = validateBackup(
      {
        schemaVersion: 1,
        found: {},
        plans: {},
        collected: ["pallettown", "ghost-cd"],
      },
      catalog,
    );
    expect(marked.collected).toEqual(["pallettown", "ghost-cd"]);
    expect(visibleCollectedCount(marked.collected, catalog.items.map((item) => item.id))).toBe(
      1,
    );
    expect(unavailableCollected(marked.collected, catalog.items.map((item) => item.id))).toEqual(
      ["ghost-cd"],
    );
    const again = validateBackup(JSON.parse(JSON.stringify(marked)), catalog);
    expect(again.collected).toEqual(["pallettown", "ghost-cd"]);
  });

  it("rejects an invalid collected payload without dropping other fields", () => {
    expect(() =>
      validateBackup(
        {
          schemaVersion: 1,
          found: {},
          plans: {},
          collected: [1],
        },
        catalog,
      ),
    ).toThrow(/collected marks/);
  });

  it("undo restores collected marks and leaves unrelated progress", () => {
    const before = emptyState();
    const afterMark = {
      ...before,
      collected: toggleCollected(before.collected, "pallettown"),
      found: { bulbasaur: ["Beach"] },
    };
    const result = applyUndoStack(
      [
        {
          label: "Marked collected",
          state: before,
          fields: ["collected"],
          after: { collected: afterMark.collected },
        },
      ],
      afterMark,
    );
    expect(result.current.collected).toBeUndefined();
    expect(result.current.found).toEqual({ bulbasaur: ["Beach"] });
  });

  it("leaves the stack unchanged when a later collected edit blocks undo", () => {
    const start = emptyState();
    const marked = {
      ...start,
      collected: toggleCollected(start.collected, "pallettown"),
    };
    const later = {
      ...marked,
      collected: toggleCollected(marked.collected, "ghost-cd"),
    };
    const stack: ProgressUndoEntry[] = [
      {
        label: "Marked collected",
        state: start,
        fields: ["collected"],
        after: { collected: marked.collected },
      },
    ];
    const refused = applyUndoStack(stack, later);
    expect(refused.error).toMatch(/collected marks/);
    expect(refused.stack).toEqual(stack);
    expect(refused.current.collected).toEqual(later.collected);
  });
});
