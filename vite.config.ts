import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// This is a static React SPA. Keeping Vite independent from the Workers
// runtime makes `vite dev` / HMR reliable; Wrangler deploys the built `dist`
// directory as static assets (see wrangler.jsonc).
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
