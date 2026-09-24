import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREPARED_PATH = join(ROOT, ".android-build/catalog.json");
const FINAL_PATH = join(ROOT, "dist-android/data/catalog.json");
const mode = process.argv[2];

const removedKeys = new Set([
  "additionalSources",
  "checkedDate",
  "contentSource",
  "evidence",
  "extraction",
  "iconUrl",
  "locator",
  "provider",
  "retrievedAt",
  "sourceRevision",
  "sourceUrl",
  "sources",
]);

function localFilename(value) {
  return value.split(/[/?#]/).filter(Boolean).pop() || "";
}

function stripProvenance(value, path = []) {
  if (Array.isArray(value))
    return value.map((entry, index) =>
      stripProvenance(entry, [...path, index]),
    );
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (removedKeys.has(key)) continue;
    if (key === "source") {
      output.source = "";
      continue;
    }
    if (
      key === "image" &&
      typeof entry === "string" &&
      /^https?:\/\//i.test(entry)
    ) {
      const pokemonIndex = path[0] === "pokemon" && typeof path[1] === "number";
      const isPokemonRecord = pokemonIndex && path.length === 2;
      output.image = isPokemonRecord
        ? value.nationalNumber == null
          ? null
          : `/images/pokemon/${value.nationalNumber}.png`
        : `/images/habitats/${localFilename(entry)}`;
      continue;
    }
    output[key] = stripProvenance(entry, [...path, key]);
  }
  return output;
}

function findRemoteStrings(value, path = [], matches = []) {
  if (typeof value === "string" && /^https?:\/\//i.test(value))
    matches.push(path.join("."));
  else if (Array.isArray(value))
    value.forEach((entry, index) =>
      findRemoteStrings(entry, [...path, index], matches),
    );
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([key, entry]) =>
      findRemoteStrings(entry, [...path, key], matches),
    );
  return matches;
}

async function prepare() {
  const canonical = JSON.parse(
    await readFile(join(ROOT, "public/data/catalog.json"), "utf8"),
  );
  const runtime = stripProvenance(canonical);
  runtime.sources = [];
  const remoteStrings = findRemoteStrings(runtime);
  if (remoteStrings.length)
    throw new Error(
      `Android runtime catalog still contains remote strings at: ${remoteStrings.slice(0, 12).join(", ")}`,
    );
  await mkdir(dirname(PREPARED_PATH), { recursive: true });
  await writeFile(PREPARED_PATH, `${JSON.stringify(runtime)}\n`);
  console.log(
    JSON.stringify(
      {
        mode: "prepare",
        output: ".android-build/catalog.json",
        catalogVersion: runtime.version,
        pokemon: runtime.pokemon.length,
        kits: runtime.kits.length,
        items: runtime.items.length,
        remoteStrings: remoteStrings.length,
      },
      null,
      2,
    ),
  );
}

async function finalize() {
  await mkdir(dirname(FINAL_PATH), { recursive: true });
  await writeFile(FINAL_PATH, await readFile(PREPARED_PATH));
  await cp(
    join(ROOT, ".android-build/tesseract"),
    join(ROOT, "dist-android/tesseract"),
    { recursive: true },
  );
  await rm(join(ROOT, "dist-android/images/manifest.json"), { force: true });
  await rm(join(ROOT, "dist-android/_redirects"), { force: true });
  console.log(
    JSON.stringify(
      {
        mode: "finalize",
        output: "dist-android/data/catalog.json",
        removed: [
          "dist-android/images/manifest.json",
          "dist-android/_redirects",
        ],
        copied: ["dist-android/tesseract"],
      },
      null,
      2,
    ),
  );
}

if (mode === "prepare") await prepare();
else if (mode === "finalize") await finalize();
else
  throw new Error(
    "Usage: node scripts/build-android-catalog.mjs <prepare|finalize>",
  );
