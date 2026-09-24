import { describe, it, expect } from "vitest";
import type { Catalog, Habitat, Item, Pokemon } from "../src/catalog/types";
import {
  buildHabitatIndex,
  getCanonicalHabitat,
} from "../src/habitats/catalog";
import {
  filterHabitats,
  filtersFromQuery,
  filtersToQuery,
  habitatDexNumber,
} from "../src/habitats/search";
import { defaultHabitatFilters } from "../src/habitats/types";
import type { HabitatLocationRecord } from "../src/habitats/types";
import {
  addQuickSaveLocation,
  createLocation,
  hasLocationInRegion,
  locationsForHabitat,
  orderedRegionOptions,
  savedLocationCount,
  updateLocation,
} from "../src/habitats/locations";
import { migrateHabitatLocations } from "../src/habitats/migration";
import type { LegacyHabitatBuildRecord } from "../src/persistence/legacy";
import { validateBackup, emptyState, type SaveState } from "../src/persistence/store";

const habitatA: Habitat = {
  id: "garden",
  name: "Garden",
  image: null,
  source: "https://example.com/garden",
  requirements: ["10 × Glass", "1 × High-up Location"],
  areas: ["Beach"],
  rarity: "Common",
  times: ["Day"],
  weather: ["Sun"],
};

const habitatShared: Habitat = {
  ...habitatA,
  id: "tallgrass",
  name: "Tall Grass",
  requirements: ["5 × Glass"],
  areas: ["Ridges"],
};

const pokemon = (id: string, habitats: Habitat[]): Pokemon => ({
  id,
  name: id,
  number: "001",
  nationalNumber: 1,
  dex: "regular",
  image: null,
  types: ["Grass"],
  specialties: ["Grow"],
  environment: "Bright",
  favorites: ["Nature"],
  food: null,
  habitats,
  areas: ["Beach"],
  times: ["Day"],
  weather: ["Sun"],
  height: null,
  weight: null,
  forms: [],
  source: "https://example.com",
  partial: false,
});

const items: Item[] = [
  { id: "glass", name: "Glass", categories: [], source: "https://example.com" },
];

const catalog: Catalog = {
  version: "test",
  pokemon: [
    pokemon("a", [habitatShared]),
    pokemon("b", [{ ...habitatShared, areas: ["Beach"], times: ["Night"] }]),
    pokemon("c", [habitatA]),
  ],
  kits: [],
  items,
  areas: ["Beach", "Ridges"],
  sources: [],
};

/** A legacy (unmigrated) SaveState: no habitatLocations, no migration marker. */
function legacyState(overrides: Partial<SaveState>): SaveState {
  const base = emptyState();
  const { habitatLocationMigrationVersion: _v, habitatLocations: _l, ...rest } =
    base;
  return { ...rest, ...overrides } as SaveState;
}

function legacyBuild(
  overrides: Partial<LegacyHabitatBuildRecord> & {
    id: string;
    habitatId: string;
  },
): LegacyHabitatBuildRecord {
  return {
    status: "built",
    region: "Beach",
    copies: 1,
    locationNote: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    snapshot: {
      habitatName: "Garden",
      source: "https://example.com/garden",
      catalogVersion: "test",
      requirements: [],
    },
    allocations: [],
    ...overrides,
  };
}

describe("habitat catalog", () => {
  it("merges shared habitat ids into one card with distinct associations", () => {
    const canonical = getCanonicalHabitat(catalog, "tallgrass");
    expect(canonical?.possiblePokemonCount).toBe(2);
    expect(canonical?.associations).toHaveLength(2);
    expect(canonical?.associations.map((a) => a.areas)).toEqual([
      ["Ridges"],
      ["Beach"],
    ]);
  });

  it("counts distinct pokemon for possible counts", () => {
    const index = buildHabitatIndex(catalog);
    expect(index.get("garden")?.possiblePokemonCount).toBe(1);
  });
});

describe("habitat catalog sort", () => {
  const numbered = (id: string, name: string, n: number): Habitat => ({
    ...habitatA,
    id,
    name,
    image: `https://www.serebii.net/pokemonpokopia/habitatdex/${n}.png`,
  });
  const sortCatalog: Catalog = {
    ...catalog,
    pokemon: [
      pokemon("a", [numbered("benchwithgreenery", "Bench with greenery", 22)]),
      pokemon("b", [numbered("tallgrass", "Tall Grass", 1)]),
      pokemon("c", [{ ...habitatA, id: "basintallgrass", name: "Basin tall grass" }]),
    ],
  };

  it("reads Serebii habitat numbers from image filenames", () => {
    expect(
      habitatDexNumber(
        "https://www.serebii.net/pokemonpokopia/habitatdex/22.png",
      ),
    ).toBe(22);
    expect(habitatDexNumber(null)).toBeNull();
  });

  it("defaults to habitat ID order and puts unnumbered habitats last", () => {
    const results = filterHabitats(sortCatalog, {}, {}, defaultHabitatFilters());
    expect(results.map((h) => h.id)).toEqual([
      "tallgrass",
      "benchwithgreenery",
      "basintallgrass",
    ]);
  });

  it("omits the default ID sort from the catalog query", () => {
    expect(filtersToQuery(defaultHabitatFilters())).toBe("");
    expect(filtersFromQuery("").sort).toBe("id");
    expect(filtersFromQuery("sort=name").sort).toBe("name");
  });
});

describe("habitat catalog scope filtering", () => {
  it("lists a habitat under Saved here / All regions once it has any saved location", () => {
    const loc = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const locations = { [loc.id]: loc };
    expect(
      filterHabitats(catalog, locations, {}, {
        ...defaultHabitatFilters(),
        scope: "saved",
      }).map((h) => h.id),
    ).toEqual(["garden"]);
    expect(
      filterHabitats(catalog, {}, {}, {
        ...defaultHabitatFilters(),
        scope: "saved",
      }),
    ).toEqual([]);
  });

  it("filters Saved here by the location's own region, not catalog discovery regions", () => {
    const loc = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const locations = { [loc.id]: loc };
    expect(
      filterHabitats(catalog, locations, {}, {
        ...defaultHabitatFilters(),
        scope: "saved",
        region: "Beach",
      }).map((h) => h.id),
    ).toEqual(["garden"]);
    expect(
      filterHabitats(catalog, locations, {}, {
        ...defaultHabitatFilters(),
        scope: "saved",
        region: "Ridges",
      }),
    ).toEqual([]);
  });

  it("Region not recorded means a catalog gap under Available here, and a null-region location under Saved here", () => {
    const flagged: HabitatLocationRecord = {
      ...createLocation({ id: "garden", name: "Garden" }, "Beach"),
      region: null,
      reviewFlags: ["Choose a region"],
    };
    const locations = { [flagged.id]: flagged };
    expect(
      filterHabitats(catalog, {}, {}, {
        ...defaultHabitatFilters(),
        scope: "available",
        region: "__none__",
      }),
    ).toEqual([]);
    expect(
      filterHabitats(catalog, locations, {}, {
        ...defaultHabitatFilters(),
        scope: "saved",
        region: "__none__",
      }).map((h) => h.id),
    ).toEqual(["garden"]);
  });

  it("parses the old regionMode=builds query as Saved here and ignores old status query values", () => {
    expect(filtersFromQuery("regionMode=builds").scope).toBe("saved");
    expect(filtersFromQuery("status=built").scope).toBe("available");
    expect(
      filtersToQuery({ ...defaultHabitatFilters(), scope: "saved" }),
    ).toBe("scope=saved");
  });
});

describe("habitat location records", () => {
  it("creates a quick-save location with a stable id, count 1 and a blank note", () => {
    const record = createLocation({ id: "garden", name: "Garden" }, "Beach");
    expect(record.region).toBe("Beach");
    expect(record.copies).toBe(1);
    expect(record.note).toBe("");
    expect(record.habitatNameSnapshot).toBe("Garden");
    expect(record.id).toBeTruthy();
  });

  it("guards a quick save against creating a duplicate for the same habitat and region", () => {
    const first = addQuickSaveLocation({}, { id: "garden", name: "Garden" }, "Beach")!;
    expect(first).toBeTruthy();
    const second = addQuickSaveLocation(
      first.locations,
      { id: "garden", name: "Garden" },
      "Beach",
    );
    expect(second).toBeNull();
    expect(hasLocationInRegion(first.locations, "garden", "Beach")).toBe(true);
  });

  it("allows an explicit second location in the same region", () => {
    const first = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const second = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const locations = { [first.id]: first, [second.id]: second };
    expect(locationsForHabitat(locations, "garden")).toHaveLength(2);
  });

  it("writes region/note/count edits once on Save while preserving id and createdAt", () => {
    const record = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const updated = updateLocation(record, {
      region: "Ridges",
      note: "  by the well  ",
      copies: 3,
    });
    expect(updated.id).toBe(record.id);
    expect(updated.createdAt).toBe(record.createdAt);
    expect(updated.region).toBe("Ridges");
    expect(updated.note).toBe("by the well");
    expect(updated.copies).toBe(3);
  });

  it("clears the Choose a region flag once a region is assigned, and Possible duplicate on any save", () => {
    const record: HabitatLocationRecord = {
      ...createLocation({ id: "garden", name: "Garden" }, "Beach"),
      region: null,
      reviewFlags: ["Choose a region", "Possible duplicate"],
    };
    const updated = updateLocation(record, { region: "Beach" });
    expect(updated.reviewFlags).toBeUndefined();
  });

  it("orders the region picker with the habitat's discovery towns first, each group alphabetical", () => {
    expect(
      orderedRegionOptions(["Ridges", "Beach", "Basin"], ["Beach"]),
    ).toEqual(["Beach", "Basin", "Ridges"]);
  });

  it("counts saved locations per habitat as rows, not summed copies", () => {
    const a = createLocation({ id: "garden", name: "Garden" }, "Beach", 5);
    const locations = { [a.id]: a };
    expect(savedLocationCount(locations, "garden")).toBe(1);
    expect(savedLocationCount(locations, "tallgrass")).toBe(0);
  });
});

describe("habitat location migration", () => {
  it("is a no-op once the migration marker is set", () => {
    const state = emptyState();
    expect(migrateHabitatLocations(state, catalog)).toBe(state);
  });

  it("converts a built record into a location and preserves user-entered fields", () => {
    const build = legacyBuild({
      id: "build-1",
      habitatId: "garden",
      region: "Beach",
      copies: 2,
      locationNote: " behind the shop ",
    });
    const state = legacyState({ habitatBuilds: { [build.id]: build } });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatBuilds).toBeUndefined();
    expect(migrated.habitatLocationMigrationVersion).toBe(1);
    expect(migrated.habitatLocations!["build-1"]).toMatchObject({
      id: "build-1",
      habitatId: "garden",
      region: "Beach",
      copies: 2,
      note: "behind the shop",
    });
    expect(migrated.habitatBuildLegacySnapshot!["build-1"]).toEqual(build);
  });

  it("archives a planned record without turning it into a location", () => {
    const build = legacyBuild({
      id: "build-2",
      habitatId: "garden",
      status: "planned",
    });
    const state = legacyState({ habitatBuilds: { [build.id]: build } });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations).toEqual({});
    expect(migrated.habitatBuildLegacySnapshot!["build-2"]).toEqual(build);
  });

  it("flags a regionless or no-longer-catalogued region as Choose a region", () => {
    const regionless = legacyBuild({
      id: "build-3",
      habitatId: "garden",
      region: null,
    });
    const stale = legacyBuild({
      id: "build-4",
      habitatId: "garden",
      region: "Nowhere",
    });
    const state = legacyState({
      habitatBuilds: { [regionless.id]: regionless, [stale.id]: stale },
    });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations!["build-3"].region).toBeNull();
    expect(migrated.habitatLocations!["build-3"].reviewFlags).toContain(
      "Choose a region",
    );
    expect(migrated.habitatLocations!["build-4"].region).toBeNull();
    expect(migrated.habitatLocations!["build-4"].reviewFlags).toContain(
      "Choose a region",
    );
  });

  it("flags an orphaned habitat id instead of dropping the record", () => {
    const orphan = legacyBuild({ id: "build-5", habitatId: "ghost-habitat" });
    const state = legacyState({ habitatBuilds: { [orphan.id]: orphan } });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations!["build-5"].reviewFlags).toContain(
      "Habitat missing from catalog",
    );
  });

  it("maps Review imported copies to Possible duplicate and drops Needs review", () => {
    const dup = legacyBuild({
      id: "build-6",
      habitatId: "garden",
      reviewFlags: ["Review imported copies", "Needs review"],
    });
    const state = legacyState({ habitatBuilds: { [dup.id]: dup } });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations!["build-6"].reviewFlags).toEqual([
      "Possible duplicate",
    ]);
  });

  it("does not merge separate built records sharing a habitat, region and note", () => {
    const a = legacyBuild({ id: "build-7", habitatId: "garden", region: "Beach" });
    const b = legacyBuild({ id: "build-8", habitatId: "garden", region: "Beach" });
    const state = legacyState({ habitatBuilds: { [a.id]: a, [b.id]: b } });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(Object.keys(migrated.habitatLocations!)).toHaveLength(2);
  });

  it("keeps an existing location and skips a converted one sharing its id", () => {
    const build = legacyBuild({
      id: "shared-id",
      habitatId: "garden",
      region: "Beach",
    });
    const existing = {
      ...createLocation({ id: "garden", name: "Garden" }, "Ridges"),
      id: "shared-id",
    };
    const state = legacyState({
      habitatBuilds: { [build.id]: build },
      habitatLocations: { "shared-id": existing },
    });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations!["shared-id"].region).toBe("Ridges");
  });

  it("does not generate locations from legacy boolean checklists", () => {
    const state = legacyState({
      shoppingChecklists: {
        habitats: {
          x: {
            id: "x",
            pokemonId: "a",
            habitatId: "garden",
            habitatName: "Garden",
            rows: [],
          },
        },
      },
    });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.habitatLocations).toEqual({});
    expect(migrated.shoppingChecklists).toEqual(state.shoppingChecklists);
  });

  it("moves houseShopping into a legacy snapshot verbatim", () => {
    const houseShopping = {
      planId: "p",
      construction: [],
      furnishings: [],
      environment: [],
    };
    const state = legacyState({ houseShopping });
    const migrated = migrateHabitatLocations(state, catalog);
    expect(migrated.houseShopping).toBeUndefined();
    expect(migrated.houseShoppingLegacySnapshot).toEqual(houseShopping);
  });

  it("does not duplicate or modify locations on a second run", () => {
    const build = legacyBuild({ id: "build-9", habitatId: "garden" });
    const state = legacyState({ habitatBuilds: { [build.id]: build } });
    const once = migrateHabitatLocations(state, catalog);
    const twice = migrateHabitatLocations(once, catalog);
    expect(twice).toBe(once);
  });
});

describe("habitat location backups", () => {
  it("round-trips habitat locations in backups", () => {
    const record = createLocation({ id: "garden", name: "Garden" }, "Beach");
    const data = { ...emptyState(), habitatLocations: { [record.id]: record } };
    expect(validateBackup(JSON.parse(JSON.stringify(data)), catalog)).toEqual(
      data,
    );
  });

  it("migrates a legacy backup on import, matching what a reload would produce", () => {
    const build = legacyBuild({ id: "build-1", habitatId: "garden" });
    const legacy = legacyState({ habitatBuilds: { [build.id]: build } });
    const result = validateBackup(JSON.parse(JSON.stringify(legacy)), catalog);
    expect(Object.keys(result.habitatLocations!)).toHaveLength(1);
    expect(result.habitatBuilds).toBeUndefined();
    expect(result.habitatBuildLegacySnapshot!["build-1"]).toBeTruthy();
  });

  it("allows an unknown habitatId on import and flags it instead of rejecting", () => {
    const record = createLocation({ id: "ghost-habitat", name: "Ghost" }, "Beach");
    const data = { ...emptyState(), habitatLocations: { [record.id]: record } };
    const result = validateBackup(JSON.parse(JSON.stringify(data)), catalog);
    expect(result.habitatLocations![record.id].reviewFlags).toContain(
      "Habitat missing from catalog",
    );
  });

  it("rejects a location whose region is neither a catalog area nor a flagged null", () => {
    const bad = {
      ...createLocation({ id: "garden", name: "Garden" }, "Beach"),
      region: "Nowhere",
    };
    const data = { ...emptyState(), habitatLocations: { [bad.id]: bad } };
    expect(() =>
      validateBackup(JSON.parse(JSON.stringify(data)), catalog),
    ).toThrow();
  });

  it("accepts a null region only when the record carries Choose a region", () => {
    const bad = {
      ...createLocation({ id: "garden", name: "Garden" }, "Beach"),
      region: null,
    };
    const data = { ...emptyState(), habitatLocations: { [bad.id]: bad } };
    expect(() =>
      validateBackup(JSON.parse(JSON.stringify(data)), catalog),
    ).toThrow();
    const flagged = { ...bad, reviewFlags: ["Choose a region"] as const };
    expect(() =>
      validateBackup(
        JSON.parse(
          JSON.stringify({
            ...emptyState(),
            habitatLocations: { [flagged.id]: flagged },
          }),
        ),
        catalog,
      ),
    ).not.toThrow();
  });
});

describe("copy counts", () => {
  it("treats a cleared copies field as empty instead of 1", async () => {
    const { parseCopyCount } = await import("../src/habitats/LocationForm");
    expect(parseCopyCount("")).toBeNull();
    expect(parseCopyCount(" ")).toBeNull();
    expect(parseCopyCount("1")).toBe(1);
    expect(parseCopyCount("12")).toBe(12);
    expect(parseCopyCount("0")).toBeNull();
    expect(parseCopyCount("1.5")).toBeNull();
  });
});
