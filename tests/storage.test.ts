import { describe, expect, it } from "vitest";
import {
  ChestLimitError,
  assertChestLimit,
  buildChest,
  defaultChestName,
  dedupeItemRefs,
  withCompleteScanReplaced,
  withItemRefQuantity,
  withItemRefRemoved,
  withItemRefReplaced,
  withItemRefsAdded,
  withPartialScanMerged,
} from "../src/storage/repository";
import { emptyChest, newUid, type StorageChest, type StorageItemRef } from "../src/storage/types";
import { MAX_CHESTS } from "../src/storage/constants";

function chest(overrides: Partial<StorageChest> = {}): StorageChest {
  return emptyChest({
    id: "chest:1",
    name: "Test chest",
    regionId: "Bleak Beach",
    type: "storage-box",
    catalogVersion: "test",
    ...overrides,
  });
}

describe("chest limit", () => {
  it("allows creating a chest under the limit", () => {
    const created = buildChest(
      { regionId: "Bleak Beach", type: "storage-box", catalogVersion: "test" },
      [],
    );
    expect(created.itemRefs).toEqual([]);
    expect(created.name).toBe("Bleak Beach · Chest 01");
  });

  it("numbers a default name by how many chests already exist in that region", () => {
    const existing = [chest({ id: "a", regionId: "Bleak Beach" }), chest({ id: "b", regionId: "Bleak Beach" })];
    expect(defaultChestName("Bleak Beach", existing)).toBe("Bleak Beach · Chest 03");
    expect(defaultChestName("Cloud Island", existing)).toBe("Cloud Island · Chest 01");
  });

  it("throws ChestLimitError at the centralized MAX_CHESTS constant", () => {
    const existing = Array.from({ length: MAX_CHESTS }, (_, index) => chest({ id: `chest:${index}` }));
    expect(() => assertChestLimit(existing.length)).toThrow(ChestLimitError);
    expect(() =>
      buildChest({ regionId: "Bleak Beach", type: "storage-box", catalogVersion: "test" }, existing),
    ).toThrow(ChestLimitError);
  });

  it("does not throw one chest under the limit", () => {
    const existing = Array.from({ length: MAX_CHESTS - 1 }, (_, index) => chest({ id: `chest:${index}` }));
    expect(() => assertChestLimit(existing.length)).not.toThrow();
  });
});

describe("presence-only item references", () => {
  const catalogRef = (id: string): StorageItemRef => ({ kind: "catalog", itemId: id });

  it("adds a reference once even when selected repeatedly", () => {
    let c = chest();
    c = withItemRefsAdded(c, [catalogRef("wildflowers")]);
    c = withItemRefsAdded(c, [catalogRef("wildflowers")]);
    expect(c.itemRefs).toEqual([catalogRef("wildflowers")]);
  });

  it("removes a reference", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("wildflowers"), catalogRef("laptop")]);
    c = withItemRefRemoved(c, catalogRef("wildflowers"));
    expect(c.itemRefs).toEqual([catalogRef("laptop")]);
  });

  it("dedupes a batch of refs before saving a reviewed scan", () => {
    const refs = dedupeItemRefs([catalogRef("a"), catalogRef("b"), catalogRef("a")]);
    expect(refs).toEqual([catalogRef("a"), catalogRef("b")]);
  });

  it("presence stays a single entry regardless of quantity — repeated adds do not grow the array", () => {
    let c = chest();
    for (let i = 0; i < 5; i += 1) c = withItemRefsAdded(c, [catalogRef("nugget")]);
    expect(c.itemRefs).toHaveLength(1);
  });
});

describe("optional per-item quantity (player tracking only)", () => {
  const catalogRef = (id: string, quantity?: number): StorageItemRef => ({
    kind: "catalog",
    itemId: id,
    quantity,
  });

  it("re-adding an already-present ref with an explicit quantity sums onto the existing quantity", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("nugget", 2)]);
    c = withItemRefsAdded(c, [catalogRef("nugget", 3)]);
    expect(c.itemRefs).toEqual([catalogRef("nugget", 5)]);
  });

  it("re-adding with no quantity leaves the existing quantity untouched", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("nugget", 2)]);
    c = withItemRefsAdded(c, [catalogRef("nugget")]);
    expect(c.itemRefs).toEqual([catalogRef("nugget", 2)]);
  });

  it("withItemRefQuantity sets, updates, and clears a quantity without affecting identity", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("nugget")]);
    c = withItemRefQuantity(c, catalogRef("nugget"), 4);
    expect(c.itemRefs).toEqual([catalogRef("nugget", 4)]);
    c = withItemRefQuantity(c, catalogRef("nugget"), undefined);
    expect(c.itemRefs).toEqual([catalogRef("nugget")]);
  });

  it("withItemRefQuantity rejects non-whole or non-positive quantities", () => {
    const c = withItemRefsAdded(chest(), [catalogRef("nugget")]);
    expect(() => withItemRefQuantity(c, catalogRef("nugget"), 0)).toThrow();
    expect(() => withItemRefQuantity(c, catalogRef("nugget"), -1)).toThrow();
    expect(() => withItemRefQuantity(c, catalogRef("nugget"), 1.5)).toThrow();
  });
});

describe("replacing an item reference", () => {
  const catalogRef = (id: string, quantity?: number): StorageItemRef => ({
    kind: "catalog",
    itemId: id,
    quantity,
  });

  it("swaps one ref for another in place, preserving quantity and position", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("a"), catalogRef("nugget", 3), catalogRef("b")]);
    c = withItemRefReplaced(c, catalogRef("nugget"), catalogRef("big-nugget"));
    expect(c.itemRefs).toEqual([catalogRef("a"), catalogRef("big-nugget", 3), catalogRef("b")]);
  });

  it("merges into an existing row (summing quantities) rather than creating a duplicate", () => {
    let c = withItemRefsAdded(chest(), [catalogRef("nugget", 2), catalogRef("big-nugget", 5)]);
    c = withItemRefReplaced(c, catalogRef("nugget"), catalogRef("big-nugget"));
    expect(c.itemRefs).toEqual([catalogRef("big-nugget", 7)]);
  });

  it("is a no-op when the old ref is not present", () => {
    const c = withItemRefsAdded(chest(), [catalogRef("a")]);
    expect(withItemRefReplaced(c, catalogRef("missing"), catalogRef("b"))).toBe(c);
  });
});

describe("rescan rules", () => {
  const catalogRef = (id: string): StorageItemRef => ({ kind: "catalog", itemId: id });

  it("a partial rescan preserves unseen existing items", () => {
    const existing = withItemRefsAdded(chest(), [catalogRef("a"), catalogRef("b")]);
    const merged = withPartialScanMerged(existing, [catalogRef("c")], []);
    expect(merged.itemRefs.map((r) => (r as { itemId: string }).itemId).sort()).toEqual(["a", "b", "c"]);
    expect(merged.lastScanKind).toBe("partial");
  });

  it("a complete rescan replaces existing contents", () => {
    const existing = withItemRefsAdded(chest(), [catalogRef("a"), catalogRef("b")]);
    const replaced = withCompleteScanReplaced(existing, [catalogRef("c")], []);
    expect(replaced.itemRefs).toEqual([catalogRef("c")]);
    expect(replaced.lastScanKind).toBe("complete");
    expect(replaced.lastCompleteScanAt).toBeTruthy();
  });

  it("a partial rescan never removes items the way a complete rescan does", () => {
    const existing = withItemRefsAdded(chest(), [catalogRef("a")]);
    const partial = withPartialScanMerged(existing, [], []);
    expect(partial.itemRefs).toEqual([catalogRef("a")]);
  });
});

describe("newUid", () => {
  it("produces unique, non-empty ids even when crypto.randomUUID is unavailable", () => {
    // crypto.randomUUID() throws/is undefined outside a secure context (plain HTTP on a LAN
    // address, e.g. `vite --host` for phone testing) — this is the exact bug report this guards.
    const original = crypto.randomUUID;
    // @ts-expect-error simulating an insecure context where randomUUID does not exist
    delete crypto.randomUUID;
    try {
      const a = newUid();
      const b = newUid();
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a).not.toBe(b);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it("uses crypto.randomUUID directly when it is available", () => {
    const original = crypto.randomUUID;
    crypto.randomUUID = () => "fixed-uuid-value" as ReturnType<typeof crypto.randomUUID>;
    try {
      expect(newUid()).toBe("fixed-uuid-value");
    } finally {
      crypto.randomUUID = original;
    }
  });
});
