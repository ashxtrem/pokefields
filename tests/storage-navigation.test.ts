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
  hasPokemon: () => false,
  hasHabitat: () => false,
  hasChest: (id: string) => id === "chest:1",
};

beforeEach(() => {
  resetNavigationMemory();
});

describe("storage route parsing", () => {
  it("parses the storage list, new-chest, and chest-detail routes", () => {
    expect(parseRoute("#/storage")).toEqual({ page: "storage", query: "" });
    expect(parseRoute("#/storage/new")).toEqual({ page: "storage-new", query: "" });
    expect(parseRoute("#/storage/chest%3A1")).toEqual({
      page: "storage-chest",
      chestId: "chest:1",
      query: "",
    });
  });

  it("keeps query parameters on the storage list route (e.g. a search prefill)", () => {
    expect(parseRoute("#/storage?q=nugget")).toEqual({ page: "storage", query: "q=nugget" });
  });

  it("groups every storage page under the storage nav section", () => {
    expect(navSection("#/storage")).toBe("storage");
    expect(navSection("#/storage/new")).toBe("storage");
    expect(navSection("#/storage/chest:1")).toBe("storage");
  });
});

describe("storage route resumption", () => {
  it("resumes the last visited chest after visiting other sections", () => {
    rememberSectionRoute("#/storage/chest:1");
    rememberSectionRoute("#/dex");
    expect(sectionHref("storage", always)).toBe("#/storage/chest:1");
    expect(lastSectionRoute("storage")).toBe("#/storage/chest:1");
  });

  it("falls back to the storage list when a remembered chest is gone", () => {
    rememberSectionRoute("#/storage/chest:deleted");
    const available = (route: string) => isRememberedRouteAvailable(route, catalog);
    expect(sectionHref("storage", available)).toBe("#/storage");
  });

  it("keeps a remembered chest route when it still exists", () => {
    rememberSectionRoute("#/storage/chest:1");
    const available = (route: string) => isRememberedRouteAvailable(route, catalog);
    expect(sectionHref("storage", available)).toBe("#/storage/chest:1");
  });
});
