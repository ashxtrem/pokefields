import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.atcodepathi.pokopiafieldnotes",
  appName: "pokefields",
  webDir: "dist-android",
  server: {
    androidScheme: "https",
  },
};

export default config;
