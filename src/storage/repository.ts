import { MAX_CHESTS } from "./constants";
import {
  emptyChest,
  itemRefKey,
  makeChestId,
  sameItemRef,
  type ChestType,
  type ScanKind,
  type StorageChest,
  type StorageItemRef,
  type UnresolvedSlot,
} from "./types";

/**
 * Pure chest-building/mutation functions — no Dexie access here, so these are unit-testable
 * without fake-indexeddb. src/storage/context.tsx calls these to compute the next chest object,
 * then persists it via src/storage/db.ts, mirroring how src/progress/context.tsx separates
 * "compute the next SaveState" from "write it."
 */

export class ChestLimitError extends Error {
  constructor() {
    super(
      `You have reached the ${MAX_CHESTS}-chest limit. Edit or remove an existing chest before adding another.`,
    );
    this.name = "ChestLimitError";
  }
}

export function assertChestLimit(existingCount: number) {
  if (existingCount >= MAX_CHESTS) throw new ChestLimitError();
}

/** "<Region> · Chest 01" — numbered by how many chests already exist in that region. */
export function defaultChestName(regionId: string, existingChests: StorageChest[]): string {
  const count = existingChests.filter((chest) => chest.regionId === regionId).length;
  return `${regionId} · Chest ${String(count + 1).padStart(2, "0")}`;
}

export interface CreateChestInput {
  regionId: string;
  type: ChestType;
  catalogVersion: string;
  name?: string;
  locationNote?: string;
  locationImageId?: string;
}

export function buildChest(input: CreateChestInput, existingChests: StorageChest[]): StorageChest {
  assertChestLimit(existingChests.length);
  const name = input.name?.trim() || defaultChestName(input.regionId, existingChests);
  return emptyChest({
    id: makeChestId(),
    name,
    regionId: input.regionId,
    type: input.type,
    catalogVersion: input.catalogVersion,
    locationNote: input.locationNote,
    locationImageId: input.locationImageId,
  });
}

function touch(chest: StorageChest): StorageChest {
  return { ...chest, updatedAt: new Date().toISOString() };
}

export function renameChest(chest: StorageChest, name: string): StorageChest {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A chest needs a name.");
  return touch({ ...chest, name: trimmed });
}

export function editChestDetails(
  chest: StorageChest,
  fields: Partial<Pick<StorageChest, "regionId" | "locationNote" | "locationImageId" | "locationMarker">>,
): StorageChest {
  return touch({ ...chest, ...fields });
}

/** Adds presence once each, even if a ref is selected repeatedly. Marks a manual scan touch. */
export function withItemRefsAdded(chest: StorageChest, refs: StorageItemRef[]): StorageChest {
  const seen = new Set(chest.itemRefs.map(itemRefKey));
  const next = [...chest.itemRefs];
  for (const ref of refs) {
    const key = itemRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(ref);
  }
  if (next.length === chest.itemRefs.length) return chest;
  return touch({ ...chest, itemRefs: next, lastScanKind: "manual" as ScanKind });
}

export function withItemRefRemoved(chest: StorageChest, ref: StorageItemRef): StorageChest {
  const next = chest.itemRefs.filter((candidate) => !sameItemRef(candidate, ref));
  if (next.length === chest.itemRefs.length) return chest;
  return touch({ ...chest, itemRefs: next });
}

/** Presence-only dedupe across a batch of refs (e.g. reviewed scan results before saving). */
export function dedupeItemRefs(refs: StorageItemRef[]): StorageItemRef[] {
  const seen = new Set<string>();
  const result: StorageItemRef[] = [];
  for (const ref of refs) {
    const key = itemRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

/**
 * Merges reviewed scan results into a chest for a partial rescan: existing item references not
 * covered by the scan are preserved, per the master prompt's "partial rescans preserve unseen
 * items" requirement. `unresolvedSlots` from unseen pages are also preserved.
 */
export function withPartialScanMerged(
  chest: StorageChest,
  reviewedRefs: StorageItemRef[],
  reviewedUnresolvedSlots: UnresolvedSlot[],
): StorageChest {
  const merged = withItemRefsAdded(chest, dedupeItemRefs(reviewedRefs));
  return touch({
    ...merged,
    unresolvedSlots: dedupeUnresolvedSlots([...(chest.unresolvedSlots ?? []), ...reviewedUnresolvedSlots]),
    lastScanKind: "partial",
  });
}

/**
 * Replaces a chest's contents atomically for a confirmed complete rescan. Caller is responsible
 * for having already shown the player a confirmation step — this function does not ask.
 */
export function withCompleteScanReplaced(
  chest: StorageChest,
  reviewedRefs: StorageItemRef[],
  reviewedUnresolvedSlots: UnresolvedSlot[],
): StorageChest {
  const now = new Date().toISOString();
  return {
    ...chest,
    itemRefs: dedupeItemRefs(reviewedRefs),
    unresolvedSlots: dedupeUnresolvedSlots(reviewedUnresolvedSlots),
    lastScanKind: "complete",
    lastCompleteScanAt: now,
    updatedAt: now,
  };
}

function dedupeUnresolvedSlots(slots: UnresolvedSlot[]): UnresolvedSlot[] | undefined {
  const seen = new Set<string>();
  const result: UnresolvedSlot[] = [];
  for (const slot of slots) {
    if (seen.has(slot.id)) continue;
    seen.add(slot.id);
    result.push(slot);
  }
  return result.length ? result : undefined;
}

export function withUnresolvedSlotResolved(chest: StorageChest, slotId: string): StorageChest {
  const next = (chest.unresolvedSlots ?? []).filter((slot) => slot.id !== slotId);
  return touch({ ...chest, unresolvedSlots: next.length ? next : undefined });
}
