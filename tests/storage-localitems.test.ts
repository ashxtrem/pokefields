import { describe, expect, it } from "vitest";
import type { Catalog, Item } from "../src/catalog/types";
import {
  buildLocalItem,
  findNameCollision,
  isLocalItemReferenced,
  rewriteChestsForCatalogLink,
  rewriteChestsForMerge,
} from "../src/storage/localItems";
import { withItemRefsAdded } from "../src/storage/repository";
import { emptyChest, type StorageChest } from "../src/storage/types";

const catalog: Catalog = {
  version: "test",
  pokemon: [],
  kits: [],
  items: [{ id: "nugget", name: "Nugget", categories: [], source: "https://example.com" } satisfies Item],
  areas: ["Bleak Beach"],
  sources: [],
};

function chest(id: string): StorageChest {
  return emptyChest({ id, name: "Chest", regionId: "Bleak Beach", type: "storage-box", catalogVersion: "test" });
}

describe("local item creation and collisions", () => {
  it("warns when a name collides with a catalog item", () => {
    const collision = findNameCollision("nugget", catalog, []);
    expect(collision).toEqual({ kind: "catalog", itemId: "nugget", name: "Nugget" });
  });

  it("warns when a name collides with an existing local item", () => {
    const existing = buildLocalItem({ name: "Mystery gadget" });
    const collision = findNameCollision("mystery gadget", catalog, [existing]);
    expect(collision).toEqual({ kind: "local", localItemId: existing.id, name: "Mystery gadget" });
  });

  it("does not collide with a merged-away local item", () => {
    const existing = { ...buildLocalItem({ name: "Old gadget" }), mergedIntoLocalItemId: "local:target" };
    expect(findNameCollision("old gadget", catalog, [existing])).toBeNull();
  });

  it("creates a stable local:<uuid> id and a normalized name", () => {
    const item = buildLocalItem({ name: "  Future DLC Item  " });
    expect(item.id.startsWith("local:")).toBe(true);
    expect(item.normalizedName).toBe("future dlc item");
  });
});

describe("local item merge and catalog link", () => {
  it("merge rewrites every chest's references atomically and dedupes if the target is already present", () => {
    const chests = [
      withItemRefsAdded(chest("a"), [{ kind: "local", localItemId: "local:from" }]),
      withItemRefsAdded(chest("b"), [
        { kind: "local", localItemId: "local:from" },
        { kind: "local", localItemId: "local:to" },
      ]),
      chest("c"),
    ];
    const rewritten = rewriteChestsForMerge(chests, "local:from", "local:to");
    expect(rewritten[0]!.itemRefs).toEqual([{ kind: "local", localItemId: "local:to" }]);
    // chest b already had the merge target — must not end up with a duplicate reference.
    expect(rewritten[1]!.itemRefs).toEqual([{ kind: "local", localItemId: "local:to" }]);
    expect(rewritten[2]!.itemRefs).toEqual([]);
  });

  it("catalog-link rewriting never happens without an explicit call — never auto-merges", () => {
    const chests = [withItemRefsAdded(chest("a"), [{ kind: "local", localItemId: "local:x" }])];
    // Simply having a name collision (see findNameCollision above) does not by itself change any
    // chest reference; only an explicit rewriteChestsForCatalogLink call does.
    expect(chests[0]!.itemRefs).toEqual([{ kind: "local", localItemId: "local:x" }]);
    const linked = rewriteChestsForCatalogLink(chests, "local:x", "nugget");
    expect(linked[0]!.itemRefs).toEqual([{ kind: "catalog", itemId: "nugget" }]);
  });

  it("delete is guarded while any chest still references the local item", () => {
    const chests = [withItemRefsAdded(chest("a"), [{ kind: "local", localItemId: "local:x" }])];
    expect(isLocalItemReferenced("local:x", chests)).toBe(true);
    expect(isLocalItemReferenced("local:unused", chests)).toBe(false);
  });
});
