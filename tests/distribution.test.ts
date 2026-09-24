import { describe, expect, it } from "vitest";
import {
  distribution,
  isAndroidDistribution,
  isWebDistribution,
  parseDistribution,
} from "../src/platform/distribution";

describe("distribution contract", () => {
  it("accepts only known distribution values", () => {
    expect(parseDistribution("web")).toBe("web");
    expect(parseDistribution("android")).toBe("android");
    expect(() => parseDistribution("desktop")).toThrow(
      /Unsupported VITE_DISTRIBUTION/,
    );
    expect(() => parseDistribution(undefined)).toThrow(
      /Unsupported VITE_DISTRIBUTION/,
    );
  });

  it("uses the web distribution in the default test environment", () => {
    expect(distribution).toBe("web");
    expect(isWebDistribution()).toBe(true);
    expect(isAndroidDistribution()).toBe(false);
  });
});
