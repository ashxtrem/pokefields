import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "dist-android");
const REPORT = join(ROOT, ".release-private/android-output-report.json");
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".webmanifest",
]);
const PROVENANCE_KEYS = new Set([
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
]);
const REQUIRED_OCR_FILES = [
  "tesseract/worker.min.js",
  "tesseract/core/tesseract-core.wasm.js",
  "tesseract/core/tesseract-core-simd.wasm.js",
  "tesseract/core/tesseract-core-lstm.wasm.js",
  "tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "tesseract/lang/eng.traineddata",
];
const FORBIDDEN_FILES = ["sw.js", "_redirects", "images/manifest.json"];
const allowedExternalReferences = [
  {
    pattern: /^https?:\/\/www\.w3\.org\//,
    reason: "W3C namespace identifier",
  },
  {
    pattern: /^https:\/\/react\.dev\/errors\//,
    reason: "React diagnostic identifier",
  },
  {
    pattern: /^https:\/\/tailwindcss\.com(?:\/|$)/,
    reason: "Tailwind build banner",
  },
  {
    pattern: /^https:\/\/capacitorjs\.com\/$/,
    reason: "Capacitor MIT license banner",
  },
  {
    pattern: /^https:\/\/github\.com\/opencv\/opencv\/issues\/16739/,
    reason: "OpenCV diagnostic reference",
  },
  {
    pattern: /^https?:\/\/tinyurl\.com\/y2uuvskb/,
    reason: "embedded dependency diagnostic reference",
  },
  {
    pattern: /^https?:\/\/bit\.ly\/2kdckMn/,
    reason: "embedded dependency diagnostic reference",
  },
  {
    pattern:
      /^https:\/\/pokefields-privacy\.pages\.dev\/privacy(?:[?#]|$)/,
    reason: "explicit privacy action opened by the Capacitor Browser plugin",
  },
];

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

function walkJson(value, path = [], findings = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      walkJson(entry, [...path, index], findings),
    );
    return findings;
  }
  if (!value || typeof value !== "object") return findings;
  for (const [key, entry] of Object.entries(value)) {
    if (PROVENANCE_KEYS.has(key)) findings.push([...path, key].join("."));
    if (key === "source" && entry !== "")
      findings.push(`${[...path, key].join(".")} (non-empty source)`);
    walkJson(entry, [...path, key], findings);
  }
  return findings;
}

function classifyExternalReference(reference, path) {
  const tesseractFallback =
    reference.startsWith("https://cdn.jsdelivr.net/npm/tesseract.js") ||
    reference.startsWith("https://cdn.jsdelivr.net/npm/@tesseract.js-data/");
  if (
    tesseractFallback &&
    (path.startsWith("tesseract/") || path.startsWith("assets/"))
  )
    return "Tesseract library fallback overridden by explicit packaged paths";
  return allowedExternalReferences.find(({ pattern }) =>
    pattern.test(reference),
  )?.reason;
}

const issues = [];
const allowedReferences = [];
const files = await listFiles(OUTPUT);
const relativeFiles = files.map((path) => relative(OUTPUT, path));

for (const forbidden of FORBIDDEN_FILES)
  if (relativeFiles.includes(forbidden))
    issues.push(`Forbidden output file: ${forbidden}`);
for (const required of REQUIRED_OCR_FILES)
  if (!relativeFiles.includes(required))
    issues.push(`Missing packaged OCR file: ${required}`);

const indexHtml = await readFile(join(OUTPUT, "index.html"), "utf8");
for (const directive of [
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
])
  if (!indexHtml.includes(directive))
    issues.push(`Android CSP is missing ${JSON.stringify(directive)}.`);

const catalogContents = await readFile(
  join(OUTPUT, "data/catalog.json"),
  "utf8",
);
const catalog = JSON.parse(catalogContents);
for (const finding of walkJson(catalog))
  issues.push(`Android catalog retains provenance at ${finding}.`);
const catalogRemoteStrings = catalogContents.match(/https?:\/\//g) || [];
if (catalogRemoteStrings.length)
  issues.push(
    `Android catalog contains ${catalogRemoteStrings.length} remote URL marker(s).`,
  );

const referencePattern =
  /https?:\/\/[^\s"'<>`)]+|\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>`)]*)?/gi;
for (const absolutePath of files) {
  const extension = extname(absolutePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) continue;
  const path = relative(OUTPUT, absolutePath);
  const contents = await readFile(absolutePath, "utf8");
  for (const reference of contents.match(referencePattern) || []) {
    const reason = classifyExternalReference(reference, path);
    if (reason) allowedReferences.push({ path, reference, reason });
    else issues.push(`Unexpected external reference in ${path}: ${reference}`);
  }
}

const ocrFiles = [];
for (const path of REQUIRED_OCR_FILES) {
  const contents = await readFile(join(OUTPUT, path));
  ocrFiles.push({ path, bytes: contents.length, sha256: sha256(contents) });
}

const report = {
  generatorVersion: 1,
  generatedAt: new Date().toISOString(),
  status: issues.length ? "fail" : "pass",
  fileCount: files.length,
  catalogVersion: catalog.version,
  ocrFiles,
  allowedExternalReferences: allowedReferences,
  issues,
};
await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      status: report.status,
      reportPath: relative(ROOT, REPORT),
      fileCount: report.fileCount,
      packagedOcrFiles: ocrFiles.length,
      allowedExternalReferences: allowedReferences.length,
      issues,
    },
    null,
    2,
  ),
);
if (issues.length) process.exitCode = 1;
