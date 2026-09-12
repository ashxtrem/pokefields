import {
  plannableKitMap,
  plannableKits,
  type Catalog,
  type PlannableKit,
  type Pokemon,
} from "../catalog/types";
import {
  environmentExampleIds,
  itemEnvLock,
  type EnvLevelRequirement,
} from "../dex/glossary";
import { furnishings } from "./engine";
import type {
  HousematePlan,
  HousematePlanSettings,
  Plan,
  PreferenceMatch,
  RecommendedHome,
  UnresolvedResident,
} from "./types";
import { DEFAULT_HOUSEMATE_SETTINGS, HOUSEMATE_PLAN_VERSION } from "./types";

const NO_HOME =
  "No supported home in the catalog has enough capacity for this Pokémon.";

export function uniqueFoundRoster(
  found: Record<string, string[]>,
  area: string | null = null,
) {
  return Object.keys(found)
    .filter((id) => (area ? found[id]?.includes(area) : found[id]?.length))
    .sort();
}

export function planIsStale(
  plan: HousematePlan,
  found: Record<string, string[]>,
  catalog: Catalog,
) {
  const current = uniqueFoundRoster(found, plan.areaFilter);
  return (
    plan.catalogVersion !== catalog.version ||
    current.length !== plan.sourceRoster.length ||
    current.some((id) => !plan.sourceRoster.includes(id)) ||
    plan.roster.some((id) => !catalog.pokemon.some((p) => p.id === id))
  );
}

export function preferenceLabel(match: PreferenceMatch) {
  if (match === "shared") return "Shared preferences";
  if (match === "different") return "Different environment preferences";
  return "Preferences unknown";
}

export function environmentMatch(residents: Pokemon[]): PreferenceMatch {
  const known = [
    ...new Set(residents.map((p) => p.environment).filter(Boolean)),
  ] as string[];
  const anyUnknown = residents.some((p) => !p.environment);
  if (known.length > 1) return "different";
  if (anyUnknown) return "unknown";
  if (known.length === 1) return "shared";
  return "unknown";
}

export function explainGroup(residents: Pokemon[]) {
  const match = environmentMatch(residents);
  const environments = [
    ...new Set(residents.map((p) => p.environment).filter(Boolean)),
  ] as string[];
  const count = new Map<string, number>();
  residents.forEach((p) =>
    p.favorites.forEach((f) => count.set(f, (count.get(f) || 0) + 1)),
  );
  const sharedFavorites = [...count]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const missingFavorites = residents.filter((p) => !p.favorites.length);
  const unknownEnvironments = residents.filter((p) => !p.environment);
  const lines: string[] = [];
  if (match === "shared")
    lines.push(`Recorded environment: ${environments[0]}.`);
  else if (match === "different")
    lines.push(
      `${environments.length ? `Recorded environments: ${environments.join(", ")}.` : "Recorded environments differ."} This is not a game prohibition; check each resident's needs.`,
    );
  else lines.push("Environmental preferences are not recorded for this group.");
  if (sharedFavorites.length)
    lines.push(
      `Shared favorite categories: ${sharedFavorites
        .map(([f, n]) => `${f} (${n} residents)`)
        .join(", ")}.`,
    );
  else lines.push("No shared favorite categories are recorded.");
  if (missingFavorites.length)
    lines.push(
      `Favorites are not recorded for ${missingFavorites
        .map((p) => p.name)
        .join(
          ", ",
        )}. Missing favorites are unknown evidence, not proof of incompatibility.`,
    );
  if (unknownEnvironments.length)
    lines.push(
      `Environment is not recorded for ${unknownEnvironments
        .map((p) => p.name)
        .join(", ")}.`,
    );
  return {
    match,
    environments,
    sharedFavorites,
    missingFavorites: missingFavorites.map((p) => p.id),
    unknownEnvironments: unknownEnvironments.map((p) => p.id),
    lines,
  };
}

export function suggestHomeKit(
  occupants: number,
  catalog: Catalog,
): PlannableKit | null {
  const fit = plannableKits(catalog.kits).filter((k) => k.capacity >= occupants);
  if (!fit.length) return null;
  return [...fit].sort(
    (a, b) =>
      a.capacity - occupants - (b.capacity - occupants) ||
      a.width * a.depth - b.width * b.depth ||
      a.id.localeCompare(b.id),
  )[0];
}

export function eligibleKits(
  occupants: number,
  catalog: Catalog,
  availableKitIds: string[] | null = null,
) {
  return plannableKits(catalog.kits)
    .filter((k) => k.capacity >= occupants)
    .filter((k) => !availableKitIds || availableKitIds.includes(k.id))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function effectiveMaxResidents(
  settings: HousematePlanSettings,
  catalog: Catalog,
  availableKitIds: string[] | null = null,
) {
  const kits = availableKitIds
    ? plannableKits(catalog.kits).filter((k) => availableKitIds.includes(k.id))
    : plannableKits(catalog.kits);
  const maxCapacity = Math.max(0, ...kits.map((k) => k.capacity));
  return Math.max(0, Math.min(settings.maxResidents, maxCapacity));
}

export function estimateHomeCount(
  roster: string[],
  catalog: Catalog,
  settings: HousematePlanSettings,
  availableKitIds: string[] | null = null,
) {
  if (!roster.length) return 0;
  const cap = effectiveMaxResidents(settings, catalog, availableKitIds);
  if (cap < 1) return roster.length;
  const pmap = pokemonMap(catalog);
  const byEnv = new Map<string, number>();
  let unknown = 0;
  for (const id of roster) {
    const env = pmap.get(id)?.environment;
    if (!env) unknown += 1;
    else byEnv.set(env, (byEnv.get(env) || 0) + 1);
  }
  let homes = unknown;
  for (const count of byEnv.values()) homes += Math.ceil(count / cap);
  return homes;
}

function pokemonMap(catalog: Catalog) {
  return new Map(catalog.pokemon.map((p) => [p.id, p]));
}

function normalizeRoster(roster: string[], catalog: Catalog) {
  const ids = [...new Set(roster)].sort();
  if (ids.some((id) => !catalog.pokemon.some((p) => p.id === id)))
    throw Error("Roster contains an unknown Pokémon.");
  return ids;
}

function favoriteOverlap(group: Pokemon[], candidate: Pokemon) {
  return Math.min(
    ...group.map(
      (p) => p.favorites.filter((f) => candidate.favorites.includes(f)).length,
    ),
  );
}

function packEnvironment(
  members: Pokemon[],
  capacity: number,
  affinityFloor: boolean,
) {
  const remaining = [...members];
  const groups: Pokemon[][] = [];
  while (remaining.length) {
    const affinities = new Map(
      remaining.map((candidate) => [
        candidate.id,
        remaining
          .filter((other) => other.id !== candidate.id)
          .reduce(
            (sum, other) => sum + favoriteOverlap([candidate], other),
            0,
          ),
      ]),
    );
    remaining.sort(
      (a, b) =>
        affinities.get(b.id)! - affinities.get(a.id)! ||
        a.id.localeCompare(b.id),
    );
    const group = [remaining.shift()!];
    while (group.length < capacity && remaining.length) {
      remaining.sort(
        (a, b) =>
          favoriteOverlap(group, b) - favoriteOverlap(group, a) ||
          a.id.localeCompare(b.id),
      );
      if (
        affinityFloor &&
        group.length >= 2 &&
        favoriteOverlap(group, remaining[0]) === 0
      )
        break;
      group.push(remaining.shift()!);
    }
    groups.push(group);
  }
  return groups;
}

function nextHomeId(homes: { id: string }[]) {
  const nums = homes.map((h) => Number(/^home-(\d+)$/.exec(h.id)?.[1] || 0));
  return `home-${Math.max(0, ...nums) + 1}`;
}

function assignHomes(
  groups: Pokemon[][],
  catalog: Catalog,
): { homes: RecommendedHome[]; unresolved: UnresolvedResident[] } {
  const homes: RecommendedHome[] = [];
  const unresolved: UnresolvedResident[] = [];
  const queue = [...groups];
  while (queue.length) {
    const group = queue.shift()!;
    const kit = suggestHomeKit(group.length, catalog);
    if (kit) {
      homes.push({
        id: nextHomeId(homes),
        kitId: kit.id,
        residents: group.map((p) => p.id),
      });
      continue;
    }
    if (group.length > 1) {
      const keep = Math.max(1, Math.floor(group.length / 2));
      queue.unshift(group.slice(keep), group.slice(0, keep));
      continue;
    }
    unresolved.push({ id: group[0].id, reason: NO_HOME });
  }
  return { homes, unresolved };
}

export function recommendHousemates(
  input: {
    roster: string[];
    sourceRoster: string[];
    areaFilter: string | null;
  },
  catalog: Catalog,
  now = () => new Date().toISOString(),
  options?: {
    settings?: HousematePlanSettings;
    availableKitIds?: string[] | null;
  },
): HousematePlan {
  const roster = normalizeRoster(input.roster, catalog);
  const sourceRoster = [...new Set(input.sourceRoster)].sort();
  const stamp = now();
  const settings = options?.settings ?? DEFAULT_HOUSEMATE_SETTINGS;
  const availableKitIds = options?.availableKitIds ?? null;
  const usableKits = availableKitIds
    ? plannableKits(catalog.kits).filter((k) => availableKitIds.includes(k.id))
    : plannableKits(catalog.kits);
  const usableCatalog: Catalog = { ...catalog, kits: usableKits };
  if (!roster.length)
    return {
      version: HOUSEMATE_PLAN_VERSION,
      roster,
      sourceRoster,
      areaFilter: input.areaFilter,
      settings,
      availableKitIds,
      homes: [],
      unresolved: [],
      catalogVersion: catalog.version,
      createdAt: stamp,
      updatedAt: stamp,
    };
  const pmap = pokemonMap(catalog);
  const maxCapacity = Math.max(0, ...usableKits.map((k) => k.capacity));
  const effectiveCap = Math.max(0, Math.min(settings.maxResidents, maxCapacity));
  if (effectiveCap < 1) {
    return {
      version: HOUSEMATE_PLAN_VERSION,
      roster,
      sourceRoster,
      areaFilter: input.areaFilter,
      settings,
      availableKitIds,
      homes: [],
      unresolved: roster.map((id) => ({ id, reason: NO_HOME })),
      catalogVersion: catalog.version,
      createdAt: stamp,
      updatedAt: stamp,
    };
  }
  const byEnv = new Map<string, Pokemon[]>();
  const unknown: Pokemon[] = [];
  for (const id of roster) {
    const p = pmap.get(id)!;
    if (!p.environment) unknown.push(p);
    else {
      const list = byEnv.get(p.environment) || [];
      list.push(p);
      byEnv.set(p.environment, list);
    }
  }
  const groups: Pokemon[][] = [];
  for (const env of [...byEnv.keys()].sort())
    groups.push(
      ...packEnvironment(byEnv.get(env)!, effectiveCap, settings.affinityFloor),
    );
  for (const p of unknown) groups.push([p]);
  const { homes, unresolved } = assignHomes(groups, usableCatalog);
  return {
    version: HOUSEMATE_PLAN_VERSION,
    roster,
    sourceRoster,
    areaFilter: input.areaFilter,
    settings,
    availableKitIds,
    homes,
    unresolved,
    catalogVersion: catalog.version,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function migrateHousematePlan(plan: HousematePlan): HousematePlan {
  if (plan.settings && plan.availableKitIds !== undefined && plan.version === HOUSEMATE_PLAN_VERSION)
    return plan;
  return {
    ...plan,
    version: HOUSEMATE_PLAN_VERSION,
    settings: plan.settings ?? DEFAULT_HOUSEMATE_SETTINGS,
    availableKitIds:
      plan.availableKitIds === undefined ? null : plan.availableKitIds,
  };
}

export function convertSpatialPlan(
  plan: Plan,
  catalog: Catalog,
  now = () => new Date().toISOString(),
): HousematePlan {
  const stamp = now();
  const homes: RecommendedHome[] = [];
  const unresolved: UnresolvedResident[] = plan.unplaced.map((r) => ({
    id: r.id,
    reason: r.reason,
  }));
  for (const home of plan.homes) {
    const kit = plannableKitMap(catalog.kits).get(home.kitId);
    const suggested =
      kit && home.residents.length <= kit.capacity
        ? kit
        : suggestHomeKit(home.residents.length, catalog);
    if (!suggested || !home.residents.length) {
      home.residents.forEach((id) =>
        unresolved.push({
          id,
          reason: "No supported home fits this converted group.",
        }),
      );
      continue;
    }
    homes.push({
      id: home.id,
      kitId: suggested.id,
      residents: [...home.residents],
    });
  }
  return {
    version: HOUSEMATE_PLAN_VERSION,
    roster: [...plan.roster].sort(),
    sourceRoster: [...(plan.sourceRoster || plan.roster)].sort(),
    areaFilter: plan.area,
    settings: DEFAULT_HOUSEMATE_SETTINGS,
    availableKitIds: null,
    homes,
    unresolved,
    catalogVersion: catalog.version,
    createdAt: stamp,
    updatedAt: stamp,
    convertedFrom: plan.area,
  };
}

function touch(plan: HousematePlan): HousematePlan {
  return { ...plan, updatedAt: new Date().toISOString() };
}

function assertKitCapacity(
  kitId: string,
  residents: string[],
  catalog: Catalog,
) {
  const kit = plannableKitMap(catalog.kits).get(kitId);
  if (!kit) throw Error("Choose a supported home.");
  if (residents.length > kit.capacity)
    throw Error(
      "That home is full. Split someone out or choose a larger home.",
    );
  return kit;
}

export function changeHomeKit(
  plan: HousematePlan,
  homeId: string,
  kitId: string,
  catalog: Catalog,
): HousematePlan {
  const home = plan.homes.find((h) => h.id === homeId);
  if (!home) throw Error("Choose a valid home.");
  assertKitCapacity(kitId, home.residents, catalog);
  return touch({
    ...plan,
    homes: plan.homes.map((h) => (h.id === homeId ? { ...h, kitId } : h)),
  });
}

export function splitResident(
  plan: HousematePlan,
  homeId: string,
  residentId: string,
  catalog: Catalog,
): HousematePlan {
  const home = plan.homes.find((h) => h.id === homeId);
  if (!home || !home.residents.includes(residentId))
    throw Error("Choose a valid resident.");
  if (home.residents.length === 1)
    throw Error("That Pokémon already has its own group.");
  const kit = suggestHomeKit(1, catalog);
  if (!kit) throw Error(NO_HOME);
  const remaining = home.residents.filter((id) => id !== residentId);
  assertKitCapacity(home.kitId, remaining, catalog);
  const homes = plan.homes
    .map((h) =>
      h.id === homeId
        ? { ...h, residents: remaining }
        : { ...h, residents: [...h.residents] },
    )
    .filter((h) => h.residents.length);
  homes.push({
    id: nextHomeId(homes),
    kitId: kit.id,
    residents: [residentId],
  });
  return touch({ ...plan, homes });
}

export function moveResident(
  plan: HousematePlan,
  fromId: string,
  toId: string,
  residentId: string,
  catalog: Catalog,
): HousematePlan {
  if (fromId === toId) throw Error("Choose a different destination.");
  const homes = plan.homes.map((h) => ({ ...h, residents: [...h.residents] }));
  const unresolved = plan.unresolved.filter((r) => r.id !== residentId);
  const fromHome = homes.find((h) => h.id === fromId);
  const inUnresolved = plan.unresolved.some((r) => r.id === residentId);
  if (fromHome) {
    if (!fromHome.residents.includes(residentId))
      throw Error("Choose a valid resident.");
    fromHome.residents = fromHome.residents.filter((id) => id !== residentId);
  } else if (!inUnresolved) throw Error("Choose a valid resident.");
  if (toId === "new") {
    const kit = suggestHomeKit(1, catalog);
    if (!kit) throw Error(NO_HOME);
    homes.push({
      id: nextHomeId(homes),
      kitId: kit.id,
      residents: [residentId],
    });
  } else {
    const toHome = homes.find((h) => h.id === toId);
    if (!toHome) throw Error("Choose a valid destination.");
    if (toHome.residents.includes(residentId))
      throw Error("That Pokémon is already in this home.");
    toHome.residents.push(residentId);
    assertKitCapacity(toHome.kitId, toHome.residents, catalog);
  }
  return touch({
    ...plan,
    homes: homes.filter((h) => h.residents.length),
    unresolved,
  });
}

export function swapHousemates(
  plan: HousematePlan,
  fromId: string,
  toId: string,
  residentId: string,
  otherId: string,
  catalog: Catalog,
): HousematePlan {
  const homes = plan.homes.map((h) => ({ ...h, residents: [...h.residents] }));
  const a = homes.find((h) => h.id === fromId);
  const b = homes.find((h) => h.id === toId);
  if (
    !a ||
    !b ||
    a === b ||
    !a.residents.includes(residentId) ||
    !b.residents.includes(otherId)
  )
    throw Error("Choose a valid resident and destination.");
  a.residents = a.residents.filter((id) => id !== residentId);
  b.residents = b.residents.filter((id) => id !== otherId);
  a.residents.push(otherId);
  b.residents.push(residentId);
  assertKitCapacity(a.kitId, a.residents, catalog);
  assertKitCapacity(b.kitId, b.residents, catalog);
  return touch({ ...plan, homes });
}

export function combinedSupplies(
  plan: HousematePlan,
  catalog: Catalog,
  envLevels?: Record<string, number> | null,
) {
  const construction = new Map<string, number>();
  const furnishingCounts = new Map<
    string,
    { name: string; quantity: number; homeIds: string[] }
  >();
  for (const home of plan.homes) {
    const kit = plannableKitMap(catalog.kits).get(home.kitId);
    kit?.materials.forEach((m) =>
      construction.set(m.name, (construction.get(m.name) || 0) + m.quantity),
    );
    const residents = home.residents
      .map((id) => catalog.pokemon.find((p) => p.id === id))
      .filter((p): p is Pokemon => !!p);
    furnishings(residents, catalog.items, envLevels).selected.forEach(({ item }) => {
      const current = furnishingCounts.get(item.id) || {
        name: item.name,
        quantity: 0,
        homeIds: [],
      };
      current.quantity += 1;
      current.homeIds.push(home.id);
      furnishingCounts.set(item.id, current);
    });
  }
  return {
    construction: [...construction]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    furnishings: [...furnishingCounts.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

/** The single environment every resident of this home shares, or null if mixed/unrecorded. */
export function homeEnvironment(
  home: RecommendedHome,
  catalog: Catalog,
): string | null {
  const residents = home.residents
    .map((id) => catalog.pokemon.find((p) => p.id === id))
    .filter((p): p is Pokemon => !!p);
  const match = environmentMatch(residents);
  if (match !== "shared") return null;
  return residents.find((p) => p.environment)?.environment || null;
}

export function environmentSupplies(
  plan: HousematePlan,
  catalog: Catalog,
  envLevels?: Record<string, number> | null,
) {
  const counts = new Map<
    string,
    {
      name: string;
      quantity: number;
      homeIds: string[];
      envRequirement: EnvLevelRequirement | null;
      locked: boolean;
    }
  >();
  for (const home of plan.homes) {
    const env = homeEnvironment(home, catalog);
    if (!env) continue;
    for (const itemId of environmentExampleIds(env)) {
      const item = catalog.items.find((i) => i.id === itemId);
      if (!item) continue;
      const envRequirement = itemEnvLock(item, envLevels);
      const current = counts.get(item.id) || {
        name: item.name,
        quantity: 0,
        homeIds: [],
        envRequirement,
        locked: !!envRequirement,
      };
      current.quantity += 1;
      current.homeIds.push(home.id);
      counts.set(item.id, current);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function splitHomeByEnvironment(
  plan: HousematePlan,
  homeId: string,
  catalog: Catalog,
): HousematePlan {
  const home = plan.homes.find((h) => h.id === homeId);
  if (!home) throw Error("Choose a valid home.");
  const residents = home.residents
    .map((id) => catalog.pokemon.find((p) => p.id === id))
    .filter((p): p is Pokemon => !!p);
  const groups = new Map<string, Pokemon[]>();
  for (const p of residents) {
    const key = p.environment || "";
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  }
  if (groups.size < 2)
    throw Error("This home already has one recorded environment.");
  const homes = plan.homes.filter((h) => h.id !== homeId);
  const unresolved = [...plan.unresolved];
  for (const group of groups.values()) {
    const kit = suggestHomeKit(group.length, catalog);
    if (!kit) {
      group.forEach((p) => unresolved.push({ id: p.id, reason: NO_HOME }));
      continue;
    }
    homes.push({
      id: nextHomeId(homes),
      kitId: kit.id,
      residents: group.map((p) => p.id),
    });
  }
  return touch({ ...plan, homes, unresolved });
}

export function addHome(
  plan: HousematePlan,
  kitId: string,
  catalog: Catalog,
): HousematePlan {
  const kit = plannableKitMap(catalog.kits).get(kitId);
  if (!kit) throw Error("Choose a supported home.");
  return touch({
    ...plan,
    homes: [...plan.homes, { id: nextHomeId(plan.homes), kitId, residents: [] }],
  });
}
