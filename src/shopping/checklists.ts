import { plannableKitMap, type Catalog } from "../catalog/types";
import { combinedSupplies, environmentSupplies } from "../planner/recommend";
import type { HousematePlan } from "../planner/types";

export interface QuantityRow {
  id: string;
  label: string;
  quantity: number;
  gathered: number;
  signature: string;
}

export interface HouseQuantityList {
  planId: string;
  construction: QuantityRow[];
  furnishings: QuantityRow[];
  /** App-guidance items for achieving each home's recorded ideal environment. Not a recorded requirement. */
  environment: QuantityRow[];
}

/** @deprecated legacy boolean checklist row */
export interface ShoppingRow {
  id: string;
  label: string;
  quantity: number | null;
  checked: boolean;
}

/** @deprecated legacy per-pokemon habitat checklist */
export interface HabitatChecklist {
  id: string;
  pokemonId: string;
  habitatId: string;
  habitatName: string;
  rows: ShoppingRow[];
}

/** @deprecated legacy house checklist */
export interface HouseChecklist {
  planId: string;
  construction: ShoppingRow[];
  furnishings: ShoppingRow[];
}

export interface ShoppingChecklists {
  habitats: Record<string, HabitatChecklist>;
  house?: HouseChecklist;
}

export const emptyShoppingChecklists = (): ShoppingChecklists => ({
  habitats: {},
});

export function habitatChecklistId(pokemonId: string, habitatId: string) {
  return `${pokemonId}:${habitatId}`;
}

export function housePlanId(plan: HousematePlan) {
  return plan.createdAt;
}

function rowSignature(id: string) {
  return id.split(":").slice(0, -1).join(":");
}

function reconciledQuantityRows(
  rows: QuantityRow[],
  previous: QuantityRow[] = [],
) {
  const prev = new Map(previous.map((row) => [row.id, row]));
  return rows.map((row) => {
    const old = prev.get(row.id);
    if (!old) return row;
    if (old.signature !== row.signature) {
      return {
        ...row,
        gathered: Math.min(old.gathered, row.quantity),
      };
    }
    return { ...row, gathered: Math.min(old.gathered, row.quantity) };
  });
}

export function houseQuantityList(plan: HousematePlan, catalog: Catalog): HouseQuantityList {
  const supplies = combinedSupplies(plan, catalog);
  const planId = housePlanId(plan);
  const construction = supplies.construction.map(({ name, quantity }) => {
    const contributors = plan.homes
      .filter((home) =>
        plannableKitMap(catalog.kits).get(home.kitId)
          ?.materials.some((material) => material.name === name && material.quantity > 0),
      )
      .map((home) => `${home.id}:${home.kitId}`)
      .sort()
      .join(",");
    const id = `construction:${name}:${quantity}:${contributors}`;
    return {
      id,
      label: name,
      quantity,
      gathered: 0,
      signature: rowSignature(id),
    };
  });
  const furnishings = supplies.furnishings.map(({ name, quantity, homeIds }) => {
    const id = `furnishing:${name}:${quantity}:${[...homeIds].sort().join(",")}`;
    return {
      id,
      label: name,
      quantity,
      gathered: 0,
      signature: rowSignature(id),
    };
  });
  const environment = environmentSupplies(plan, catalog).map(
    ({ name, quantity, homeIds }) => {
      const id = `environment:${name}:${quantity}:${[...homeIds].sort().join(",")}`;
      return {
        id,
        label: name,
        quantity,
        gathered: 0,
        signature: rowSignature(id),
      };
    },
  );
  return { planId, construction, furnishings, environment };
}

export function reconcileHouseQuantityList(
  previous: HouseQuantityList | undefined,
  plan: HousematePlan,
  catalog: Catalog,
): HouseQuantityList {
  const next = houseQuantityList(plan, catalog);
  if (!previous || previous.planId !== next.planId) return next;
  return {
    ...next,
    construction: reconciledQuantityRows(next.construction, previous.construction),
    furnishings: reconciledQuantityRows(next.furnishings, previous.furnishings),
    environment: reconciledQuantityRows(next.environment, previous.environment),
  };
}

export function resetHouseGathered(list: HouseQuantityList): HouseQuantityList {
  const zero = (rows: QuantityRow[]) =>
    rows.map((row) => ({ ...row, gathered: 0 }));
  return {
    ...list,
    construction: zero(list.construction),
    furnishings: zero(list.furnishings),
    environment: zero(list.environment),
  };
}

export function setHouseRowGathered(
  list: HouseQuantityList,
  section: "construction" | "furnishings" | "environment",
  id: string,
  gathered: number,
): HouseQuantityList {
  const rows = list[section].map((row) =>
    row.id === id
      ? {
          ...row,
          gathered: Math.min(Math.max(0, Math.floor(gathered)), row.quantity),
        }
      : row,
  );
  return { ...list, [section]: rows };
}

export function migrateHouseChecklist(
  previous: HouseChecklist | undefined,
  plan: HousematePlan,
  catalog: Catalog,
): HouseQuantityList {
  const next = houseQuantityList(plan, catalog);
  if (!previous) return next;
  const fromBool = (rows: ShoppingRow[], target: QuantityRow[]) =>
    target.map((row) => {
      const old = rows.find((entry) => entry.id === row.id);
      if (!old) return row;
      return {
        ...row,
        gathered: old.checked ? row.quantity : 0,
      };
    });
  return {
    ...next,
    construction: fromBool(previous.construction, next.construction),
    furnishings: fromBool(previous.furnishings, next.furnishings),
  };
}

/** Legacy helpers kept for migration tests */
import type { Habitat, Item } from "../catalog/types";
import { parseRequirement, resolveItem } from "../dex/glossary";

export function habitatRows(habitat: Habitat, items: Item[]) {
  return habitat.requirements.flatMap((raw, index) => {
    const requirement = parseRequirement(raw);
    const item = resolveItem(requirement.name, items);
    const quantity = Number(requirement.quantity);
    const isShoppingItem =
      requirement.kind === "item" &&
      items.some((entry) => entry.id === item.id) &&
      Number.isSafeInteger(quantity) &&
      quantity > 0;
    return isShoppingItem
      ? [
          {
            id: `item:${item.id}:${quantity}:${index}`,
            label: item.name,
            quantity,
            checked: false,
          },
        ]
      : [];
  });
}

export function habitatChecklist(
  pokemonId: string,
  habitat: Habitat,
  items: Item[],
): HabitatChecklist {
  return {
    id: habitatChecklistId(pokemonId, habitat.id),
    pokemonId,
    habitatId: habitat.id,
    habitatName: habitat.name,
    rows: habitatRows(habitat, items),
  };
}

function reconciledRows(rows: ShoppingRow[], previous: ShoppingRow[] = []) {
  const checked = new Set(previous.filter((row) => row.checked).map((row) => row.id));
  return rows.map((row) => ({ ...row, checked: checked.has(row.id) }));
}

export function reconcileHabitatChecklist(
  previous: HabitatChecklist | undefined,
  pokemonId: string,
  habitat: Habitat,
  items: Item[],
) {
  const next = habitatChecklist(pokemonId, habitat, items);
  return { ...next, rows: reconciledRows(next.rows, previous?.rows) };
}

export function houseChecklist(plan: HousematePlan, catalog: Catalog) {
  const list = houseQuantityList(plan, catalog);
  return {
    planId: list.planId,
    construction: list.construction.map((row) => ({
      id: row.id,
      label: row.label,
      quantity: row.quantity,
      checked: false,
    })),
    furnishings: list.furnishings.map((row) => ({
      id: row.id,
      label: row.label,
      quantity: row.quantity,
      checked: false,
    })),
  };
}

export function reconcileHouseChecklist(
  previous: HouseChecklist | undefined,
  plan: HousematePlan,
  catalog: Catalog,
) {
  const next = houseChecklist(plan, catalog);
  if (!previous || previous.planId !== next.planId) return next;
  return {
    ...next,
    construction: reconciledRows(next.construction, previous.construction),
    furnishings: reconciledRows(next.furnishings, previous.furnishings),
  };
}

export function toggleRow(rows: ShoppingRow[], id: string) {
  return rows.map((row) =>
    row.id === id ? { ...row, checked: !row.checked } : row,
  );
}

export function rowRemaining(row: QuantityRow) {
  return Math.max(row.quantity - row.gathered, 0);
}

export function constructionReady(list: HouseQuantityList) {
  return list.construction.every((row) => row.gathered >= row.quantity);
}
