import { mkdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

const output = resolve("dist");

for (const route of ["privacy", "support"]) {
  const directory = join(output, route);
  await mkdir(directory, { recursive: true });
  await rename(join(output, `${route}.html`), join(directory, "index.html"));
}

console.log(
  JSON.stringify(
    {
      output: "dist",
      routes: ["/privacy", "/support"],
    },
    null,
    2,
  ),
);
