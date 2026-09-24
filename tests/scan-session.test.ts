import { describe, expect, it } from "vitest";
import {
  retainRowsForCurrentPages,
  rowNeedsMatch,
  rowsAfterStop,
  shouldShowScanToast,
  type ScanPage,
  type ScanRow,
} from "../src/storage/scanSession";

const thumbnail = new Blob();
const matched = {
  status: "matched" as const,
  itemId: "item:a",
  score: 20,
  margin: 8,
  source: "visual" as const,
};
const unresolved = {
  status: "unresolved" as const,
  candidates: [],
  reason: "ambiguous" as const,
};

function row(fields: Partial<ScanRow> = {}): ScanRow {
  return {
    page: 1,
    slot: 1,
    thumbnail,
    outcome: null,
    decision: null,
    ...fields,
  };
}

function page(pageNumber: number, hash: string): ScanPage {
  return { page: pageNumber, hash, file: {} as File };
}

describe("scan session rules", () => {
  it("matches unfinished and untouched unresolved rows", () => {
    expect(rowNeedsMatch(row())).toBe(true);
    expect(
      rowNeedsMatch(
        row({ outcome: unresolved, decision: { kind: "unresolved" } }),
      ),
    ).toBe(true);
  });

  it("skips matched, accepted, identified, and ignored rows", () => {
    expect(
      rowNeedsMatch(
        row({
          outcome: matched,
          decision: {
            kind: "accept",
            ref: { kind: "catalog", itemId: "item:a" },
          },
        }),
      ),
    ).toBe(false);
    expect(
      rowNeedsMatch(
        row({
          outcome: unresolved,
          decision: {
            kind: "accept",
            ref: { kind: "catalog", itemId: "item:b" },
          },
        }),
      ),
    ).toBe(false);
    expect(
      rowNeedsMatch(
        row({ outcome: unresolved, decision: { kind: "ignored" } }),
      ),
    ).toBe(false);
  });

  it("retains only completed rows when stopped", () => {
    const completed = row({
      outcome: matched,
      decision: {
        kind: "accept",
        ref: { kind: "catalog", itemId: "item:a" },
      },
    });
    expect(rowsAfterStop([completed, row({ slot: 2 })])).toEqual([completed]);
  });

  it("drops rows only for a page whose file hash changed", () => {
    const rows = [row({ page: 1 }), row({ page: 2 })];
    expect(
      retainRowsForCurrentPages(
        rows,
        [page(1, "same"), page(2, "old")],
        [page(1, "same"), page(2, "new")],
      ),
    ).toEqual([rows[0]]);
  });

  it("suppresses completion notices while the review is open", () => {
    expect(shouldShowScanToast(true)).toBe(false);
    expect(shouldShowScanToast(false)).toBe(true);
  });
});
