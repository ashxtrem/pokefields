/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISTRIBUTION: "web" | "android";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
