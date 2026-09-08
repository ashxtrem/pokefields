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
  combinedSupplies,
  convertSpatialPlan,
  explainGroup,
  moveResident,
  recommendHousemates,
  splitResident,
  suggestHomeKit,
  swapHousemates,
  uniqueFoundRoster,
} from "../src/planner/recommend";
import { defaultFilters, filterPokemon } from "../src/dex/search";
import {
  emptyState,
  validateBackup,
  readState,
  writeState,
} from "../src/persistence/store";
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
  it("accepts an exported notebook", () => {
    const data = saved();
    expect(validateBackup(JSON.parse(JSON.stringify(data)), catalog)).toEqual(
      data,
    );
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
    expect(
      explainGroup([p("a", "Bright"), p("e", null)]).match,
    ).toBe("unknown");
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
    expect(validateBackup(legacy, catalog)).toEqual(legacy);
  });
  it("rejects a housemate plan that drops residents", () => {
    const a = notebook();
    a.housematePlan!.homes = [];
    expect(() => validateBackup(a, catalog)).toThrow();
  });
});
