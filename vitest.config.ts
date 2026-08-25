import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@data": path.resolve(__dirname, "src/data"),
      "@store": path.resolve(__dirname, "src/store"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
