import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import type { Catalog, Pokemon, Kit } from "../src/catalog/types";
import {
  canPlace,
  generatePlan,
  rosterForArea,
  swapResidents,
  furnishings,
} from "../src/planner/engine";
import {
  addHome,
  changeHomeKit,
  setHomeCompleted,
  combinedSupplies,
  convertSpatialPlan,
  environmentSupplies,
  explainGroup,
  homeEnvironment,
  migrateHousematePlan,
  moveResident,
  recommendHousemates,
  splitHomeByEnvironment,
  splitResident,
  suggestHomeKit,
  swapHousemates,
  uniqueFoundRoster,
} from "../src/planner/recommend";
import { DEFAULT_HOUSEMATE_SETTINGS } from "../src/planner/types";
import { defaultFilters, filterPokemon } from "../src/dex/search";
import {
  emptyState,
  validateBackup,
  readState,
  writeState,
} from "../src/persistence/store";
import type { ShoppingChecklists } from "../src/persistence/legacy";
const p = (
  id: string,
  environment: string | null = "Bright",
  favorites = ["Nature"],
): Pokemon => ({
  id,
  name: id,
  number: id === "a" ? "001" : "002",
  nationalNumber: 1,
  dex: "regular",
  image: null,
  types: ["Grass"],
  specialties: ["Grow"],
  environment,
  favorites,
  food: null,
  habitats: [],
  areas: ["Beach"],
  times: ["Day"],
  weather: ["Sun"],
  height: null,
  weight: null,
  forms: [],
  source: "https://example.com",
  partial: false,
});
const kit: Kit = {
  id: "home",
  name: "Test home",
  kind: "residence",
  width: 4,
  depth: 3,
  height: 3,
  capacity: 2,
  helpers: 8,
  specialties: ["Build"],
  materials: [{ name: "Wood", quantity: 5 }],
  buildTime: "Next day",
  source: "https://example.com",
};
const catalog: Catalog = {
  version: "test",
  pokemon: [p("a"), p("b"), p("c", "Dark"), p("d", null, [])],
  kits: [kit],
  items: [
    {
      id: "plant",
      name: "Plant",
      categories: ["Nature"],
      source: "https://example.com",
    },
  ],
  areas: ["Beach", "Ridges"],
  sources: [],
};
const input = {
  area: "Beach",
  roster: ["a", "b", "c"],
  plot: { width: 8, depth: 3 },
  kits: [{ id: "home", limit: null }],
};
describe("discovery and dex", () => {
  it("tracks one Pokémon in two areas independently", () => {
    const found = { a: ["Beach", "Ridges"], b: ["Ridges"] };
    expect(rosterForArea(found, "Beach")).toEqual(["a"]);
    expect(rosterForArea({ ...found, a: ["Ridges"] }, "Ridges")).toEqual([
      "a",
      "b",
    ]);
  });
  it("combines discovery, spawn, specialty, type and search filters", () => {
    expect(
      filterPokemon(
        catalog.pokemon,
        { a: ["Ridges"] },
        {
          ...defaultFilters,
          search: "#001",
          foundArea: "Ridges",
          spawnArea: "Beach",
          specialty: "Grow",
          type: "Grass",
          time: "Day",
          weather: "Sun",
          status: "found",
        },
      ).map((p) => p.id),
    ).toEqual(["a"]);
  });
  it("keeps catalog numbering and membership separate", () => {
    const event = { ...p("e"), dex: "event" as const, number: "E001" };
    expect(
      filterPokemon(
        [...catalog.pokemon, event],
        {},
        { ...defaultFilters, dex: "event" },
      ),
    ).toEqual([event]);
  });
  it("does not confuse possible areas with found areas", () => {
    expect(
      filterPokemon(
        catalog.pokemon,
        {},
        { ...defaultFilters, foundArea: "Beach" },
      ),
    ).toEqual([]);
  });
});
describe("comfort-first planning", () => {
  it("keeps matching environments together and lists all residents exactly once", () => {
    const plan = generatePlan(input, catalog);
    expect(plan.homes.map((h) => h.residents)).toEqual([["a", "b"], ["c"]]);
    expect(plan.unplaced).toEqual([]);
  });
  it("does not use construction helper count as housing capacity", () => {
    const plan = generatePlan(
      { ...input, roster: ["a", "b", "c", "d"], plot: { width: 4, depth: 3 } },
      catalog,
    );
    expect(plan.homes[0].residents).toHaveLength(2);
    expect(plan.unplaced).toHaveLength(2);
  });
  it("respects exact boundaries and rejects overlap", () => {
    const h = { id: "one", kitId: "home", x: 4, y: 0, residents: [] };
    expect(canPlace(h, [], input.plot, catalog)).toBe(true);
    expect(canPlace({ ...h, x: 5 }, [], input.plot, catalog)).toBe(false);
    expect(canPlace({ ...h, id: "two" }, [h], input.plot, catalog)).toBe(false);
  });
  it("never places a structure or an undocumented home", () => {
    // Structures are buildings, not homes; a residence with no recorded
    // footprint cannot be placed on the grid either. Neither may reach the
    // planner. See docs/items-directory-plan.md section 3.3.
    const withStructures: Catalog = {
      ...catalog,
      kits: [
        kit,
        { ...kit, id: "stage", name: "Stage", kind: "structure", capacity: null },
        { ...kit, id: "unknown-kit", name: "Unknown", kind: "unknown", capacity: null },
        { ...kit, id: "no-footprint", width: null, depth: null },
      ],
    };
    for (const kitId of ["stage", "unknown-kit", "no-footprint"]) {
      expect(
        canPlace(
          { id: "x", kitId, x: 0, y: 0, residents: [] },
          [],
          input.plot,
          withStructures,
        ),
      ).toBe(false);
      expect(() =>
        generatePlan(
          { ...input, kits: [{ id: kitId, limit: null }] },
          withStructures,
        ),
      ).toThrow(/supported home kit/);
    }
    expect(
      generatePlan({ ...input, kits: [{ id: "home", limit: null }] }, withStructures)
        .homes.length,
    ).toBeGreaterThan(0);
  });
  it("rejects fractional positions and dimensions", () => {
    expect(() =>
      generatePlan({ ...input, plot: { width: 8.5, depth: 3 } }, catalog),
    ).toThrow();
    expect(
      canPlace(
        { id: "x", kitId: "home", x: 0.5, y: 0, residents: [] },
        [],
        input.plot,
        catalog,
      ),
    ).toBe(false);
  });
  it("returns an explanation for an undersized plot", () => {
    const plan = generatePlan(
      { ...input, plot: { width: 1, depth: 1 } },
      catalog,
    );
    expect(plan.homes).toEqual([]);
    expect(plan.unplaced).toHaveLength(3);
  });
  it("respects zero kit supply", () => {
    expect(
      generatePlan({ ...input, kits: [{ id: "home", limit: 0 }] }, catalog)
        .homes,
    ).toEqual([]);
  });
  it("respects maximum kit supply", () => {
    expect(
      generatePlan({ ...input, kits: [{ id: "home", limit: 1 }] }, catalog)
        .homes,
    ).toHaveLength(1);
  });
  it("handles an empty roster", () => {
    expect(generatePlan({ ...input, roster: [] }, catalog).homes).toEqual([]);
  });
  it("does not silently invent missing preferences", () => {
    expect(furnishings([p("x", null, [])], catalog.items)).toEqual({
      selected: [],
      uncovered: [],
    });
    expect(
      generatePlan({ ...input, roster: ["a", "d"] }, catalog).homes,
    ).toHaveLength(2);
  });
  it("produces stable placements independent of roster ordering", () => {
    const a = generatePlan(input, catalog),
      b = generatePlan(
        { ...input, roster: [...input.roster].reverse() },
        catalog,
      );
    expect(a.homes).toEqual(b.homes);
  });
  it("selects furnishings backed by preference mappings", () => {
    const result = furnishings(
      [p("a", "Bright", ["Nature", "Soft"])],
      catalog.items,
    );
    expect(result.selected[0].benefits).toEqual(["a"]);
    expect(result.uncovered).toEqual(["Soft"]);
  });
  it("flags furnishings above the recorded environment level without hiding them", () => {
    const items = [
      {
        id: "gated",
        name: "Gated plant",
        categories: ["Nature"],
        source: "https://example.com",
        recipeLocation: "Shop – Bubbly Basin (Env. level 10)",
      },
    ];
    const residents = [p("a", "Bright", ["Nature"])];
    expect(furnishings(residents, items).selected[0].locked).toBe(true);
    const locked = furnishings(residents, items, { "Bubbly Basin": 4 });
    expect(locked.selected).toHaveLength(1);
    expect(locked.selected[0].locked).toBe(true);
    expect(locked.selected[0].envRequirement).toEqual({
      area: "Bubbly Basin",
      level: 10,
    });
    expect(
      furnishings(residents, items, { "Bubbly Basin": 10 }).selected[0].locked,
    ).toBe(false);
  });
  it("prefers an obtainable furnishing once an environment level is recorded", () => {
    const items = [
      {
        id: "gated",
        name: "Gated plant",
        categories: ["Nature", "Soft"],
        source: "https://example.com",
        recipeLocation: "Shop – Bubbly Basin (Env. level 10)",
      },
      {
        id: "plain",
        name: "Plain plant",
        categories: ["Nature"],
        source: "https://example.com",
      },
    ];
    const residents = [p("a", "Bright", ["Nature", "Soft"])];
    expect(furnishings(residents, items).selected.map((row) => row.item.id)).toEqual([
      "plain",
      "gated",
    ]);
    expect(
      furnishings(residents, items, { "Bubbly Basin": 4 }).selected.map(
        (row) => row.item.id,
      ),
    ).toEqual(["plain", "gated"]);
    expect(
      furnishings(residents, items, { "Bubbly Basin": 4 }).selected[1].locked,
    ).toBe(true);
    expect(
      furnishings(residents, items, { "Bubbly Basin": 10 }).selected.map(
        (row) => row.item.id,
      ),
    ).toEqual(["gated"]);
  });
  it("allows a manual swap without duplicate residents", () => {
    const plan = generatePlan(input, catalog);
    const next = swapResidents(plan, "home-1", "home-2", "b", "c", catalog);
    expect(next.homes.map((h) => h.residents)).toEqual([["a", "c"], ["b"]]);
    expect(plan.homes[0].residents).toEqual(["a", "b"]);
  });
  it("rejects moving into a full destination", () => {
    const plan = generatePlan(input, catalog);
    expect(() =>
      swapResidents(plan, "home-2", "home-1", "c", null, catalog),
    ).toThrow("full");
  });
});
describe("backup and persistence", () => {
  const saved = () => ({
    ...emptyState(),
    found: { a: ["Beach", "Ridges"] },
    plans: { Beach: generatePlan(input, catalog) },
  });
  it("round-trips discoveries and manual layouts through IndexedDB", async () => {
    const initial = saved();
    await writeState(initial);
    expect(await readState()).toEqual(initial);
  });
  it("refuses a saved kit filter naming a kit that is not a home", () => {
    const withStructure: Catalog = {
      ...catalog,
      kits: [kit, { ...kit, id: "stage", kind: "structure", capacity: null }],
    };
    expect(() =>
      validateBackup(
        { ...saved(), availableKitIds: ["stage"] },
        withStructure,
      ),
    ).toThrow(/available-kits/);
    expect(
      validateBackup({ ...saved(), availableKitIds: ["home"] }, withStructure)
        .availableKitIds,
    ).toEqual(["home"]);
  });
  it("round-trips recorded environment levels and accepts old backups without them", () => {
    expect(
      validateBackup(
        { ...saved(), envLevels: { "Bubbly Basin": 4 } },
        catalog,
      ).envLevels,
    ).toEqual({ "Bubbly Basin": 4 });
    const { envLevels: _envLevels, ...legacy } = saved();
    expect(validateBackup(legacy, catalog).envLevels).toBeUndefined();
  });
  it("rejects invalid recorded environment levels", () => {
    expect(() =>
      validateBackup({ ...saved(), envLevels: { Beach: -1 } }, catalog),
    ).toThrow(/environment levels/);
    expect(() =>
      validateBackup({ ...saved(), envLevels: [] }, catalog),
    ).toThrow(/environment levels/);
    expect(() =>
      validateBackup({ ...saved(), envLevels: { "": 3 } }, catalog),
    ).toThrow(/environment levels/);
  });
  it("accepts an exported notebook", () => {
    const data = saved();
    expect(validateBackup(JSON.parse(JSON.stringify(data)), catalog)).toEqual(
      data,
    );
  });
  it("accepts tracked material quantities while old backups remain valid", () => {
    expect(
      validateBackup({ ...saved(), materialCounts: { plant: 3 } }, catalog)
        .materialCounts,
    ).toEqual({ plant: 3 });
    const { materialCounts: _materialCounts, ...legacy } = saved();
    expect(validateBackup(legacy, catalog).materialCounts).toBeUndefined();
  });
  it("rejects invalid tracked material quantities", () => {
    expect(() =>
      validateBackup({ ...saved(), materialCounts: { plant: -1 } }, catalog),
    ).toThrow();
    expect(() =>
      validateBackup({ ...saved(), materialCounts: { unknown: 2 } }, catalog),
    ).toThrow();
    expect(() =>
      validateBackup({ ...saved(), materialCounts: { plant: 1.5 } }, catalog),
    ).toThrow();
  });
  it("preserves legacy checkbox shopping-checklist data untouched, for compatibility only", () => {
    const legacy: ShoppingChecklists = {
      habitats: {
        "a:garden": {
          id: "a:garden",
          pokemonId: "a",
          habitatId: "garden",
          habitatName: "Garden",
          rows: [
            { id: "item:plant:3:0", label: "Plant", quantity: 3, checked: true },
          ],
        },
      },
    };
    const data = { ...saved(), shoppingChecklists: legacy };
    const result = validateBackup(JSON.parse(JSON.stringify(data)), catalog);
    expect(result.shoppingChecklists).toEqual(legacy);
  });
  it("rejects unsupported versions", () => {
    expect(() =>
      validateBackup({ ...saved(), schemaVersion: 2 }, catalog),
    ).toThrow("Unsupported");
  });
  it("rejects unknown areas and Pokémon", () => {
    expect(() =>
      validateBackup({ ...saved(), found: { unknown: ["Beach"] } }, catalog),
    ).toThrow();
    expect(() =>
      validateBackup({ ...saved(), found: { a: ["Unknown"] } }, catalog),
    ).toThrow();
  });
  it("rejects duplicate residents and out-of-bounds imported layouts", () => {
    const a = saved();
    a.plans.Beach.homes[1].residents = ["a"];
    expect(() => validateBackup(a, catalog)).toThrow();
    const b = saved();
    b.plans.Beach.homes[0].x = -1;
    expect(() => validateBackup(b, catalog)).toThrow();
  });
  it("rejects backups that drop unplaced residents", () => {
    const a = saved();
    a.plans.Beach.homes = [];
    expect(() => validateBackup(a, catalog)).toThrow();
  });
});
describe("housemate recommendations", () => {
  const now = () => "2026-09-08T00:00:00.000Z";
  const input = {
    roster: ["a", "b", "c", "d"],
    sourceRoster: ["a", "b", "c", "d"],
    areaFilter: null as string | null,
  };
  it("deduplicates a Pokémon found in multiple areas", () => {
    expect(
      uniqueFoundRoster({ a: ["Beach", "Ridges"], b: ["Ridges"] }, null),
    ).toEqual(["a", "b"]);
    expect(
      uniqueFoundRoster({ a: ["Beach", "Ridges"], b: ["Ridges"] }, "Beach"),
    ).toEqual(["a"]);
  });
  it("groups matching environments, keeps unknowns separate, and lists everyone once", () => {
    const plan = recommendHousemates(input, catalog, now);
    expect(plan.homes.map((h) => h.residents)).toEqual([
      ["a", "b"],
      ["c"],
      ["d"],
    ]);
    expect(plan.unresolved).toEqual([]);
    expect(
      [
        ...plan.homes.flatMap((h) => h.residents),
        ...plan.unresolved.map((r) => r.id),
      ].sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("is independent of roster order", () => {
    const a = recommendHousemates(input, catalog, now);
    const b = recommendHousemates(
      { ...input, roster: [...input.roster].reverse() },
      catalog,
      now,
    );
    expect(a.homes).toEqual(b.homes);
  });
  it("does not treat missing favorites as incompatibility", () => {
    const extra = {
      ...catalog,
      pokemon: [...catalog.pokemon, p("e", "Bright", [])],
    };
    const plan = recommendHousemates(
      { ...input, roster: ["a", "e"], sourceRoster: ["a", "e"] },
      extra,
      now,
    );
    expect(plan.homes.map((h) => h.residents)).toEqual([["a", "e"]]);
    expect(
      explainGroup(
        plan.homes[0].residents.map((id) =>
          extra.pokemon.find((x) => x.id === id)!,
        ),
      ).match,
    ).toBe("shared");
  });
  it("keeps a missing environment unknown instead of calling it a conflict", () => {
    expect(explainGroup([p("a", "Bright"), p("e", null)]).match).toBe(
      "unknown",
    );
  });
  it("keeps a stronger shared-favorite group together before filling spare beds", () => {
    const extra = {
      ...catalog,
      pokemon: [
        p("a", "Bright", ["Unique"]),
        p("b", "Bright", ["Shared"]),
        p("c", "Bright", ["Shared"]),
        p("d", "Bright", ["Shared"]),
      ],
      kits: [{ ...kit, capacity: 3 }],
    };
    const plan = recommendHousemates(
      { ...input, roster: ["a", "b", "c", "d"] },
      extra,
      now,
    );
    expect(plan.homes.map((h) => h.residents)).toEqual([
      ["b", "c", "d"],
      ["a"],
    ]);
  });
  it("keeps unknown environments in separate groups by default", () => {
    const extra = {
      ...catalog,
      pokemon: [...catalog.pokemon, p("e", null, ["Nature"])],
    };
    const plan = recommendHousemates(
      { ...input, roster: ["d", "e"], sourceRoster: ["d", "e"] },
      extra,
      now,
    );
    expect(plan.homes.map((h) => h.residents)).toEqual([["d"], ["e"]]);
    expect(explainGroup([extra.pokemon.find((x) => x.id === "d")!]).match).toBe(
      "unknown",
    );
  });
  it("suggests the tightest supported home without ranking by cost", () => {
    const hut: Kit = {
      ...kit,
      id: "hut",
      name: "Hut",
      width: 3,
      depth: 3,
      capacity: 1,
    };
    const cottage: Kit = {
      ...kit,
      id: "cottage",
      name: "Cottage",
      width: 5,
      depth: 4,
      capacity: 2,
    };
    const house: Kit = {
      ...kit,
      id: "house",
      name: "House",
      width: 8,
      depth: 6,
      capacity: 4,
    };
    const multi = { ...catalog, kits: [house, cottage, hut] };
    expect(suggestHomeKit(1, multi)?.id).toBe("hut");
    expect(suggestHomeKit(2, multi)?.id).toBe("cottage");
    expect(suggestHomeKit(3, multi)?.id).toBe("house");
  });
  it("places leftover residents in needs-review instead of dropping them", () => {
    const plan = recommendHousemates(input, { ...catalog, kits: [] }, now);
    expect(plan.homes).toEqual([]);
    expect(plan.unresolved.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("handles an empty selection", () => {
    expect(
      recommendHousemates({ ...input, roster: [] }, catalog, now).homes,
    ).toEqual([]);
  });
  it("recalculates explanations and supplies after a move", () => {
    const plan = recommendHousemates(input, catalog, now);
    const moved = moveResident(plan, "home-1", "home-2", "b", catalog);
    expect(moved.homes.map((h) => h.residents)).toEqual([
      ["a"],
      ["c", "b"],
      ["d"],
    ]);
    expect(
      explainGroup(
        moved.homes[1].residents.map((id) =>
          catalog.pokemon.find((x) => x.id === id)!,
        ),
      ).match,
    ).toBe("different");
    expect(combinedSupplies(moved, catalog).construction).toEqual([
      { name: "Wood", quantity: 15 },
    ]);
  });
  it("counts furnishings per home instead of reusing one item", () => {
    const plan = recommendHousemates(
      { ...input, roster: ["a", "b"], sourceRoster: ["a", "b"] },
      catalog,
      now,
    );
    const split = splitResident(plan, "home-1", "b", catalog);
    expect(combinedSupplies(split, catalog).furnishings[0].quantity).toBe(2);
  });
  it("rejects capacity overflow and duplicate residents", () => {
    const plan = recommendHousemates(input, catalog, now);
    expect(() => moveResident(plan, "home-2", "home-1", "c", catalog)).toThrow(
      "full",
    );
    const swapped = swapHousemates(plan, "home-1", "home-2", "b", "c", catalog);
    expect(swapped.homes.map((h) => h.residents)).toEqual([
      ["a", "c"],
      ["b"],
      ["d"],
    ]);
    expect(plan.homes[0].residents).toEqual(["a", "b"]);
  });
  it("converts a spatial plan without overwriting it", () => {
    const spatial = generatePlan(
      {
        area: "Beach",
        roster: ["a", "b", "c"],
        plot: { width: 8, depth: 3 },
        kits: [{ id: "home", limit: null }],
      },
      catalog,
    );
    const converted = convertSpatialPlan(spatial, catalog, now);
    expect(converted.homes.map((h) => h.residents)).toEqual(
      spatial.homes.map((h) => h.residents),
    );
    expect(converted.convertedFrom).toBe("Beach");
    expect(spatial.plot).toEqual({ width: 8, depth: 3 });
  });
});
describe("housemate backup", () => {
  const now = () => "2026-09-08T00:00:00.000Z";
  const notebook = () => ({
    ...emptyState(),
    found: { a: ["Beach", "Ridges"] },
    plans: {
      Beach: generatePlan(
        {
          area: "Beach",
          roster: ["a", "b", "c"],
          plot: { width: 8, depth: 3 },
          kits: [{ id: "home", limit: null }],
        },
        catalog,
      ),
    },
    housematePlan: recommendHousemates(
      {
        roster: ["a", "b"],
        sourceRoster: ["a"],
        areaFilter: null,
      },
      catalog,
      now,
    ),
  });
  it("round-trips legacy layouts and the housemate plan together", () => {
    const data = notebook();
    expect(validateBackup(JSON.parse(JSON.stringify(data)), catalog)).toEqual(
      data,
    );
    expect(data.plans.Beach.plot.width).toBe(8);
  });
  it("accepts a backup that only has spatial plans", () => {
    const legacy = {
      schemaVersion: 1 as const,
      found: { a: ["Beach"] },
      plans: notebook().plans,
    };
    const result = validateBackup(legacy, catalog);
    expect(result.found).toEqual(legacy.found);
    expect(result.plans).toEqual(legacy.plans);
    expect(result.crafting).toEqual({
      version: 2,
      learnedRecipeIds: [],
    });
  });
  it("rejects a housemate plan that drops residents", () => {
    const a = notebook();
    a.housematePlan!.homes = [];
    expect(() => validateBackup(a, catalog)).toThrow();
  });
  it("defaults settings and an available-kits filter for a pre-occupancy plan", () => {
    const legacy = notebook();
    // Simulate a plan saved before the occupancy settings existed.
    const { settings: _settings, availableKitIds: _availableKitIds, ...bare } =
      legacy.housematePlan!;
    (legacy as { housematePlan: unknown }).housematePlan = {
      ...bare,
      version: 1,
    };
    const result = validateBackup(legacy, catalog);
    expect(result.housematePlan!.settings).toEqual(DEFAULT_HOUSEMATE_SETTINGS);
    expect(result.housematePlan!.availableKitIds).toBeNull();
    expect(result.housematePlan!.version).toBe(2);
  });
});
describe("occupancy and available kits", () => {
  const now = () => "2026-09-09T00:00:00.000Z";
  const big: Kit = { ...kit, id: "big", capacity: 4 };
  const roomy = { ...catalog, kits: [big] };
  it("caps generated group size to the requested maximum residents", () => {
    const plan = recommendHousemates(
      {
        roster: ["a", "b"],
        sourceRoster: ["a", "b"],
        areaFilter: null,
      },
      roomy,
      now,
      { settings: { maxResidents: 1, affinityFloor: false } },
    );
    expect(plan.homes.map((h) => h.residents)).toEqual([["a"], ["b"]]);
    expect(plan.settings).toEqual({ maxResidents: 1, affinityFloor: false });
  });
  it("does not pad a group with a zero-overlap resident under the affinity floor", () => {
    const extra = {
      ...roomy,
      pokemon: [
        p("a", "Bright", ["Unique"]),
        p("b", "Bright", ["Shared"]),
        p("c", "Bright", ["Shared"]),
        p("d", "Bright", ["Shared"]),
      ],
    };
    const withFloor = recommendHousemates(
      { roster: ["a", "b", "c", "d"], sourceRoster: ["a", "b", "c", "d"], areaFilter: null },
      extra,
      now,
      { settings: { maxResidents: 4, affinityFloor: true } },
    );
    expect(withFloor.homes.map((h) => h.residents)).toEqual([
      ["b", "c", "d"],
      ["a"],
    ]);
    const withoutFloor = recommendHousemates(
      { roster: ["a", "b", "c", "d"], sourceRoster: ["a", "b", "c", "d"], areaFilter: null },
      extra,
      now,
      { settings: { maxResidents: 4, affinityFloor: false } },
    );
    expect(withoutFloor.homes.map((h) => h.residents)).toEqual([
      ["b", "c", "d", "a"],
    ]);
  });
  it("never drops a resident when the affinity floor stops a group early", () => {
    const extra = {
      ...roomy,
      pokemon: [
        p("a", "Bright", ["X"]),
        p("b", "Bright", ["Y"]),
        p("c", "Bright", ["Z"]),
      ],
    };
    const plan = recommendHousemates(
      { roster: ["a", "b", "c"], sourceRoster: ["a", "b", "c"], areaFilter: null },
      extra,
      now,
      { settings: { maxResidents: 4, affinityFloor: true } },
    );
    expect(
      [
        ...plan.homes.flatMap((h) => h.residents),
        ...plan.unresolved.map((r) => r.id),
      ].sort(),
    ).toEqual(["a", "b", "c"]);
    expect(plan.unresolved).toEqual([]);
  });
  it("restricts suggestions to the available kits and reports the resulting cap", () => {
    const small: Kit = { ...kit, id: "small", capacity: 1 };
    const mixed = { ...roomy, kits: [small, big] };
    const plan = recommendHousemates(
      { roster: ["a", "b"], sourceRoster: ["a", "b"], areaFilter: null },
      mixed,
      now,
      { availableKitIds: ["small"] },
    );
    expect(plan.homes.map((h) => h.residents)).toEqual([["a"], ["b"]]);
    expect(plan.homes.every((h) => h.kitId === "small")).toBe(true);
    expect(plan.availableKitIds).toEqual(["small"]);
  });
});
describe("environment guidance and manual builds", () => {
  const now = () => "2026-09-09T00:00:00.000Z";
  const withEnvItems = {
    ...catalog,
    items: [
      ...catalog.items,
      { id: "desklight", name: "Desk light", categories: [], source: "https://example.com" },
      { id: "gravestone", name: "Gravestone", categories: [], source: "https://example.com" },
    ],
  };
  it("reports a home's shared environment and lists guidance items separately from construction", () => {
    const plan = recommendHousemates(
      { roster: ["a", "b"], sourceRoster: ["a", "b"], areaFilter: null },
      withEnvItems,
      now,
    );
    expect(homeEnvironment(plan.homes[0], withEnvItems)).toBe("Bright");
    const supplies = environmentSupplies(plan, withEnvItems);
    expect(supplies.some((row) => row.name === "Desk light")).toBe(true);
    const construction = combinedSupplies(plan, withEnvItems).construction;
    expect(construction.some((row) => row.name === "Desk light")).toBe(false);
  });
  it("flags environment guidance items above the recorded level without hiding them", () => {
    const gated = {
      ...withEnvItems,
      items: withEnvItems.items.map((item) =>
        item.id === "desklight"
          ? {
              ...item,
              recipeLocation: "Shop – Bubbly Basin (Env. level 10)",
            }
          : item,
      ),
    };
    const plan = recommendHousemates(
      { roster: ["a", "b"], sourceRoster: ["a", "b"], areaFilter: null },
      gated,
      now,
    );
    const unrestricted = environmentSupplies(plan, gated);
    expect(unrestricted.find((row) => row.name === "Desk light")?.locked).toBe(
      true,
    );
    const locked = environmentSupplies(plan, gated, { "Bubbly Basin": 3 });
    expect(locked.find((row) => row.name === "Desk light")).toMatchObject({
      name: "Desk light",
      locked: true,
      envRequirement: { area: "Bubbly Basin", level: 10 },
    });
    expect(
      environmentSupplies(plan, gated, { "Bubbly Basin": 10 }).find(
        (row) => row.name === "Desk light",
      )?.locked,
    ).toBe(false);
  });
  it("does not report a shared environment for a mixed-environment home", () => {
    const plan = recommendHousemates(
      { roster: ["a", "c"], sourceRoster: ["a", "c"], areaFilter: null },
      withEnvItems,
      now,
    );
    const merged = moveResident(plan, plan.homes[1].id, plan.homes[0].id, "c", withEnvItems);
    expect(homeEnvironment(merged.homes[0], withEnvItems)).toBeNull();
  });
  it("splits a mixed-environment home into one home per environment", () => {
    const plan = recommendHousemates(
      { roster: ["a", "c"], sourceRoster: ["a", "c"], areaFilter: null },
      withEnvItems,
      now,
    );
    const merged = moveResident(plan, plan.homes[1].id, plan.homes[0].id, "c", withEnvItems);
    const split = splitHomeByEnvironment(merged, merged.homes[0].id, withEnvItems);
    expect(split.homes.map((h) => h.residents).sort()).toEqual([["a"], ["c"]]);
  });
  it("adds an empty manual home that is pruned once emptied again", () => {
    const plan = recommendHousemates(
      { roster: ["a"], sourceRoster: ["a"], areaFilter: null },
      catalog,
      now,
    );
    const withEmpty = addHome(plan, "home", catalog);
    const added = withEmpty.homes.find((h) => !h.residents.length)!;
    expect(added).toBeTruthy();
    const filled = moveResident(withEmpty, plan.homes[0].id, added.id, "a", catalog);
    expect(filled.homes.find((h) => h.id === plan.homes[0].id)).toBeUndefined();
    const emptiedAgain = moveResident(filled, added.id, "new", "a", catalog);
    expect(emptiedAgain.homes.some((h) => h.id === added.id)).toBe(false);
  });
});

describe("home built and moved-in marks", () => {
  const makePlan = () => {
    const plan = recommendHousemates(
      { roster: ["a", "b", "c", "d"], sourceRoster: ["a", "b", "c", "d"], areaFilter: null },
      catalog,
    );
    return {
      ...plan,
      homes: plan.homes.map((home) => ({ ...home, completed: true })),
    };
  };
  it("saves and restores marks while accepting older homes without marks", async () => {
    const state = { ...emptyState(), housematePlan: makePlan() };
    const restored = validateBackup(JSON.parse(JSON.stringify(state)), catalog);
    await writeState(restored);
    expect(
      (await readState()).housematePlan?.homes.every((home) => home.completed),
    ).toBe(true);
    expect(
      validateBackup(
        {
          ...state,
          housematePlan: recommendHousemates(
            { roster: ["a"], sourceRoster: ["a"], areaFilter: null },
            catalog,
          ),
        },
        catalog,
      ).housematePlan?.homes[0].completed,
    ).toBeUndefined();
  });
  it("clears both affected homes after a move and preserves unrelated homes", () => {
    const plan = makePlan();
    const moved = moveResident(plan, "home-1", "home-2", "b", catalog);
    expect(moved.homes.map((home) => home.completed)).toEqual([
      false,
      false,
      true,
    ]);
    expect(plan.homes.every((home) => home.completed)).toBe(true);
  });
  it("clears the source after moving to a new group or splitting", () => {
    for (const result of [
      moveResident(makePlan(), "home-1", "new", "b", catalog),
      splitResident(makePlan(), "home-1", "b", catalog),
    ]) {
      expect(result.homes.find((home) => home.id === "home-1")?.completed).toBe(
        false,
      );
      expect(
        result.homes.find(
          (home) => home.residents.length === 1 && home.residents[0] === "b",
        )?.completed,
      ).toBeFalsy();
      expect(result.homes.find((home) => home.id === "home-2")?.completed).toBe(
        true,
      );
    }
  });
  it("clears both swapped groups", () => {
    expect(
      swapHousemates(
        makePlan(),
        "home-1",
        "home-2",
        "b",
        "c",
        catalog,
      ).homes.map((home) => home.completed),
    ).toEqual([false, false, true]);
  });
  it("clears a changed kit but preserves a no-op kit selection", () => {
    const plan = makePlan();
    expect(
      changeHomeKit(plan, "home-1", "home", catalog).homes[0].completed,
    ).toBe(true);
    const changed = changeHomeKit(plan, "home-1", "other", {
      ...catalog,
      kits: [...catalog.kits, { ...kit, id: "other" }],
    });
    expect(changed.homes.map((home) => home.completed)).toEqual([
      false,
      true,
      true,
    ]);
  });
  it("allows checking and unchecking but rejects empty homes and malformed marks", () => {
    const plan = makePlan();
    expect(setHomeCompleted(plan, "home-1", false).homes[0].completed).toBe(
      false,
    );
    expect(setHomeCompleted(plan, "home-1", true).homes[0].completed).toBe(
      true,
    );
    const empty = addHome(plan, "home", catalog);
    expect(() => setHomeCompleted(empty, empty.homes.at(-1)!.id, true)).toThrow(
      "Add residents",
    );
    const invalid = JSON.parse(
      JSON.stringify({ ...emptyState(), housematePlan: plan }),
    );
    invalid.housematePlan.homes[0].completed = "yes";
    expect(() => validateBackup(invalid, catalog)).toThrow("completion mark");
  });
  it("clears a completed destination when an unresolved resident joins", () => {
    const plan = makePlan();
    plan.homes = plan.homes.filter((home) => home.id !== "home-3");
    plan.unresolved = [{ id: "d", reason: "Needs a home" }];
    expect(
      moveResident(plan, "unresolved", "home-2", "d", catalog).homes[1]
        .completed,
    ).toBe(false);
  });
});
