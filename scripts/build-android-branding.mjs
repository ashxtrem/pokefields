import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const resourceRoot = "android/app/src/main/res";
const sourceIcon = await readFile("public/favicon.svg");
const leafPaths = `
  <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
`;
const roundIcon = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="16" fill="#294f3e"/>
    <g fill="none" stroke="#fbf7e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
      ${leafPaths}
    </g>
  </svg>
`);
const adaptiveForeground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
    <g fill="none" stroke="#fbf7e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(18 18) scale(3)">
      ${leafPaths}
    </g>
  </svg>
`);

const densities = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

for (const [density, sizes] of Object.entries(densities)) {
  const directory = join(resourceRoot, `mipmap-${density}`);
  await Promise.all([
    sharp(sourceIcon)
      .resize(sizes.launcher, sizes.launcher)
      .png()
      .toFile(join(directory, "ic_launcher.png")),
    sharp(roundIcon)
      .resize(sizes.launcher, sizes.launcher)
      .png()
      .toFile(join(directory, "ic_launcher_round.png")),
    sharp(adaptiveForeground)
      .resize(sizes.foreground, sizes.foreground)
      .png()
      .toFile(join(directory, "ic_launcher_foreground.png")),
  ]);
}

console.log(
  JSON.stringify(
    {
      appName: "pokefields",
      source: "public/favicon.svg",
      launcherDensities: Object.keys(densities),
      adaptiveBackground: "#294f3e",
    },
    null,
    2,
  ),
);
