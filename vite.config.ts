import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Served from GitHub Pages at https://lunardig.github.io/ld-simrun/.
export default defineConfig({
  base: process.env.SIMRUN_BASE ?? "/ld-simrun/",
  resolve: {
    alias: [
      {
        find: /^@lunardig\/ld-interfaces$/,
        replacement: fileURLToPath(new URL("./vendor/ld-sdk/vendor/ld-interfaces/packages/ts/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: { include: ["src/**/*.test.ts"] },
});
