import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_DIR = join(ROOT, ".release-private");
const REPORT_PATH = join(PRIVATE_DIR, "android-assets-report.json");
const MANIFEST_PATH = join(PRIVATE_DIR, "release-input-manifest.json");
const GENERATOR_VERSION = 1;

const catalog = JSON.parse(
  await readFile(join(ROOT, "public/data/catalog.json"), "utf8"),
);
const exceptions = JSON.parse(
  await readFile(join(ROOT, "config/android-asset-exceptions.json"), "utf8"),
);
const itemImageExceptions = exceptions.itemImageExceptions || {};
const expected = [];
const issues = [];

function add(group, path, options = {}) {
  expected.push({ group, path, image: false, ...options });
}

const nationalNumbers = [
  ...new Set(
    catalog.pokemon
      .map((pokemon) => pokemon.nationalNumber)
      .filter((number) => number != null),
  ),
];
for (const number of nationalNumbers) {
  add("pokemonArtwork", `public/images/pokemon/${number}.png`, { image: true });
  add("pokemonSprites", `public/images/pokemon/sprites/${number}.png`, {
    image: true,
  });
}

const habitatImages = [
  ...new Set(
    catalog.pokemon.flatMap((pokemon) =>
      pokemon.habitats
        .map((habitat) => habitat.image)
        .filter(Boolean)
        .map((url) => new URL(url).pathname.split("/").pop()),
    ),
  ),
];
for (const filename of habitatImages)
  add("habitats", `public/images/habitats/${filename}`, { image: true });

const catalogItemIds = new Set(catalog.items.map((item) => item.id));
for (const [id, reason] of Object.entries(itemImageExceptions)) {
  if (!catalogItemIds.has(id))
    issues.push(`Item-image exception ${id} is not present in the catalog.`);
  if (typeof reason !== "string" || !reason.trim())
    issues.push(`Item-image exception ${id} has no documented reason.`);
}
for (const item of catalog.items) {
  if (itemImageExceptions[item.id]) continue;
  add("items", `public/images/items/${item.id}.png`, { image: true });
}

const specialtyIds = [
  ...new Set(
    catalog.pokemon.flatMap((pokemon) =>
      pokemon.specialties
        .map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter(Boolean),
    ),
  ),
];
for (const id of specialtyIds)
  add("specialties", `public/images/specialties/${id}.png`, { image: true });

for (const filename of await readdir(join(ROOT, "src/storage/guide"))) {
  if (filename.endsWith(".png"))
    add("storageGuide", `src/storage/guide/${filename}`, { image: true });
}
for (const filename of ["favicon.png", "apple-touch-icon.png"])
  add("appShell", `public/${filename}`, { image: true });
add("appShell", "public/favicon.svg");
add("dependencyNotices", "public/data/POKOPIAPI-LICENSE.txt");
for (const filename of ["privacy.html", "support.html", "legal.css"])
  add("legalAndSupport", `public/${filename}`);
for (const filename of [
  "worker.min.js",
  "core/tesseract-core.wasm.js",
  "core/tesseract-core-simd.wasm.js",
  "core/tesseract-core-lstm.wasm.js",
  "core/tesseract-core-simd-lstm.wasm.js",
  "lang/eng.traineddata",
])
  add("ocrRuntime", `.android-build/tesseract/${filename}`);

const referenceManifestPath = join(
  ROOT,
  "public/data/storage-reference-index.v1.json",
);
let referenceManifest = null;
try {
  referenceManifest = JSON.parse(await readFile(referenceManifestPath, "utf8"));
  add("recognition", "public/data/storage-reference-index.v1.json");
  for (const part of referenceManifest.parts || [])
    add("recognition", `public/data/${part}`);
  const expectedMissing = Object.keys(itemImageExceptions).sort();
  const actualMissing = [
    ...(referenceManifest.missingReferenceIds || []),
  ].sort();
  if (JSON.stringify(expectedMissing) !== JSON.stringify(actualMissing))
    issues.push(
      `Recognition missingReferenceIds ${JSON.stringify(actualMissing)} do not match approved item-image exceptions ${JSON.stringify(expectedMissing)}.`,
    );
  if (referenceManifest.catalogVersion !== catalog.version)
    issues.push(
      `Recognition catalog version ${JSON.stringify(referenceManifest.catalogVersion)} does not match ${JSON.stringify(catalog.version)}.`,
    );
} catch (error) {
  issues.push(`Recognition manifest could not be read: ${error.message}`);
}

const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
if (expectedByPath.size !== expected.length)
  issues.push("The expected Android asset list contains duplicate paths.");

async function listFiles(directory, prefix) {
  return (await readdir(join(ROOT, directory), { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => `${prefix}/${entry.name}`);
}

const actualControlledFiles = [
  ...(await listFiles("public/images/pokemon", "public/images/pokemon")),
  ...(await listFiles(
    "public/images/pokemon/sprites",
    "public/images/pokemon/sprites",
  )),
  ...(await listFiles("public/images/habitats", "public/images/habitats")),
  ...(await listFiles("public/images/items", "public/images/items")),
  ...(await listFiles(
    "public/images/specialties",
    "public/images/specialties",
  )),
];
const expectedControlledPaths = new Set(
  expected
    .filter((entry) => entry.path.startsWith("public/images/") && entry.image)
    .map((entry) => entry.path),
);
for (const path of actualControlledFiles)
  if (!expectedControlledPaths.has(path))
    issues.push(`Unexpected controlled asset: ${path}`);
for (const path of expectedControlledPaths)
  if (!actualControlledFiles.includes(path))
    issues.push(`Missing asset: ${path}`);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function mediaType(path) {
  return (
    {
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
    }[extname(path).toLowerCase()] || "application/octet-stream"
  );
}

const fileRecords = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (cursor < expected.length) {
      const entry = expected[cursor++];
      const absolutePath = join(ROOT, entry.path);
      try {
        const contents = await readFile(absolutePath);
        if (!contents.length) throw new Error("file is empty");
        const record = {
          path: entry.path,
          group: entry.group,
          bytes: contents.length,
          mediaType: mediaType(entry.path),
          sha256: sha256(contents),
        };
        if (entry.image) {
          const metadata = await sharp(contents, {
            failOn: "error",
          }).metadata();
          if (!metadata.width || !metadata.height)
            throw new Error("image dimensions are unavailable");
          record.width = metadata.width;
          record.height = metadata.height;
        }
        fileRecords.push(record);
      } catch (error) {
        issues.push(`${entry.path}: ${error.message}`);
      }
    }
  }),
);
fileRecords.sort((left, right) => left.path.localeCompare(right.path));

const counts = Object.fromEntries(
  [...new Set(expected.map((entry) => entry.group))].map((group) => [
    group,
    expected.filter((entry) => entry.group === group).length,
  ]),
);
const lockfile = await readFile(join(ROOT, "package-lock.json"));
const catalogContents = await readFile(join(ROOT, "public/data/catalog.json"));
let sourceCommit = "unavailable";
let sourceDirty = true;
try {
  sourceCommit = (
    await run("git", ["rev-parse", "HEAD"], { cwd: ROOT })
  ).stdout.trim();
  sourceDirty = Boolean(
    (await run("git", ["status", "--porcelain"], { cwd: ROOT })).stdout.trim(),
  );
} catch {}

const generatedAt = new Date().toISOString();
const report = {
  generatorVersion: GENERATOR_VERSION,
  generatedAt,
  status: issues.length ? "fail" : "pass",
  catalogVersion: catalog.version,
  counts,
  approvedItemImageExceptions: itemImageExceptions,
  issues,
};
const releaseInputManifest = {
  generatorVersion: GENERATOR_VERSION,
  generatedAt,
  source: { commit: sourceCommit, dirty: sourceDirty },
  nodeVersion: process.version,
  lockfileSha256: sha256(lockfile),
  catalog: {
    version: catalog.version,
    sha256: sha256(catalogContents),
  },
  counts,
  approvedItemImageExceptions: itemImageExceptions,
  files: fileRecords,
};

await mkdir(PRIVATE_DIR, { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  MANIFEST_PATH,
  `${JSON.stringify(releaseInputManifest, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      status: report.status,
      reportPath: relative(ROOT, REPORT_PATH),
      manifestPath: relative(ROOT, MANIFEST_PATH),
      verifiedFiles: fileRecords.length,
      counts,
      approvedItemImageExceptions: Object.keys(itemImageExceptions),
      issues,
    },
    null,
    2,
  ),
);
if (issues.length) process.exitCode = 1;
