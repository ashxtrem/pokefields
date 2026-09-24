import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const distributions = ["web", "android"] as const;

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const configuredDistribution = environment.VITE_DISTRIBUTION?.trim();
  const distribution =
    configuredDistribution || (mode === "android" ? "android" : "web");

  if (!distributions.includes(distribution as (typeof distributions)[number])) {
    throw new Error(
      `Unsupported VITE_DISTRIBUTION ${JSON.stringify(distribution)}. Expected "web" or "android".`,
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "android-content-security-policy",
        transformIndexHtml(html) {
          if (distribution !== "android") return html;
          return html.replace(
            "<head>",
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; child-src 'self' blob:; font-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'none'">`,
          );
        },
      },
    ],
    define: {
      "import.meta.env.VITE_DISTRIBUTION": JSON.stringify(distribution),
    },
    build: {
      outDir: distribution === "android" ? "dist-android" : "dist",
    },
  };
});
