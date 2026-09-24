import { newUid } from "../storage/types";
import type { HabitatLocationRecord } from "./types";

export function newLocationId() {
  return newUid();
}

export function nowIso() {
  return new Date().toISOString();
}

export function createLocation(
  habitat: { id: string; name: string },
  region: string,
  copies = 1,
  note = "",
): HabitatLocationRecord {
  const ts = nowIso();
  return {
    id: newLocationId(),
    habitatId: habitat.id,
    habitatNameSnapshot: habitat.name,
    region,
    note: note.trim(),
    copies: Math.max(1, Math.floor(copies)),
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Region/note/count edits, written once on Save. Assigning a region clears
 * `Choose a region`; any save clears `Possible duplicate` since the player
 * has reviewed the row. */
export function updateLocation(
  record: HabitatLocationRecord,
  fields: { region?: string; note?: string; copies?: number },
): HabitatLocationRecord {
  const region = fields.region !== undefined ? fields.region : record.region;
  const reviewFlags = (record.reviewFlags || []).filter((flag) => {
    if (flag === "Choose a region" && region) return false;
    if (flag === "Possible duplicate") return false;
    return true;
  });
  return {
    ...record,
    region,
    note: fields.note !== undefined ? fields.note.trim() : record.note,
    copies:
      fields.copies !== undefined
        ? Math.max(1, Math.floor(fields.copies))
        : record.copies,
    updatedAt: nowIso(),
    reviewFlags: reviewFlags.length ? reviewFlags : undefined,
  };
}

export function locationsForHabitat(
  locations: Record<string, HabitatLocationRecord>,
  habitatId: string,
) {
  return Object.values(locations)
    .filter((r) => r.habitatId === habitatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The quick-save duplicate guard: refuse a second record for the same habitat+region. */
export function hasLocationInRegion(
  locations: Record<string, HabitatLocationRecord>,
  habitatId: string,
  region: string,
) {
  return locationsForHabitat(locations, habitatId).some(
    (r) => r.region === region,
  );
}

export function savedLocationCount(
  locations: Record<string, HabitatLocationRecord>,
  habitatId: string,
) {
  return locationsForHabitat(locations, habitatId).length;
}

/**
 * Quick-save duplicate guard + creation in one step: returns `null` when a
 * location already exists for this habitat+region (the caller should route
 * to habitat detail instead of writing a duplicate).
 */
export function addQuickSaveLocation(
  locations: Record<string, HabitatLocationRecord>,
  habitat: { id: string; name: string },
  region: string,
): {
  locations: Record<string, HabitatLocationRecord>;
  record: HabitatLocationRecord;
} | null {
  if (hasLocationInRegion(locations, habitat.id, region)) return null;
  const record = createLocation(habitat, region);
  return { locations: { ...locations, [record.id]: record }, record };
}

/** Compact region picker order: the habitat's discovery towns first, then the rest, each alphabetical. */
export function orderedRegionOptions(
  areas: string[],
  discoveryRegions: string[],
) {
  const discovery = new Set(discoveryRegions);
  const first = areas
    .filter((a) => discovery.has(a))
    .sort((a, b) => a.localeCompare(b));
  const rest = areas
    .filter((a) => !discovery.has(a))
    .sort((a, b) => a.localeCompare(b));
  return [...first, ...rest];
}
