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
import {
  buildBadges,
  createPlannedBuild,
  createBuiltRecord,
  recordsForHabitat,
  setAllocationGathered,
  splitPartialBuilt,
} from "../src/habitats/builds";
import { migrateLegacyShopping } from "../src/habitats/migration";
import {
  combinedHabitatShopping,
  redistributeCombinedGathered,
  resetHabitatGathered,
} from "../src/shopping/allocations";
import {
  habitatChecklist,
  toggleRow,
  reconcileHouseChecklist,
  migrateHouseChecklist,
  resetHouseGathered,
  setHouseRowGathered,
} from "../src/shopping/checklists";
import { recommendHousemates } from "../src/planner/recommend";
import { validateBackup, emptyState } from "../src/persistence/store";

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

describe("build records and shopping quantities", () => {
  it("tracks partial gathered amounts", () => {
    const build = createPlannedBuild(catalog, "garden", "Beach", 1);
    const rowId = build.allocations[0].requirementId;
    const updated = setAllocationGathered(build, rowId, 5);
    expect(updated.allocations[0].gathered).toBe(5);
    expect(
      updated.allocations[0].required - updated.allocations[0].gathered,
    ).toBe(5);
  });

  it("allocates combined gathered totals to oldest plans first", () => {
    const a = createPlannedBuild(catalog, "garden", "Beach", 1);
    const b = createPlannedBuild(catalog, "tallgrass", "Ridges", 1);
    const builds = { [a.id]: a, [b.id]: b };
    const key = combinedHabitatShopping(builds)[0]?.key;
    expect(key).toBeTruthy();
    const next = redistributeCombinedGathered(builds, key!, 5);
    const rows = combinedHabitatShopping(next);
    expect(rows[0].gathered).toBe(5);
    expect(rows[0].contributions[0].gathered).toBe(5);
    expect(rows[0].contributions[1]?.gathered || 0).toBe(0);
  });

  it("resets all habitat gathered quantities, or only a selected plan", () => {
    const first = createPlannedBuild(catalog, "garden", "Beach", 1);
    const second = createPlannedBuild(catalog, "tallgrass", "Ridges", 1);
    const withA = setAllocationGathered(
      first,
      first.allocations[0].requirementId,
      5,
    );
    const withB = setAllocationGathered(
      second,
      second.allocations[0].requirementId,
      3,
    );
    const builds = { [withA.id]: withA, [withB.id]: withB };
    const all = resetHabitatGathered(builds);
    expect(
      combinedHabitatShopping(all).every((row) => row.gathered === 0),
    ).toBe(true);
    const one = resetHabitatGathered(builds, [withA.id]);
    expect(one[withA.id].allocations.every((row) => row.gathered === 0)).toBe(
      true,
    );
    expect(one[withB.id].allocations[0].gathered).toBe(3);
  });

  it("shows mixed badges from independent regions", () => {
    const built = createBuiltRecord(catalog, "garden", "Beach", 2);
    const planned = createPlannedBuild(catalog, "garden", "Ridges", 1);
    const badge = buildBadges([built, planned]);
    expect(badge).toEqual({ built: 2, planned: 1 });
  });

  it("records built without inventing material progress", () => {
    const built = createBuiltRecord(catalog, "garden", "Beach", 1);
    expect(built.allocations).toEqual([]);
    expect(built.status).toBe("built");
  });

  it("splits partial completion into built and remaining planned copies", () => {
    const planned = createPlannedBuild(catalog, "garden", "Beach", 3);
    const withGathered = setAllocationGathered(
      planned,
      planned.allocations[0].requirementId,
      15,
    );
    const { built, remaining } = splitPartialBuilt(withGathered, 1);
    expect(built.copies).toBe(1);
    expect(remaining?.copies).toBe(2);
  });
});

describe("legacy migration", () => {
  it("migrates checkbox lists once and preserves ambiguous duplicates", () => {
    const listA = habitatChecklist("c", habitatA, items);
    listA.rows = toggleRow(listA.rows, listA.rows[0].id);
    const listB = habitatChecklist("a", habitatA, items);
    const legacy = {
      habitats: {
        [listA.id]: listA,
        [listB.id]: listB,
      },
    };
    const first = migrateLegacyShopping(catalog, legacy);
    const second = migrateLegacyShopping(catalog, legacy, first.builds);
    expect(Object.keys(first.builds)).toHaveLength(2);
    expect(Object.keys(second.builds)).toHaveLength(2);
    expect(
      Object.values(first.builds).some((r) =>
        r.reviewFlags?.includes("Review imported copies"),
      ),
    ).toBe(true);
  });

  it("round-trips habitat builds in backups", () => {
    const build = createPlannedBuild(catalog, "garden", "Beach", 1);
    const data = {
      ...emptyState(),
      habitatBuilds: { [build.id]: build },
    };
    expect(validateBackup(JSON.parse(JSON.stringify(data)), catalog)).toEqual(
      data,
    );
  });
});

describe("house quantity migration", () => {
  it("migrates boolean house rows to gathered quantities", () => {
    const withKit: Catalog = {
      ...catalog,
      kits: [
        {
          id: "home",
          name: "Home",
          width: 4,
          depth: 3,
          height: 3,
          capacity: 2,
          helpers: 1,
          specialties: [],
          materials: [{ name: "Glass", quantity: 3 }],
          buildTime: "1 day",
          source: "https://example.com",
        },
      ],
    };
    const plan = recommendHousemates(
      { roster: ["a"], sourceRoster: ["a"], areaFilter: null },
      withKit,
      () => "2026-09-09T00:00:00.000Z",
    );
    const legacy = reconcileHouseChecklist(undefined, plan, withKit);
    legacy.construction[0].checked = true;
    const migrated = migrateHouseChecklist(legacy, plan, withKit);
    expect(migrated.construction[0].gathered).toBe(
      migrated.construction[0].quantity,
    );
    const gathered = setHouseRowGathered(
      migrated,
      "construction",
      migrated.construction[0].id,
      migrated.construction[0].quantity,
    );
    const reset = resetHouseGathered(gathered);
    expect(reset.construction.every((row) => row.gathered === 0)).toBe(true);
    expect(reset.furnishings.every((row) => row.gathered === 0)).toBe(true);
  });
});

describe("gathering item identity", () => {
  it("keeps different items with the same required quantity separate", () => {
    const planned = createPlannedBuild(catalog, "garden", "Beach", 1);
    planned.allocations = [
      {
        requirementId: "a",
        signature: "item:lamp:1",
        raw: "1 lamp",
        label: "Lamp",
        kind: "item",
        required: 1,
        gathered: 0,
      },
      {
        requirementId: "b",
        signature: "item:bed:1",
        raw: "1 bed",
        label: "Bed",
        kind: "item",
        required: 1,
        gathered: 0,
      },
    ];
    const builds = { [planned.id]: planned };
    expect(combinedHabitatShopping(builds)).toHaveLength(2);
    const next = redistributeCombinedGathered(builds, "item:lamp", 1);
    expect(next[planned.id].allocations.map((row) => row.gathered)).toEqual([
      1, 0,
    ]);
  });
});

describe("copy counts", () => {
  it("treats a cleared copies field as empty instead of 1", async () => {
    const { parseCopyCount } = await import("../src/habitats/BuildForm");
    expect(parseCopyCount("")).toBeNull();
    expect(parseCopyCount(" ")).toBeNull();
    expect(parseCopyCount("1")).toBe(1);
    expect(parseCopyCount("12")).toBe(12);
    expect(parseCopyCount("0")).toBeNull();
    expect(parseCopyCount("1.5")).toBeNull();
  });
});
