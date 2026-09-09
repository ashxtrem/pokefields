import type { HabitatBuildRecord, RequirementAllocation } from "../habitats/types";
import {
  activePlannedBuilds,
  remainingForRow,
  resetAllocations,
} from "../habitats/builds";
import { allocationItemKey } from "../habitats/requirements";

export interface CombinedShoppingRow {
  key: string;
  label: string;
  required: number;
  gathered: number;
  remaining: number;
  contributions: {
    buildId: string;
    habitatName: string;
    required: number;
    gathered: number;
    remaining: number;
    rows: RequirementAllocation[];
  }[];
}

export function combinedHabitatShopping(
  builds: Record<string, HabitatBuildRecord>,
  buildFilter?: string[],
) {
  const planned = activePlannedBuilds(builds).filter(
    (b) => !buildFilter?.length || buildFilter.includes(b.id),
  );
  const groups = new Map<string, CombinedShoppingRow>();
  for (const build of planned) {
    for (const row of build.allocations) {
      const key = allocationItemKey(row);
      const existing = groups.get(key) || {
        key,
        label: row.label,
        required: 0,
        gathered: 0,
        remaining: 0,
        contributions: [],
      };
      existing.required += row.required;
      existing.gathered += row.gathered;
      existing.remaining += remainingForRow(row);
      let contribution = existing.contributions.find((c) => c.buildId === build.id);
      if (!contribution) {
        contribution = {
          buildId: build.id,
          habitatName: build.snapshot.habitatName,
          required: 0,
          gathered: 0,
          remaining: 0,
          rows: [],
        };
        existing.contributions.push(contribution);
      }
      contribution.required += row.required;
      contribution.gathered += row.gathered;
      contribution.remaining += remainingForRow(row);
      contribution.rows.push(row);
      groups.set(key, existing);
    }
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function redistributeCombinedGathered(
  builds: Record<string, HabitatBuildRecord>,
  key: string,
  newTotal: number,
): Record<string, HabitatBuildRecord> {
  const planned = activePlannedBuilds(builds);
  const next = { ...builds };
  const targets: { buildId: string; row: RequirementAllocation }[] = [];
  for (const build of planned) {
    for (const row of build.allocations) {
      if (allocationItemKey(row) === key) targets.push({ buildId: build.id, row });
    }
  }
  let remaining = Math.max(0, Math.floor(newTotal));
  for (const target of targets) {
    const need = remainingForRow(target.row);
    const add = Math.min(need, remaining);
    const build = next[target.buildId];
    next[target.buildId] = {
      ...build,
      allocations: build.allocations.map((row) =>
        row.requirementId === target.row.requirementId
          ? { ...row, gathered: row.gathered + add }
          : row,
      ),
    };
    remaining -= add;
  }
  if (remaining === 0) return next;
  let surplus = remaining;
  for (const target of [...targets].reverse()) {
    if (surplus <= 0) break;
    const build = next[target.buildId];
    const row = build.allocations.find((r) => r.requirementId === target.row.requirementId)!;
    const release = Math.min(surplus, row.gathered);
    next[target.buildId] = {
      ...build,
      allocations: build.allocations.map((r) =>
        r.requirementId === target.row.requirementId
          ? { ...r, gathered: r.gathered - release }
          : r,
      ),
    };
    surplus -= release;
  }
  return next;
}

export function resetHabitatGathered(
  builds: Record<string, HabitatBuildRecord>,
  buildFilter?: string[],
) {
  const next = { ...builds };
  for (const build of activePlannedBuilds(builds)) {
    if (buildFilter?.length && !buildFilter.includes(build.id)) continue;
    next[build.id] = resetAllocations(build);
  }
  return next;
}

export function setBuildAllocationGathered(
  builds: Record<string, HabitatBuildRecord>,
  buildId: string,
  requirementId: string,
  gathered: number,
) {
  const build = builds[buildId];
  if (!build) return builds;
  return {
    ...builds,
    [buildId]: {
      ...build,
      allocations: build.allocations.map((row) =>
        row.requirementId === requirementId
          ? {
              ...row,
              gathered: Math.min(
                Math.max(0, Math.floor(gathered)),
                row.required,
              ),
            }
          : row,
      ),
    },
  };
}

export function habitatListBadgeCount(builds: Record<string, HabitatBuildRecord>) {
  return activePlannedBuilds(builds).reduce((sum, b) => sum + b.copies, 0);
}

export function houseListBadgeCount(rows: { quantity: number; gathered: number }[]) {
  return rows.filter((row) => row.gathered < row.quantity).length;
}
