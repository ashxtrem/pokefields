import { beforeEach, describe, expect, it, vi } from "vitest";

const { writeFile, share } = vi.hoisted(() => ({
  writeFile: vi.fn(),
  share: vi.fn(),
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { writeFile },
}));

vi.mock("@capacitor/share", () => ({
  Share: { share },
}));

vi.mock("../src/platform/distribution", () => ({
  isAndroidDistribution: () => true,
}));

import {
  buildBackupFilename,
  exportNotebookBackup,
} from "../src/platform/backupExport";

describe("backup export", () => {
  beforeEach(() => {
    writeFile.mockReset();
    share.mockReset();
    writeFile.mockResolvedValue({
      uri: "file:///data/user/0/com.atcodepathi.pokopiafieldnotes/cache/backups/pokefields-2026-09-23.json",
    });
    share.mockResolvedValue({});
  });

  it("uses the pokefields name for an Android backup", () => {
    expect(buildBackupFilename(new Date("2026-09-23T12:00:00Z"), true)).toBe(
      "pokefields-2026-09-23.json",
    );
  });

  it("writes the backup to Android cache and shares the resulting file", async () => {
    const contents = JSON.stringify({ envelopeVersion: 2 });

    await exportNotebookBackup(contents, "pokefields-2026-09-23.json");

    expect(writeFile).toHaveBeenCalledWith({
      path: "backups/pokefields-2026-09-23.json",
      data: contents,
      directory: "CACHE",
      encoding: "utf8",
      recursive: true,
    });
    expect(share).toHaveBeenCalledWith({
      title: "pokefields backup",
      files: [
        "file:///data/user/0/com.atcodepathi.pokopiafieldnotes/cache/backups/pokefields-2026-09-23.json",
      ],
      dialogTitle: "Export pokefields backup",
    });
  });

  it("does not open sharing when the backup file cannot be written", async () => {
    writeFile.mockRejectedValue(new Error("disk full"));

    await expect(
      exportNotebookBackup("{}", "pokefields-2026-09-23.json"),
    ).rejects.toThrow("disk full");
    expect(share).not.toHaveBeenCalled();
  });
});
