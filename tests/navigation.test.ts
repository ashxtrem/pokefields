import { beforeEach, describe, expect, it } from "vitest";
import {
  isRememberedRouteAvailable,
  lastSectionRoute,
  navSection,
  parseRoute,
  rememberSectionRoute,
  resetNavigationMemory,
  sectionHref,
} from "../src/ui/navigation";

const always = () => true;
const catalog = {
  hasPokemon: (id: string) => id === "ivysaur",
  hasHabitat: (id: string) => id === "fieldofflowers",
};

beforeEach(() => {
  resetNavigationMemory();
});

describe("parseRoute and navSection", () => {
  it("groups Pokémon details with the Pokédex section", () => {
    expect(parseRoute("#/pokemon/ivysaur").page).toBe("pokemon");
    expect(navSection("#/pokemon/ivysaur")).toBe("dex");
  });

  it("groups habitat details with Habitats", () => {
    expect(parseRoute("#/habitats/fieldofflowers").page).toBe("habitat-detail");
    expect(navSection("#/habitats/fieldofflowers")).toBe("habitats");
  });

  it("keeps query parameters on remembered habitat routes", () => {
    expect(parseRoute("#/habitats?region=Beach")).toEqual({
      page: "habitats",
      query: "region=Beach",
    });
  });
});

describe("section resumption", () => {
  it("resumes the last Pokémon after visiting a habitat", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers");
    expect(sectionHref("dex", always)).toBe("#/pokemon/ivysaur");
    expect(sectionHref("habitats", always)).toBe("#/habitats/fieldofflowers");
  });

  it("lets an explicit list visit replace the section memory", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/dex");
    rememberSectionRoute("#/habitats/fieldofflowers");
    expect(sectionHref("dex", always)).toBe("#/dex");
    expect(sectionHref("habitats", always)).toBe("#/habitats/fieldofflowers");
  });

  it("falls back to the section list when a remembered entry is gone", () => {
    rememberSectionRoute("#/pokemon/missingno");
    rememberSectionRoute("#/habitats/unknown-glade");
    const available = (route: string) =>
      isRememberedRouteAvailable(route, catalog);
    expect(sectionHref("dex", available)).toBe("#/dex");
    expect(sectionHref("habitats", available)).toBe("#/habitats");
  });

  it("keeps chronological memory updates without replacing other sections", () => {
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers");
    rememberSectionRoute("#/planner");
    rememberSectionRoute("#/habitats");
    expect(lastSectionRoute("dex")).toBe("#/pokemon/ivysaur");
    expect(lastSectionRoute("habitats")).toBe("#/habitats");
    expect(lastSectionRoute("planner")).toBe("#/planner");
  });

  it("restores section routes after a session reload", () => {
    if (typeof sessionStorage === "undefined") return;
    rememberSectionRoute("#/pokemon/ivysaur");
    rememberSectionRoute("#/habitats/fieldofflowers?region=Beach");
    const stored = sessionStorage.getItem("pkm.nav.sections");
    expect(stored).toBeTruthy();
    resetNavigationMemory();
    sessionStorage.setItem("pkm.nav.sections", stored!);
    expect(lastSectionRoute("dex")).toBe("#/pokemon/ivysaur");
    expect(lastSectionRoute("habitats")).toBe(
      "#/habitats/fieldofflowers?region=Beach",
    );
  });
});
