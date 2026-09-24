import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isAndroidDistribution } from "./distribution";

export function buildBackupFilename(
  date = new Date(),
  android = isAndroidDistribution(),
): string {
  const appName = android ? "pokefields" : "pokopia-fieldnotes";
  return `${appName}-${date.toISOString().slice(0, 10)}.json`;
}

function downloadWebBackup(contents: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareAndroidBackup(
  contents: string,
  filename: string,
): Promise<void> {
  const result = await Filesystem.writeFile({
    path: `backups/${filename}`,
    data: contents,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  await Share.share({
    title: "pokefields backup",
    files: [result.uri],
    dialogTitle: "Export pokefields backup",
  });
}

export async function exportNotebookBackup(
  contents: string,
  filename = buildBackupFilename(),
): Promise<void> {
  if (isAndroidDistribution()) {
    await shareAndroidBackup(contents, filename);
    return;
  }

  downloadWebBackup(contents, filename);
}
