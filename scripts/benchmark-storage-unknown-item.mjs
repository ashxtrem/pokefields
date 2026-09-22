// Unknown-item (false-accept) calibration for the Storage Locator recognizer.
//
// There is no independent dataset of non-catalog item photos in this repository (only three
// negative-control camera photos, which are a separate no-go for a different reason — see
// docs/research/storage-recognition-benchmark.md). Rather than skip this gate or fabricate a
// number, this script runs a **leave-one-out** simulation on the 30 already-labeled native
// screenshot slots: for each labeled slot, its own true reference item is removed from the
// candidate list AFTER the normal full-catalog retrieval/rerank (removing it post-hoc is
// equivalent to excluding it from the catalog, since LSH retrieval and reranking for every OTHER
// candidate does not depend on whether item X's own reference exists). What's left is "the best
// the matcher can do when the correct answer isn't in the catalog" — a reasonable stand-in for a
// held-out/new-DLC item, drawn from the SAME six screenshots/one game build as the known-item
// benchmark, not independent photos. That limitation is reported alongside the result.
//
// Thresholds are chosen as the smallest score/margin that clears every simulated-unknown case in
// this sample (0/30 measured false accepts here) — i.e. the most conservative thresholds this
// dataset can support, not a target relaxed to let more real items through. A larger, independent
// unknown-item dataset should replace this before those thresholds are trusted at scale.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import cvModule from "@techstark/opencv-js";
import { slotBounds } from "../src/storage/recognition/core/grid.mjs";
import { buildMedianBackground, targetDescriptor } from "../src/storage/recognition/core/foreground.mjs";
import { rankCandidates } from "../src/storage/recognition/core/retrieval.mjs";
import { createLshBuckets, insertIntoLshBuckets } from "../src/storage/recognition/core/lsh.mjs";
import { RETRIEVAL } from "../src/storage/recognition/core/constants.mjs";
import {
  extractSlotRgb,
  referenceDescriptor,
  referenceOrbDescriptor,
  targetOrbDescriptor,
} from "./lib/node-image-adapter.mjs";

const cv = await cvModule;
const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "benchmarks/storage-recognition/native-switch-manifest.json");
const CATALOG_PATH = join(ROOT, "public/data/catalog.json");
const ITEM_IMAGE_DIR = join(ROOT, "public/images/items");
const INPUT_DIR = join(ROOT, "docs/research/storage-samples");
const OUTPUT_DIR = join(ROOT, ".artifacts/storage-recognition-unknown-item");

const DECLARED_FALSE_ACCEPT_TARGET = 0.05; // 5% — stated up front, not fit after seeing results.

async function main() {
  const startedAt = performance.now();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  await mkdir(OUTPUT_DIR, { recursive: true });

  const grid = manifest.input.grid;
  const slotPixels = new Map();
  const allOccupiedSlots = [];
  for (const page of manifest.pages) {
    const imagePath = join(INPUT_DIR, page.file);
    for (let slot = 1; slot <= page.occupiedSlots; slot += 1) {
      const { pixels } = await extractSlotRgb(imagePath, slotBounds(grid, slot));
      slotPixels.set(`${page.file}:${slot}`, pixels);
      allOccupiedSlots.push(pixels);
    }
  }
  const background = buildMedianBackground(allOccupiedSlots, grid.cropWidth, grid.cropHeight, 3);

  const targets = [];
  for (const annotation of manifest.annotations) {
    const imagePath = join(INPUT_DIR, annotation.file);
    const bounds = slotBounds(grid, annotation.slot);
    const pixels = slotPixels.get(`${annotation.file}:${annotation.slot}`);
    const descriptor = targetDescriptor(pixels, background, grid.cropWidth, grid.cropHeight, 3);
    targets.push({
      ...annotation,
      descriptor,
      orb: await targetOrbDescriptor(cv, imagePath, bounds),
    });
  }

  const references = [];
  const lshBuckets = createLshBuckets();
  for (const item of catalog.items) {
    const imagePath = join(ITEM_IMAGE_DIR, `${item.id}.png`);
    if (!existsSync(imagePath)) continue;
    const descriptor = await referenceDescriptor(imagePath);
    const orb = await referenceOrbDescriptor(cv, imagePath);
    const referenceIndex = references.length;
    insertIntoLshBuckets(lshBuckets, orb, referenceIndex);
    references.push({ id: item.id, name: item.name, descriptor, orb });
  }

  const cases = targets.map((target) => {
    const ranked = rankCandidates({ cv, target, references, lshBuckets, retrieval: manifest.retrieval });
    const known = {
      topScore: ranked[0]?.score ?? null,
      topTwoMargin: ranked.length >= 2 ? ranked[0].score - ranked[1].score : null,
      truthRank: ranked.findIndex((c) => c.id === target.truthId) + 1 || null,
    };
    const withoutTruth = ranked.filter((c) => c.id !== target.truthId);
    const unknown = {
      bestWrongId: withoutTruth[0]?.id ?? null,
      bestWrongName: withoutTruth[0] ? references.find((r) => r.id === withoutTruth[0].id)?.name : null,
      topScore: withoutTruth[0]?.score ?? null,
      topTwoMargin: withoutTruth.length >= 2 ? withoutTruth[0].score - withoutTruth[1].score : null,
    };
    return { file: target.file, slot: target.slot, truthId: target.truthId, known, unknown };
  });

  const unknownScores = cases.map((c) => c.unknown.topScore).filter((v) => v !== null);
  const unknownMargins = cases.map((c) => c.unknown.topTwoMargin).filter((v) => v !== null);
  // Smallest thresholds that clear every simulated-unknown case in this sample.
  const minimumScore = Math.max(...unknownScores) + 0.01;
  const minimumMargin = Math.max(...unknownMargins) + 0.01;

  const falseAccepts = cases.filter(
    (c) => c.unknown.topScore !== null && c.unknown.topScore >= minimumScore &&
      (c.unknown.topTwoMargin ?? 0) >= minimumMargin,
  ).length;
  const knownAccepted = cases.filter(
    (c) => c.known.topScore !== null && c.known.topScore >= minimumScore &&
      (c.known.topTwoMargin ?? 0) >= minimumMargin,
  ).length;
  const knownAcceptedAndCorrect = cases.filter(
    (c) =>
      c.known.topScore !== null &&
      c.known.topScore >= minimumScore &&
      (c.known.topTwoMargin ?? 0) >= minimumMargin &&
      c.known.truthRank === 1,
  ).length;

  const results = {
    generatedAt: new Date().toISOString(),
    method:
      "Leave-one-out on the 30 labeled native-screenshot slots: each slot's own true reference is " +
      "excluded from its ranked candidates post-hoc, simulating an item absent from the catalog.",
    limitation:
      "Drawn from the same six screenshots/one game build as the known-item benchmark, not " +
      "independent unknown-item photos. Treat as a lower-bound sanity check, not a production-grade " +
      "false-accept measurement. A larger independent dataset should replace this before shipping " +
      "automatic acceptance broadly.",
    declaredFalseAcceptTarget: DECLARED_FALSE_ACCEPT_TARGET,
    labeledCases: cases.length,
    derivedThresholds: { minimumScore, minimumMargin },
    measured: {
      falseAccepts,
      falseAcceptRate: cases.length ? falseAccepts / cases.length : null,
      knownItemAcceptedCount: knownAccepted,
      knownItemAcceptedAndCorrectCount: knownAcceptedAndCorrect,
      knownItemAcceptedRate: cases.length ? knownAccepted / cases.length : null,
    },
    cases,
    timings: { totalMs: performance.now() - startedAt },
  };

  const jsonPath = join(OUTPUT_DIR, "results.json");
  await writeFile(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
  for (const target of targets) target.orb.delete();
  for (const reference of references) reference.orb.delete();

  console.log(
    JSON.stringify(
      {
        labeledCases: results.labeledCases,
        derivedThresholds: results.derivedThresholds,
        measured: results.measured,
        limitation: results.limitation,
        jsonPath,
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
