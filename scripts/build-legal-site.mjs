import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = "dist-legal";

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "privacy"), { recursive: true });
await mkdir(join(output, "support"), { recursive: true });

await Promise.all([
  copyFile("public/privacy.html", join(output, "index.html")),
  copyFile("public/privacy.html", join(output, "privacy", "index.html")),
  copyFile("public/support.html", join(output, "support", "index.html")),
  copyFile("public/legal.css", join(output, "legal.css")),
  copyFile("public/favicon.svg", join(output, "favicon.svg")),
  copyFile("public/favicon.png", join(output, "favicon.png")),
]);

await writeFile(
  join(output, "_headers"),
  `/*
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: default-src 'self'; connect-src 'none'; img-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
  Permissions-Policy: camera=(), geolocation=(), microphone=()
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
`,
);

console.log(
  JSON.stringify(
    {
      output,
      root: "/",
      routes: ["/privacy", "/support"],
      serviceWorker: false,
    },
    null,
    2,
  ),
);
