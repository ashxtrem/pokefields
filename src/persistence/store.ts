import Dexie, { type Table } from "dexie";
import type { Catalog } from "../catalog/types";
import type { HousematePlan, Plan } from "../planner/types";
import { HOUSEMATE_PLAN_VERSION } from "../planner/types";
import { canPlace, validPlot } from "../planner/engine";
export interface SaveState {
  schemaVersion: 1;
  found: Record<string, string[]>;
  plans: Record<string, Plan>;
  housematePlan?: HousematePlan | null;
}
export const emptyState = (): SaveState => ({
  schemaVersion: 1,
  found: {},
  plans: {},
  housematePlan: null,
});
class Database extends Dexie {
  state!: Table<{ id: string; value: SaveState }>;
  constructor() {
    super("pokopia-fieldnotes");
    this.version(1).stores({ state: "id" });
  }
}
const db = new Database();
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
        !catalog.kits.some((k) => k.id === c.id) ||
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
      const k = catalog.kits.find((k) => k.id === h.kitId);
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
  if (data.housematePlan != null)
    validateHousematePlan(data.housematePlan, catalog, ids);
  return JSON.parse(JSON.stringify(data)) as SaveState;
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
    const k = catalog.kits.find((k) => k.id === h.kitId);
    if (
      !k ||
      !Array.isArray(h.residents) ||
      !h.residents.length ||
      h.residents.length > k.capacity
    )
      throw Error("A suggested home is missing, empty or over capacity.");
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
