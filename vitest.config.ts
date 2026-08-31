import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Match Vite's runner-compatible config loading. The sandbox denies esbuild's
// default upward directory scan, while native ESM evaluation needs an explicit
// project directory instead of CommonJS __dirname.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@engine": path.resolve(projectRoot, "src/engine"),
      "@data": path.resolve(projectRoot, "src/data"),
      "@store": path.resolve(projectRoot, "src/store"),
      "@ui": path.resolve(projectRoot, "src/ui"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
