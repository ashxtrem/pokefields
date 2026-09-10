import type { Catalog } from "../catalog/types";
import {
  emptyCraftingState,
  type CraftingQuarantine,
  type CraftingState,
} from "./types";

const SUPPORTED = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function readLearnedList(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string")) {
    fail("Backup has invalid learned recipe IDs.");
  }
  if (new Set(raw).size !== raw.length) {
    fail("Backup has duplicate learned recipe IDs.");
  }
  return raw as string[];
}

function v1LearnedIds(raw: Record<string, unknown>): string[] {
  if (!Array.isArray(raw.learnedRecipeIds)) {
    fail("Backup has invalid crafting data.");
  }
  if (raw.learnedRecipeIds.some((id) => typeof id !== "string")) {
    fail("Backup has invalid learned recipe IDs.");
  }
  const fromList = raw.learnedRecipeIds as string[];
  const fromOrphans: string[] = [];
  if (Array.isArray(raw.orphans)) {
    for (const row of raw.orphans) {
      if (
        isObject(row) &&
        typeof row.recipeId === "string" &&
        row.learned === true
      ) {
        fromOrphans.push(row.recipeId);
      }
    }
  }
  return uniqueStrings([...fromList, ...fromOrphans]);
}

function v1LegacySnapshot(raw: Record<string, unknown>) {
  return {
    version: 1,
    learnedRecipeIds: raw.learnedRecipeIds,
    entries: raw.entries,
    orphans: raw.orphans,
  };
}

export interface CraftingRead {
  crafting: CraftingState;
  legacySnapshot?: unknown;
}

/**
 * D-MIG-01: one strict reader for backup validation.
 * Missing payload means empty marks, never inferred from inventory.
 */
export function readCraftingRecord(raw: unknown, _catalog: Catalog): CraftingRead {
  if (raw == null) return { crafting: emptyCraftingState() };
  if (!isObject(raw)) fail("Backup has invalid crafting data.");
  const version = raw.version;
  if (typeof version === "number" && version > SUPPORTED) {
    fail("This backup uses a newer crafting format than this app understands.");
  }
  if (version === 1) {
    return {
      crafting: { version: 2, learnedRecipeIds: v1LearnedIds(raw) },
      legacySnapshot: v1LegacySnapshot(raw),
    };
  }
  if (version !== SUPPORTED) fail("Backup has invalid crafting data.");
  return {
    crafting: {
      version: 2,
      learnedRecipeIds: readLearnedList(raw.learnedRecipeIds),
    },
  };
}

export function normalizeCraftingState(
  raw: unknown,
  catalog: Catalog,
): CraftingState {
  return readCraftingRecord(raw, catalog).crafting;
}

export function craftingBackupError(raw: unknown, catalog: Catalog): string | null {
  try {
    normalizeCraftingState(raw, catalog);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Backup has invalid crafting data.";
  }
}

function sameRaw(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function readQuarantine(raw: unknown): CraftingQuarantine | undefined {
  if (raw == null) return undefined;
  if (
    !isObject(raw) ||
    typeof raw.reason !== "string" ||
    typeof raw.quarantinedAt !== "string" ||
    !("raw" in raw)
  ) {
    fail("Backup has invalid crafting quarantine data.");
  }
  return {
    raw: raw.raw,
    reason: raw.reason,
    quarantinedAt: raw.quarantinedAt,
  };
}

/** D-LOAD-01: unreadable crafting is quarantined; the rest of the notebook stays usable. */
export interface CraftingSaveSlice {
  crafting?: unknown;
  craftingQuarantine?: CraftingQuarantine;
  craftingLegacySnapshot?: unknown;
}

export function loadCraftingFields(
  state: CraftingSaveSlice,
  catalog: Catalog,
): {
  crafting: CraftingState;
  craftingQuarantine?: CraftingQuarantine;
  craftingLegacySnapshot?: unknown;
} {
  try {
    const read = readCraftingRecord(state.crafting, catalog);
    return {
      crafting: read.crafting,
      craftingQuarantine: state.craftingQuarantine,
      craftingLegacySnapshot:
        state.craftingLegacySnapshot ?? read.legacySnapshot,
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Crafting data could not be read.";
    const existing = state.craftingQuarantine;
    const quarantine =
      existing && sameRaw(existing.raw, state.crafting)
        ? existing
        : existing || {
            raw: state.crafting,
            reason,
            quarantinedAt: new Date().toISOString(),
          };
    return {
      crafting: emptyCraftingState(),
      craftingQuarantine: quarantine,
      craftingLegacySnapshot: state.craftingLegacySnapshot,
    };
  }
}
