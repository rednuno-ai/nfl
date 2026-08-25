import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// NFL LIFE — Vite configuration.
// Runs in any normal Node environment with npm access (local machine, CI, Vercel).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@data": path.resolve(__dirname, "src/data"),
      "@store": path.resolve(__dirname, "src/store"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
