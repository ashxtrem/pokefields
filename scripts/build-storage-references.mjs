// Precomputes and versions the Storage Locator recognition reference index — the color/shape
// descriptor and ORB keypoints for every catalog item with baked artwork — so the client never
// rebuilds ~1,765 reference descriptors per scan (see docs/storage-locator-feature-master-prompt.md,
// "Precompute and version catalog color/shape and ORB reference features at build time").
//
// Run after scripts/bake-images.mjs (wired into `npm run build`) and before `vite build`, since
// the output is fetched by the app at public/data/storage-reference-index.v<N>.json.
//
// The full descriptor set base64-encodes to 40+ MiB (Cloudflare Pages rejects any single static
// file over 25 MiB), so the item array is sharded across several storage-reference-index.v<N>.part
// <i>.json files; storage-reference-index.v<N>.json itself is now a small manifest listing those
// parts — src/storage/recognition/referenceIndex.ts fetches the manifest, then every part, and
// concatenates their items before building the in-memory index exactly as before. This is a
// packaging change only: the descriptor bytes and recognition math are untouched, so it needs no
// benchmark re-run.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import cvModule from "@techstark/opencv-js";
import { referenceDescriptor, referenceOrbDescriptor } from "./lib/node-image-adapter.mjs";

// Node scripts can't import a .ts file directly (no ts-node/tsx in this repo — see the plan's
// architecture notes on keeping the shared recognition core as plain .mjs for exactly this
// reason). This literal must match src/storage/constants.ts's RECOGNITION_INDEX_VERSION;
// tests/storage-recognition.test.ts asserts they stay in sync.
const RECOGNITION_INDEX_VERSION = 1;

/** Safely under Cloudflare Pages' 25 MiB per-file limit, leaving headroom for catalog growth. */
const MAX_PART_BYTES = 15 * 1024 * 1024;

const cv = await cvModule;
const ROOT = resolve(import.meta.dirname, "..");
const CATALOG_PATH = join(ROOT, "public/data/catalog.json");
const ITEM_IMAGE_DIR = join(ROOT, "public/images/items");
const DATA_DIR = join(ROOT, "public/data");
const MANIFEST_PATH = join(
  DATA_DIR,
  `storage-reference-index.v${RECOGNITION_INDEX_VERSION}.json`,
);
function partFileName(index) {
  return `storage-reference-index.v${RECOGNITION_INDEX_VERSION}.part${index}.json`;
}

/** Greedily packs items into parts, each kept under MAX_PART_BYTES by its own serialized size. */
function shardItems(items) {
  const parts = [];
  let current = [];
  let currentBytes = 2; // "[" + "]"
  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item)) + 1; // + separating comma
    if (current.length && currentBytes + itemBytes > MAX_PART_BYTES) {
      parts.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(item);
    currentBytes += itemBytes;
  }
  if (current.length) parts.push(current);
  return parts;
}

function toBase64(uint8) {
  return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString("base64");
}

async function main() {
  const startedAt = performance.now();
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const items = [];
  const missingReferenceIds = [];

  for (const item of catalog.items) {
    const imagePath = join(ITEM_IMAGE_DIR, `${item.id}.png`);
    if (!existsSync(imagePath)) {
      missingReferenceIds.push(item.id);
      continue;
    }
    const descriptor = await referenceDescriptor(imagePath);
    const orb = await referenceOrbDescriptor(cv, imagePath);
    items.push({
      id: item.id,
      histogramB64: toBase64(new Uint8Array(descriptor.histogram.buffer)),
      shapeB64: toBase64(descriptor.shape),
      aspect: descriptor.aspect,
      orbRows: orb.rows,
      orbDataB64: orb.rows ? toBase64(new Uint8Array(orb.data)) : "",
    });
    orb.delete();
  }

  await mkdir(DATA_DIR, { recursive: true });

  const shards = shardItems(items);
  const partNames = shards.map((_, index) => partFileName(index));

  // Remove any part files a previous build left behind (e.g. the catalog shrank and now needs
  // fewer shards) so stale, unreferenced files don't linger in public/data.
  const existingFiles = await readdir(DATA_DIR);
  const partPattern = new RegExp(`^storage-reference-index\\.v${RECOGNITION_INDEX_VERSION}\\.part\\d+\\.json$`);
  await Promise.all(
    existingFiles
      .filter((name) => partPattern.test(name) && !partNames.includes(name))
      .map((name) => rm(join(DATA_DIR, name))),
  );

  let totalBytes = 0;
  for (const [index, shard] of shards.entries()) {
    const partJson = JSON.stringify({ items: shard });
    totalBytes += Buffer.byteLength(partJson);
    await writeFile(join(DATA_DIR, partFileName(index)), partJson);
  }

  const manifest = {
    version: RECOGNITION_INDEX_VERSION,
    catalogVersion: catalog.version,
    builtAt: new Date().toISOString(),
    missingReferenceIds,
    parts: partNames,
  };
  const manifestJson = JSON.stringify(manifest);
  totalBytes += Buffer.byteLength(manifestJson);
  await writeFile(MANIFEST_PATH, manifestJson);

  const elapsedMs = performance.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        manifestPath: MANIFEST_PATH,
        partCount: shards.length,
        itemCount: items.length,
        missingReferenceCount: missingReferenceIds.length,
        totalBytes,
        totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
        largestPartMB: (Math.max(...shards.map((s) => Buffer.byteLength(JSON.stringify({ items: s })))) / (1024 * 1024)).toFixed(2),
        elapsedMs: Math.round(elapsedMs),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
