import type { Catalog } from "../catalog/types";
import type { HabitatChecklist, ShoppingChecklists } from "../shopping/checklists";
import { habitatChecklistId } from "../shopping/checklists";
import { getCanonicalHabitat } from "./catalog";
import { createPlannedBuild } from "./builds";
import { normalizeRequirements } from "./requirements";
import type { HabitatBuildRecord } from "./types";

export function migrateLegacyShopping(
  catalog: Catalog,
  legacy: ShoppingChecklists | undefined,
  existing: Record<string, HabitatBuildRecord> = {},
): {
  builds: Record<string, HabitatBuildRecord>;
  legacySnapshot?: ShoppingChecklists;
  migrated: boolean;
} {
  if (!legacy || !Object.keys(legacy.habitats).length) {
    return { builds: existing, migrated: false };
  }
  if (Object.keys(existing).length) {
    return { builds: existing, legacySnapshot: legacy, migrated: true };
  }
  const byCanonical = new Map<string, HabitatChecklist[]>();
  for (const list of Object.values(legacy.habitats)) {
    const key = list.habitatId;
    const group = byCanonical.get(key) || [];
    group.push(list);
    byCanonical.set(key, group);
  }
  const builds: Record<string, HabitatBuildRecord> = {};
  for (const [habitatId, lists] of byCanonical) {
    const duplicate = lists.length > 1;
    for (const list of lists) {
      const canonical = getCanonicalHabitat(catalog, habitatId);
      const requirements = canonical
        ? normalizeRequirements(canonical.representative, catalog.items)
        : [];
      const shoppingReqs = requirements.filter(
        (r) => r.kind === "item" && r.quantity,
      );
      const allocations = shoppingReqs.map((req, index) => {
        const legacyRow = list.rows.find((row) => {
          const parts = row.id.split(":");
          return parts[1] === req.itemId && Number(parts[2]) === req.quantity;
        });
        const fallbackRow = list.rows[index];
        const row = legacyRow || fallbackRow;
        const gathered =
          row && row.checked && row.quantity
            ? row.quantity
            : row && row.checked
              ? 0
              : 0;
        return {
          requirementId: req.id,
          signature: req.signature,
          raw: req.raw,
          label: req.label,
          kind: req.kind as "item",
          required: req.quantity || 0,
          gathered: Math.min(gathered, req.quantity || 0),
        };
      });
      const ambiguous = list.rows.some(
        (row) =>
          !shoppingReqs.some((req) => {
            const parts = row.id.split(":");
            return parts[1] === req.itemId && Number(parts[2]) === req.quantity;
          }),
      );
      const record = createPlannedBuild(
        catalog,
        habitatId,
        "",
        1,
        "",
        list.pokemonId,
      );
      record.region = null;
      record.reviewFlags = [
        ...(duplicate ? ["Review imported copies"] : []),
        ...(ambiguous ? ["Needs review"] : []),
        ...(record.region === null ? ["Choose a region"] : []),
      ].filter(Boolean);
      record.allocations = allocations.length
        ? allocations
        : record.allocations;
      if (ambiguous && !allocations.length) {
        record.reviewFlags = [...(record.reviewFlags || []), "Needs review"];
      }
      builds[record.id] = record;
    }
  }
  return { builds, legacySnapshot: legacy, migrated: true };
}

export function ensureMigratedState(
  catalog: Catalog,
  shoppingChecklists: ShoppingChecklists | undefined,
  habitatBuilds: Record<string, HabitatBuildRecord> | undefined,
  legacySnapshot: ShoppingChecklists | undefined,
) {
  if (habitatBuilds && Object.keys(habitatBuilds).length) {
    return {
      habitatBuilds,
      shoppingLegacySnapshot: legacySnapshot,
    };
  }
  const result = migrateLegacyShopping(catalog, shoppingChecklists);
  return {
    habitatBuilds: result.builds,
    shoppingLegacySnapshot: result.legacySnapshot || legacySnapshot,
  };
}
