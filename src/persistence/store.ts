import Dexie, { type Table } from "dexie";
import { plannableKitMap, type Catalog } from "../catalog/types";
import type {
  HabitatLocationFlag,
  HabitatLocationRecord,
} from "../habitats/types";
import { getCanonicalHabitat } from "../habitats/catalog";
import { migrateHabitatLocations } from "../habitats/migration";
import type { HousematePlan, Plan } from "../planner/types";
import { DEFAULT_HOUSEMATE_SETTINGS, HOUSEMATE_PLAN_VERSION } from "../planner/types";
import { migrateHousematePlan } from "../planner/recommend";
import { canPlace, validPlot } from "../planner/engine";
import type {
  HouseQuantityList,
  LegacyHabitatBuildRecord,
  QuantityRow,
  ShoppingChecklists,
  ShoppingRow,
} from "./legacy";
import {
  emptyCraftingState,
  type CraftingQuarantine,
  type CraftingState,
} from "../crafting/types";
import {
  readCraftingRecord,
  readQuarantine,
} from "../crafting/migration";
export interface SaveState {
  schemaVersion: 1;
  found: Record<string, string[]>;
  /**
   * Unused by the Crafting directory. Kept so released backups are not stripped.
   */
  materialCounts?: Record<string, number>;
  /** Versioned crafting notebook. Missing means empty learned marks. */
  crafting?: CraftingState;
  /** Unreadable crafting payload retained verbatim. */
  craftingQuarantine?: CraftingQuarantine;
  /** Calculator-era quantity lists kept until an export round-trips them. */
  craftingLegacySnapshot?: unknown;
  /** Legacy checkbox shopping lists — preserved in migration snapshot. */
  shoppingChecklists?: ShoppingChecklists;
  /**
   * Pre-migration input only: the old habitat build planner/recorder.
   * `migrateHabitatLocations` moves this into `habitatBuildLegacySnapshot`
   * and deletes it; it never appears on a state returned from load or import.
   */
  habitatBuilds?: Record<string, LegacyHabitatBuildRecord>;
  /**
   * Pre-migration input only: the old quantity-based house shopping list.
   * `migrateHabitatLocations` moves this into `houseShoppingLegacySnapshot`
   * and deletes it; it never appears on a state returned from load or import.
   */
  houseShopping?: HouseQuantityList;
  /** Original checkbox data kept until export verifies migration. */
  shoppingLegacySnapshot?: ShoppingChecklists;
  /** The only active habitat-tracking field: lightweight "already built here" records. */
  habitatLocations?: Record<string, HabitatLocationRecord>;
  /** Set once `migrateHabitatLocations` has run so it never replays. */
  habitatLocationMigrationVersion?: 1;
  /** Verbatim former `habitatBuilds`; compatibility data only, never read by active UI. */
  habitatBuildLegacySnapshot?: Record<string, LegacyHabitatBuildRecord>;
  /** Verbatim former `houseShopping`; compatibility data only, never read by active UI. */
  houseShoppingLegacySnapshot?: HouseQuantityList;
  plans: Record<string, Plan>;
  housematePlan?: HousematePlan | null;
  /** Kits the player has actually unlocked; null/absent means all kits. */
  availableKitIds?: string[] | null;
  /**
   * Self-reported environment level per town. Absent, {}, or 0 for a town
   * falls back to its starting level: 3 for Withered Wastelands, 1 elsewhere
   * (see `DEFAULT_ENV_LEVELS` in src/dex/glossary.ts).
   */
  envLevels?: Record<string, number>;
  /** Collectible items the player has recorded. Absent means none. */
  collected?: string[];
}
export const emptyState = (): SaveState => ({
  schemaVersion: 1,
  found: {},
  materialCounts: {},
  crafting: emptyCraftingState(),
  habitatLocations: {},
  habitatLocationMigrationVersion: 1,
  plans: {},
  housematePlan: null,
  availableKitIds: null,
  envLevels: {},
});
class Database extends Dexie {
  state!: Table<{ id: string; value: SaveState }>;
  /** Storage Locator tables — see src/storage/. Kept out of the `state` blob deliberately: large
   * image blobs would otherwise make every small notebook update rewrite all of them. */
  storageChests!: Table<Record<string, unknown>, string>;
  storageLocalItems!: Table<Record<string, unknown>, string>;
  storageImages!: Table<Record<string, unknown>, string>;
  constructor() {
    super("pokopia-fieldnotes");
    this.version(1).stores({ state: "id" });
    this.version(2).stores({
      state: "id",
      storageChests: "id, regionId",
      storageLocalItems: "id, normalizedName",
      storageImages: "id, ownerId, kind",
    });
  }
}
export const db = new Database();
export async function readState() {
  return (await db.state.get("main"))?.value || emptyState();
}
export async function writeState(value: SaveState) {
  await db.state.put({ id: "main", value });
}
export function validateBackup(raw: unknown, catalog: Catalog): SaveState {
  if (!raw || typeof raw !== "object") throw Error("Not a Fieldnotes backup.");
  const data = raw as SaveState;
  if (
    data.schemaVersion !== 1 ||
    !data.found ||
    !data.plans ||
    Array.isArray(data.found) ||
    Array.isArray(data.plans)
  )
    throw Error("Unsupported or incomplete backup.");
  const ids = new Set(catalog.pokemon.map((p) => p.id));
  for (const [id, areas] of Object.entries(data.found)) {
    if (
      !ids.has(id) ||
      !Array.isArray(areas) ||
      areas.some((a) => !catalog.areas.includes(a)) ||
      new Set(areas).size !== areas.length
    )
      throw Error("Backup has unrecognized Pokémon or areas.");
  }
  if (
    data.materialCounts !== undefined &&
    (!data.materialCounts ||
      Array.isArray(data.materialCounts) ||
      Object.entries(data.materialCounts).some(
        ([id, quantity]) =>
          !catalog.items.some((item) => item.id === id) ||
          !Number.isSafeInteger(quantity) ||
          quantity < 0,
      ))
  )
    throw Error("Backup has invalid material quantities.");
  if (data.shoppingChecklists !== undefined)
    validateShoppingChecklists(data.shoppingChecklists);
  if (data.shoppingLegacySnapshot !== undefined)
    validateShoppingChecklists(data.shoppingLegacySnapshot);
  if (data.habitatBuilds !== undefined)
    validateLegacyHabitatBuilds(data.habitatBuilds);
  if (data.habitatBuildLegacySnapshot !== undefined)
    validateLegacyHabitatBuilds(data.habitatBuildLegacySnapshot);
  if (data.houseShopping !== undefined)
    validateHouseShopping(data.houseShopping);
  if (data.houseShoppingLegacySnapshot !== undefined)
    validateHouseShopping(data.houseShoppingLegacySnapshot);
  for (const [area, p] of Object.entries(data.plans)) {
    if (
      !catalog.areas.includes(area) ||
      !p ||
      p.area !== area ||
      !p.plot ||
      !validPlot(p.plot) ||
      !Array.isArray(p.homes) ||
      !Array.isArray(p.roster) ||
      !Array.isArray(p.kits) ||
      !Array.isArray(p.unplaced) ||
      typeof p.catalogVersion !== "string" ||
      typeof p.createdAt !== "string"
    )
      throw Error("Invalid saved plan.");
    if (
      p.sourceRoster &&
      (!Array.isArray(p.sourceRoster) ||
        p.sourceRoster.some((id) => !ids.has(id)) ||
        p.roster.some((id) => !p.sourceRoster!.includes(id)))
    )
      throw Error("Invalid discovery snapshot.");
    if (
      p.roster.some((id) => !ids.has(id)) ||
      new Set(p.roster).size !== p.roster.length ||
      new Set(p.homes.map((h) => h.id)).size !== p.homes.length
    )
      throw Error("Invalid plan roster.");
    for (const c of p.kits)
      if (
        !plannableKitMap(catalog.kits).has(c.id) ||
        (c.limit !== null && (!Number.isInteger(c.limit) || c.limit < 0))
      )
        throw Error("Invalid kit selection.");
    const residents = p.homes.flatMap((h) => h.residents);
    if (
      residents.some((id) => !p.roster.includes(id)) ||
      new Set(residents).size !== residents.length
    )
      throw Error("Duplicated or unknown resident.");
    for (const h of p.homes) {
      const k = plannableKitMap(catalog.kits).get(h.kitId);
      if (
        !k ||
        !Array.isArray(h.residents) ||
        h.residents.length > k.capacity ||
        !canPlace(h, p.homes, p.plot, catalog)
      )
        throw Error(
          "A home is outside the plot, overlaps or exceeds capacity.",
        );
    }
    for (const c of p.kits)
      if (
        c.limit !== null &&
        p.homes.filter((h) => h.kitId === c.id).length > c.limit
      )
        throw Error("Kit limit exceeded.");
    if (p.homes.some((h) => !p.kits.some((c) => c.id === h.kitId)))
      throw Error("Unselected kit in plan.");
    const total = [...residents, ...p.unplaced.map((r) => r.id)];
    if (
      new Set(total).size !== total.length ||
      total.length !== p.roster.length ||
      total.some((id) => !p.roster.includes(id))
    )
      throw Error("Plan does not account for its roster.");
  }
  if (data.availableKitIds !== undefined) validateAvailableKitIds(data.availableKitIds, catalog);
  if (data.envLevels !== undefined) validateEnvLevels(data.envLevels);
  if (data.collected !== undefined) validateCollected(data.collected);
  const migratedPlan =
    data.housematePlan != null ? migrateHousematePlan(data.housematePlan) : data.housematePlan;
  if (migratedPlan != null) validateHousematePlan(migratedPlan, catalog, ids);
  const craftingRead = readCraftingRecord(data.crafting, catalog);
  const craftingQuarantine =
    data.craftingQuarantine !== undefined
      ? readQuarantine(data.craftingQuarantine)
      : undefined;
  const migratedState = migrateHabitatLocations(data, catalog);
  const habitatLocations = validateHabitatLocations(
    migratedState.habitatLocations || {},
    catalog,
  );
  return JSON.parse(
    JSON.stringify({
      ...migratedState,
      habitatLocations,
      housematePlan: migratedPlan,
      crafting: craftingRead.crafting,
      craftingQuarantine,
      craftingLegacySnapshot:
        data.craftingLegacySnapshot ?? craftingRead.legacySnapshot,
    }),
  ) as SaveState;
}

function validateCollected(value: unknown): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== "string" || !id) ||
    new Set(value).size !== value.length
  )
    throw Error("Backup has invalid collected marks.");
}

function validateAvailableKitIds(
  value: string[] | null,
  catalog: Catalog,
) {
  if (
    value !== null &&
    (!Array.isArray(value) ||
      value.some((id) => !plannableKitMap(catalog.kits).has(id)) ||
      new Set(value).size !== value.length)
  )
    throw Error("Backup has an invalid available-kits filter.");
}

function validateEnvLevels(value: unknown): asserts value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Backup has invalid environment levels.");
  for (const [area, level] of Object.entries(value)) {
    if (
      typeof area !== "string" ||
      !area.trim() ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > 99
    )
      throw Error("Backup has invalid environment levels.");
  }
}

function validQuantityRows(rows: unknown): rows is QuantityRow[] {
  return (
    Array.isArray(rows) &&
    rows.every(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof (row as QuantityRow).id === "string" &&
        typeof (row as QuantityRow).label === "string" &&
        typeof (row as QuantityRow).signature === "string" &&
        Number.isSafeInteger((row as QuantityRow).quantity) &&
        (row as QuantityRow).quantity >= 0 &&
        Number.isSafeInteger((row as QuantityRow).gathered) &&
        (row as QuantityRow).gathered >= 0 &&
        (row as QuantityRow).gathered <= (row as QuantityRow).quantity,
    )
  );
}

function validateHouseShopping(value: HouseQuantityList) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.planId !== "string" ||
    !validQuantityRows(value.construction) ||
    !validQuantityRows(value.furnishings) ||
    (value.environment !== undefined && !validQuantityRows(value.environment))
  )
    throw Error("Backup has invalid house shopping list.");
}

function validateLegacyHabitatBuilds(
  builds: Record<string, LegacyHabitatBuildRecord>,
) {
  if (!builds || typeof builds !== "object" || Array.isArray(builds))
    throw Error("Backup has invalid habitat build records.");
  const ids = new Set<string>();
  for (const [id, record] of Object.entries(builds)) {
    if (
      !record ||
      record.id !== id ||
      typeof record.habitatId !== "string" ||
      (record.status !== "planned" && record.status !== "built") ||
      (record.region !== null && typeof record.region !== "string") ||
      !Number.isSafeInteger(record.copies) ||
      record.copies < 1 ||
      typeof record.locationNote !== "string" ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string" ||
      !record.snapshot ||
      typeof record.snapshot.habitatName !== "string" ||
      !Array.isArray(record.snapshot.requirements) ||
      !Array.isArray(record.allocations)
    )
      throw Error("Backup has invalid habitat build records.");
    if (ids.has(id)) throw Error("Backup has duplicate habitat build IDs.");
    ids.add(id);
    for (const row of record.allocations) {
      if (
        !Number.isSafeInteger(row.required) ||
        row.required < 0 ||
        !Number.isSafeInteger(row.gathered) ||
        row.gathered < 0 ||
        row.gathered > row.required
      )
        throw Error("Backup has invalid habitat allocations.");
    }
  }
}

const LOCATION_FLAGS = new Set<HabitatLocationFlag>([
  "Choose a region",
  "Habitat missing from catalog",
  "Possible duplicate",
]);

/**
 * Validates the migrated `habitatLocations` map and returns a normalized
 * copy: a record whose habitat is no longer in the catalog gets
 * `Habitat missing from catalog` added (rather than being rejected) so a
 * later catalog change never destroys user-owned location data.
 */
function validateHabitatLocations(
  locations: Record<string, HabitatLocationRecord>,
  catalog: Catalog,
): Record<string, HabitatLocationRecord> {
  if (!locations || typeof locations !== "object" || Array.isArray(locations))
    throw Error("Backup has invalid habitat location records.");
  const next: Record<string, HabitatLocationRecord> = {};
  const ids = new Set<string>();
  for (const [id, record] of Object.entries(locations)) {
    if (
      !record ||
      record.id !== id ||
      typeof record.habitatId !== "string" ||
      !record.habitatId ||
      typeof record.habitatNameSnapshot !== "string" ||
      typeof record.note !== "string" ||
      !Number.isSafeInteger(record.copies) ||
      record.copies < 1 ||
      typeof record.createdAt !== "string" ||
      Number.isNaN(Date.parse(record.createdAt)) ||
      typeof record.updatedAt !== "string" ||
      Number.isNaN(Date.parse(record.updatedAt)) ||
      (record.reviewFlags !== undefined &&
        (!Array.isArray(record.reviewFlags) ||
          record.reviewFlags.some(
            (flag) => !LOCATION_FLAGS.has(flag as HabitatLocationFlag),
          )))
    )
      throw Error("Backup has invalid habitat location records.");
    if (record.region !== null) {
      if (
        typeof record.region !== "string" ||
        !catalog.areas.includes(record.region)
      )
        throw Error("Backup has an invalid habitat location region.");
    } else if (!record.reviewFlags?.includes("Choose a region")) {
      throw Error("Backup has an invalid habitat location region.");
    }
    if (ids.has(id)) throw Error("Backup has duplicate habitat location IDs.");
    ids.add(id);
    const inCatalog = !!getCanonicalHabitat(catalog, record.habitatId);
    const flags = new Set(record.reviewFlags || []);
    if (inCatalog) flags.delete("Habitat missing from catalog");
    else flags.add("Habitat missing from catalog");
    next[id] = {
      ...record,
      reviewFlags: flags.size ? [...flags] : undefined,
    };
  }
  return next;
}

function validShoppingRows(rows: unknown): rows is ShoppingRow[] {
  return (
    Array.isArray(rows) &&
    rows.every(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof (row as ShoppingRow).id === "string" &&
        typeof (row as ShoppingRow).label === "string" &&
        (Number.isSafeInteger((row as ShoppingRow).quantity) ||
          (row as ShoppingRow).quantity === null) &&
        typeof (row as ShoppingRow).checked === "boolean",
    )
  );
}

function validateShoppingChecklists(value: ShoppingChecklists) {
  if (!value || typeof value !== "object" || !value.habitats || Array.isArray(value.habitats))
    throw Error("Backup has invalid shopping checklists.");
  for (const [id, list] of Object.entries(value.habitats))
    if (
      !list ||
      list.id !== id ||
      typeof list.pokemonId !== "string" ||
      typeof list.habitatId !== "string" ||
      typeof list.habitatName !== "string" ||
      !validShoppingRows(list.rows)
    )
      throw Error("Backup has invalid shopping checklists.");
  if (
    value.house &&
    (typeof value.house.planId !== "string" ||
      !validShoppingRows(value.house.construction) ||
      !validShoppingRows(value.house.furnishings))
  )
    throw Error("Backup has invalid shopping checklists.");
}

function validateHousematePlan(
  plan: HousematePlan,
  catalog: Catalog,
  ids: Set<string>,
) {
  if (
    plan.version !== HOUSEMATE_PLAN_VERSION ||
    !Array.isArray(plan.roster) ||
    !Array.isArray(plan.sourceRoster) ||
    !Array.isArray(plan.homes) ||
    !Array.isArray(plan.unresolved) ||
    (plan.areaFilter !== null && !catalog.areas.includes(plan.areaFilter)) ||
    typeof plan.catalogVersion !== "string" ||
    typeof plan.createdAt !== "string" ||
    typeof plan.updatedAt !== "string"
  )
    throw Error("Invalid housemate plan.");
  if (
    !plan.settings ||
    typeof plan.settings !== "object" ||
    !Number.isInteger(plan.settings.maxResidents) ||
    plan.settings.maxResidents < 1 ||
    plan.settings.maxResidents > 4 ||
    typeof plan.settings.affinityFloor !== "boolean"
  )
    throw Error("Invalid housemate plan settings.");
  validateAvailableKitIds(plan.availableKitIds, catalog);
  if (
    plan.roster.some((id) => !ids.has(id)) ||
    new Set(plan.roster).size !== plan.roster.length ||
    plan.sourceRoster.some((id) => !ids.has(id)) ||
    new Set(plan.homes.map((h) => h.id)).size !== plan.homes.length
  )
    throw Error("Invalid housemate roster.");
  const residents = plan.homes.flatMap((h) => h.residents);
  if (
    residents.some((id) => !plan.roster.includes(id)) ||
    new Set(residents).size !== residents.length
  )
    throw Error("Duplicated or unknown housemate.");
  for (const h of plan.homes) {
    if (h.completed !== undefined && typeof h.completed !== "boolean")
      throw Error("Invalid home completion mark.");
    if (h.completed && !h.residents.length)
      throw Error("An empty home cannot be marked done.");
    const k = plannableKitMap(catalog.kits).get(h.kitId);
    if (!k || !Array.isArray(h.residents) || h.residents.length > k.capacity)
      throw Error("A suggested home is missing or over capacity.");
  }
  const unresolved = plan.unresolved.map((r) => r.id);
  if (
    unresolved.some(
      (id) => !plan.roster.includes(id) || residents.includes(id),
    ) ||
    new Set(unresolved).size !== unresolved.length ||
    plan.unresolved.some(
      (r) => typeof r.id !== "string" || typeof r.reason !== "string",
    )
  )
    throw Error("Invalid unresolved housemates.");
  const total = [...residents, ...unresolved];
  if (
    new Set(total).size !== total.length ||
    total.length !== plan.roster.length ||
    total.some((id) => !plan.roster.includes(id))
  )
    throw Error("Housemate plan does not account for its roster.");
}
