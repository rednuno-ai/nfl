import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `--configLoader runner` evaluates this as a native ESM module. Resolving the
// config directory from import.meta.url keeps aliases working there as well as
// in Vite's default bundled config loader.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// This is a static React SPA. Keeping Vite independent from the Workers
// runtime makes `vite dev` / HMR reliable; Wrangler deploys the built `dist`
// directory as static assets (see wrangler.jsonc).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(projectRoot, "src/engine"),
      "@data": path.resolve(projectRoot, "src/data"),
      "@store": path.resolve(projectRoot, "src/store"),
      "@ui": path.resolve(projectRoot, "src/ui"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    // Source maps are useful locally but add deploy weight and expose source
    // in a public game build. Vite still fingerprints emitted app assets for
    // long-lived Worker caching.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
