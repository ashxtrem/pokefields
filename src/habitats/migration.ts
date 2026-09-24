import type { Catalog } from "../catalog/types";
import type { SaveState } from "../persistence/store";
import type { LegacyHabitatBuildRecord } from "../persistence/legacy";
import { getCanonicalHabitat } from "./catalog";
import type { HabitatLocationFlag, HabitatLocationRecord } from "./types";

function legacyFlagsToLocationFlags(
  reviewFlags: string[] | undefined,
): HabitatLocationFlag[] {
  const flags: HabitatLocationFlag[] = [];
  if (reviewFlags?.includes("Review imported copies"))
    flags.push("Possible duplicate");
  return flags;
}

function locationFromBuild(
  record: LegacyHabitatBuildRecord,
  catalog: Catalog,
): HabitatLocationRecord {
  const inCatalog = !!getCanonicalHabitat(catalog, record.habitatId);
  const validRegion =
    record.region && catalog.areas.includes(record.region)
      ? record.region
      : null;
  const flags = legacyFlagsToLocationFlags(record.reviewFlags);
  if (!validRegion) flags.push("Choose a region");
  if (!inCatalog) flags.push("Habitat missing from catalog");
  return {
    id: record.id,
    habitatId: record.habitatId,
    habitatNameSnapshot: record.snapshot.habitatName,
    region: validRegion,
    note: record.locationNote.trim(),
    copies: record.copies,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    reviewFlags: flags.length ? flags : undefined,
  };
}

/**
 * One-time, idempotent move from the old habitat build planner/recorder and
 * house checklist into habitat location records. Runs on load
 * (`normalizeLoadedState`) and inside `validateBackup` so an import sees the
 * same migrated shape a reload would produce. Only `status: "built"` records
 * become locations; planned records and legacy boolean checklists are
 * archived into snapshot fields but never turn into locations.
 */
export function migrateHabitatLocations(
  state: SaveState,
  catalog: Catalog,
): SaveState {
  if (state.habitatLocationMigrationVersion === 1) return state;

  const existingLocations = state.habitatLocations || {};
  const locations: Record<string, HabitatLocationRecord> = {
    ...existingLocations,
  };

  const legacyBuilds = state.habitatBuilds;
  const habitatBuildLegacySnapshot =
    state.habitatBuildLegacySnapshot ??
    (legacyBuilds && Object.keys(legacyBuilds).length
      ? legacyBuilds
      : undefined);

  if (legacyBuilds) {
    for (const record of Object.values(legacyBuilds)) {
      if (record.status !== "built") continue;
      if (locations[record.id]) continue;
      locations[record.id] = locationFromBuild(record, catalog);
    }
  }

  const houseShoppingLegacySnapshot =
    state.houseShoppingLegacySnapshot ?? state.houseShopping ?? undefined;

  const { habitatBuilds: _builds, houseShopping: _house, ...rest } = state;
  void _builds;
  void _house;

  return {
    ...rest,
    habitatLocations: locations,
    habitatLocationMigrationVersion: 1,
    habitatBuildLegacySnapshot,
    houseShoppingLegacySnapshot,
  };
}
