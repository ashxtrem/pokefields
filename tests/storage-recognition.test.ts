import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GATE, NATIVE_GRID, RETRIEVAL } from "../src/storage/recognition/core/constants.mjs";
import { descriptorSimilarity } from "../src/storage/recognition/core/descriptor.mjs";
import { classifyOutcome } from "../src/storage/recognition/core/confidence.mjs";
import { slotBounds } from "../src/storage/recognition/core/grid.mjs";
import { RECOGNITION_INDEX_VERSION } from "../src/storage/constants";

const ROOT = resolve(import.meta.dirname, "..");

describe("recognition constants stay in sync with the gated benchmark manifest", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, "benchmarks/storage-recognition/native-switch-manifest.json"), "utf8"),
  );

  it("mirrors the manifest's grid geometry exactly", () => {
    expect(NATIVE_GRID).toEqual({
      width: manifest.input.width,
      height: manifest.input.height,
      ...manifest.input.grid,
    });
  });

  it("mirrors the manifest's retrieval tunables exactly", () => {
    expect(RETRIEVAL).toEqual(manifest.retrieval);
  });

  it("mirrors the manifest's pass gate exactly", () => {
    expect(GATE).toEqual(manifest.gate);
  });

  it("matches the literal RECOGNITION_INDEX_VERSION duplicated in scripts/build-storage-references.mjs", async () => {
    const script = await readFile(resolve(ROOT, "scripts/build-storage-references.mjs"), "utf8");
    expect(script).toContain(`const RECOGNITION_INDEX_VERSION = ${RECOGNITION_INDEX_VERSION};`);
  });
});

describe("slotBounds", () => {
  it("computes the first slot's crop from the grid's first center point", () => {
    const bounds = slotBounds(NATIVE_GRID, 1);
    expect(bounds).toEqual({
      left: Math.round(NATIVE_GRID.firstCenterX - NATIVE_GRID.cropWidth / 2),
      top: Math.round(NATIVE_GRID.firstCenterY - NATIVE_GRID.cropHeight / 2),
      width: NATIVE_GRID.cropWidth,
      height: NATIVE_GRID.cropHeight,
    });
  });

  it("wraps to the next row after `columns` slots", () => {
    const first = slotBounds(NATIVE_GRID, NATIVE_GRID.columns + 1);
    const rowStart = slotBounds(NATIVE_GRID, 1);
    expect(first.left).toBe(rowStart.left);
    expect(first.top).toBeGreaterThan(rowStart.top);
  });
});

describe("descriptorSimilarity", () => {
  const flat = { histogram: new Float32Array(192), shape: new Uint8Array(1024), aspect: 1 };

  it("is 1 for a descriptor compared with itself when histogram is normalized", () => {
    const histogram = new Float32Array(192);
    histogram[0] = 1;
    const descriptor = { histogram, shape: new Uint8Array(1024).fill(1), aspect: 1 };
    expect(descriptorSimilarity(descriptor, descriptor)).toBeCloseTo(1, 5);
  });

  it("penalizes a very different aspect ratio", () => {
    const wide = { ...flat, aspect: 3 };
    const tall = { ...flat, aspect: 0.33 };
    const same = { ...flat, aspect: 1 };
    expect(descriptorSimilarity(same, wide)).toBeLessThan(descriptorSimilarity(same, same));
    expect(descriptorSimilarity(same, tall)).toBeLessThan(descriptorSimilarity(same, same));
  });
});

describe("classifyOutcome (confidence policy)", () => {
  const ranked = [
    { referenceIndex: 0, id: "a", histogramScore: 0.9, goodMatches: 20, averageDistance: 30, orbScore: 15, score: 20 },
    { referenceIndex: 1, id: "b", histogramScore: 0.5, goodMatches: 5, averageDistance: 60, orbScore: 3, score: 12 },
  ];

  it("never reports 'matched' when no thresholds have been calibrated yet", () => {
    const outcome = classifyOutcome(ranked, undefined);
    expect(outcome.status).toBe("unresolved");
  });

  it("reports 'matched' once above both the score and margin thresholds", () => {
    const outcome = classifyOutcome(ranked, { minimumScore: 15, minimumMargin: 5 });
    expect(outcome).toEqual({ status: "matched", itemId: "a", score: 20, margin: 8, source: "visual" });
  });

  it("stays 'unresolved' with reason 'ambiguous' when the margin is too thin", () => {
    const outcome = classifyOutcome(ranked, { minimumScore: 10, minimumMargin: 50 });
    expect(outcome).toEqual({ status: "unresolved", candidates: [{ itemId: "a", score: 20 }, { itemId: "b", score: 12 }], reason: "ambiguous" });
  });

  it("stays 'unresolved' with reason 'low-score' when the top score itself is too low", () => {
    const outcome = classifyOutcome(ranked, { minimumScore: 100, minimumMargin: 0 });
    expect(outcome.status).toBe("unresolved");
    expect((outcome as { reason: string }).reason).toBe("low-score");
  });

  it("never presents an unresolved candidate as an identified item", () => {
    const outcome = classifyOutcome(ranked, undefined);
    expect(outcome).not.toHaveProperty("itemId");
  });

  it("reports 'no-item' when there are no candidates at all", () => {
    expect(classifyOutcome([], { minimumScore: 0, minimumMargin: 0 })).toEqual({
      status: "unresolved",
      candidates: [],
      reason: "no-item",
    });
  });
});
