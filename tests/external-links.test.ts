import { describe, expect, it } from "vitest";
import { PRIVACY_POLICY_URL } from "../src/platform/externalLinks";

describe("public application links", () => {
  it("uses the canonical Cloudflare Pages privacy policy", () => {
    expect(PRIVACY_POLICY_URL).toBe(
      "https://pokefields-privacy.pages.dev/privacy",
    );
  });
});
