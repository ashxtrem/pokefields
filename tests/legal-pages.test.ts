import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPublicFile = (name: string) =>
  readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

describe("public legal and support pages", () => {
  const privacy = readPublicFile("privacy.html");
  const support = readPublicFile("support.html");
  const redirects = readPublicFile("_redirects");
  const offlineBuild = readFileSync(
    new URL("../scripts/build-offline.mjs", import.meta.url),
    "utf8",
  );
  const legalBuild = readFileSync(
    new URL("../scripts/build-legal-site.mjs", import.meta.url),
    "utf8",
  );

  it("publishes an app-specific privacy policy and contact", () => {
    expect(privacy).toContain("Privacy policy · pokefields");
    expect(privacy).toContain("AT.CodePathi");
    expect(privacy).toContain("ashxtrem+pokefields@gmail.com");
    expect(privacy).toContain("Retention, deletion, and security");
    expect(privacy).toContain("Android automatic cloud backup is disabled");
    expect(privacy).not.toContain(
      "must be verified against the release bundle",
    );
    expect(privacy).not.toContain("final Play target-audience declaration");
  });

  it("publishes support and recovery guidance", () => {
    expect(support).toContain("Support · pokefields");
    expect(support).toContain("Back up first");
    expect(support).toContain("ashxtrem+pokefields@gmail.com");
  });

  it("keeps the non-affiliation notice on both public pages", () => {
    for (const page of [privacy, support]) {
      expect(page).toContain("unofficial fan-made companion");
      expect(page).toContain("The Pokémon Company");
    }
  });

  it("leaves directory-index legal routes to Cloudflare Pages", () => {
    expect(redirects.trim().split("\n")).toEqual(["/* /index.html 200"]);
  });

  it("keeps legal routes out of the offline app-shell navigation fallback", () => {
    expect(offlineBuild).toContain(
      'const legalRoutes = ["/privacy/", "/support/"]',
    );
    expect(offlineBuild).toContain("request.mode==='navigate'&&legalPath");
    expect(offlineBuild).toContain("cache.match(legalPath)");
  });

  it("builds a dedicated legal site without an app service worker", () => {
    expect(legalBuild).toContain('const output = "dist-legal"');
    expect(legalBuild).toContain('routes: ["/privacy", "/support"]');
    expect(legalBuild).toContain("serviceWorker: false");
    expect(legalBuild).not.toContain('copyFile("dist/sw.js"');
  });
});
