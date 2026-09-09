import type { Catalog } from "../catalog/types";
import { getCanonicalHabitat } from "./catalog";
import {
  buildAllocations,
  normalizeRequirements,
  shoppingRequirements,
} from "./requirements";
import type {
  BuildBadge,
  HabitatBuildRecord,
  HabitatBuildSnapshot,
  NormalizedRequirement,
  RequirementAllocation,
} from "./types";

export function newBuildId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function nowIso() {
  return new Date().toISOString();
}

function snapshotFromHabitat(
  catalog: Catalog,
  habitatId: string,
  habitatName: string,
  source: string,
  requirements: NormalizedRequirement[],
): HabitatBuildSnapshot {
  return {
    habitatName,
    source,
    catalogVersion: catalog.version,
    requirements,
  };
}

export function createPlannedBuild(
  catalog: Catalog,
  habitatId: string,
  region: string,
  copies = 1,
  locationNote = "",
  originPokemonId?: string,
): HabitatBuildRecord {
  const canonical = getCanonicalHabitat(catalog, habitatId);
  if (!canonical) throw Error("Habitat not found in catalog.");
  const requirements = normalizeRequirements(
    canonical.representative,
    catalog.items,
  );
  const ts = nowIso();
  return {
    id: newBuildId(),
    habitatId,
    status: "planned",
    region,
    copies: Math.max(1, Math.floor(copies)),
    locationNote,
    createdAt: ts,
    updatedAt: ts,
    snapshot: snapshotFromHabitat(
      catalog,
      habitatId,
      canonical.name,
      canonical.source,
      requirements,
    ),
    allocations: buildAllocations(requirements, copies),
    originPokemonId,
  };
}

export function createBuiltRecord(
  catalog: Catalog,
  habitatId: string,
  region: string,
  copies = 1,
  locationNote = "",
  originPokemonId?: string,
): HabitatBuildRecord {
  const canonical = getCanonicalHabitat(catalog, habitatId);
  if (!canonical) throw Error("Habitat not found in catalog.");
  const requirements = normalizeRequirements(
    canonical.representative,
    catalog.items,
  );
  const ts = nowIso();
  return {
    id: newBuildId(),
    habitatId,
    status: "built",
    region,
    copies: Math.max(1, Math.floor(copies)),
    locationNote,
    createdAt: ts,
    updatedAt: ts,
    snapshot: snapshotFromHabitat(
      catalog,
      habitatId,
      canonical.name,
      canonical.source,
      requirements,
    ),
    allocations: [],
    originPokemonId,
  };
}

export function buildBadges(records: HabitatBuildRecord[]): BuildBadge {
  return records.reduce(
    (acc, record) => {
      if (record.status === "planned") acc.planned += record.copies;
      else acc.built += record.copies;
      return acc;
    },
    { planned: 0, built: 0 },
  );
}

export function recordsForHabitat(
  builds: Record<string, HabitatBuildRecord>,
  habitatId: string,
) {
  return Object.values(builds)
    .filter((r) => r.habitatId === habitatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function activePlannedBuilds(
  builds: Record<string, HabitatBuildRecord>,
) {
  return Object.values(builds)
    .filter((r) => r.status === "planned")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function markBuilt(record: HabitatBuildRecord): HabitatBuildRecord {
  return {
    ...record,
    status: "built",
    allocations: [],
    updatedAt: nowIso(),
  };
}

export function splitPartialBuilt(
  record: HabitatBuildRecord,
  builtCopies: number,
): { built: HabitatBuildRecord; remaining: HabitatBuildRecord | null } {
  const n = Math.min(Math.max(1, Math.floor(builtCopies)), record.copies);
  if (n >= record.copies) return { built: markBuilt(record), remaining: null };
  const perCopy = shoppingRequirements(record.snapshot.requirements);
  const released = record.allocations.map((row) => {
    const perCopyQty = row.required / record.copies;
    const keepRequired = Math.ceil(perCopyQty * (record.copies - n));
    const keepGathered = Math.min(
      row.gathered,
      Math.max(0, Math.floor(perCopyQty * (record.copies - n))),
    );
    return { ...row, required: keepRequired, gathered: keepGathered };
  });
  const builtAllocations = record.allocations.map((row) => {
    const perCopyQty = row.required / record.copies;
    const builtRequired = Math.floor(perCopyQty * n);
    const builtGathered = Math.min(row.gathered, builtRequired);
    return {
      ...row,
      required: builtRequired,
      gathered: builtGathered,
    };
  });
  const ts = nowIso();
  const built: HabitatBuildRecord = {
    ...record,
    id: newBuildId(),
    status: "built",
    copies: n,
    allocations: [],
    createdAt: ts,
    updatedAt: ts,
  };
  const remaining: HabitatBuildRecord = {
    ...record,
    copies: record.copies - n,
    allocations: released,
    updatedAt: ts,
  };
  void builtAllocations;
  void perCopy;
  return { built, remaining };
}

export function updateBuildCopies(
  record: HabitatBuildRecord,
  copies: number,
): HabitatBuildRecord {
  const nextCopies = Math.max(1, Math.floor(copies));
  return {
    ...record,
    copies: nextCopies,
    allocations: buildAllocations(
      record.snapshot.requirements,
      nextCopies,
      record.allocations,
    ),
    updatedAt: nowIso(),
  };
}

export function updateBuildLocation(
  record: HabitatBuildRecord,
  region: string,
  locationNote: string,
): HabitatBuildRecord {
  return {
    ...record,
    region,
    locationNote,
    updatedAt: nowIso(),
  };
}

export function setAllocationGathered(
  record: HabitatBuildRecord,
  requirementId: string,
  gathered: number,
): HabitatBuildRecord {
  return {
    ...record,
    allocations: record.allocations.map((row) =>
      row.requirementId === requirementId
        ? {
            ...row,
            gathered: Math.min(Math.max(0, Math.floor(gathered)), row.required),
          }
        : row,
    ),
    updatedAt: nowIso(),
  };
}

export function setAllGathered(record: HabitatBuildRecord): HabitatBuildRecord {
  return {
    ...record,
    allocations: record.allocations.map((row) => ({
      ...row,
      gathered: row.required,
    })),
    updatedAt: nowIso(),
  };
}

export function resetAllocations(
  record: HabitatBuildRecord,
): HabitatBuildRecord {
  return {
    ...record,
    allocations: record.allocations.map((row) => ({ ...row, gathered: 0 })),
    updatedAt: nowIso(),
  };
}

export function suppliesReady(record: HabitatBuildRecord) {
  const shopping = record.allocations;
  if (!shopping.length) return true;
  return shopping.every((row) => row.gathered >= row.required);
}

export function remainingForRow(row: RequirementAllocation) {
  return Math.max(row.required - row.gathered, 0);
}

export function hasUnresolvedRequirements(record: HabitatBuildRecord) {
  return record.snapshot.requirements.some((req) => req.kind === "review");
}
