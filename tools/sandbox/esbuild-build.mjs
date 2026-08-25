// =============================================================================
// SANDBOX-ONLY verification bundler.
// -----------------------------------------------------------------------------
// The shipped app runs on Vite (`npm run dev` / `npm run build` in
// package.json). This script exists purely because the environment this
// project was authored in has no npm registry access, so Vite itself
// couldn't be installed to prove the app actually builds and runs. It
// reuses esbuild, which ships as a transitive dependency of the
// globally-installed `tsx` CLI — no extra install required.
//
// It performs the same essential job Vite's build would (bundle + resolve
// the @engine/@data/@store/@ui path aliases + write a static index.html),
// minus Vite's dev server, HMR, and plugin ecosystem. Delete this file
// (and tools/sandbox/) freely once you're building with real Vite.
// =============================================================================
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

function loadEsbuild() {
  try {
    return require("esbuild");
  } catch {
    // Fall back to the copy bundled with the globally-installed tsx CLI,
    // which is how this sandbox has esbuild available with zero installs.
    // Try a few common global-prefix layouts rather than assuming one.
    const candidates = [
      "/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/lib/main.js",
      path.join(path.dirname(process.execPath), "..", "lib", "node_modules", "tsx", "node_modules", "esbuild", "lib", "main.js"),
      path.join(path.dirname(process.execPath), "lib", "node_modules", "tsx", "node_modules", "esbuild", "lib", "main.js"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error(`Could not locate esbuild. Tried:\n${candidates.join("\n")}\nRun "npm install" in a normal environment instead.`);
  }
}

const esbuild = loadEsbuild();

function findGlobalPackageDir(pkgName) {
  const candidates = [
    `/home/claude/.npm-global/lib/node_modules/${pkgName}`,
    path.join(path.dirname(process.execPath), "..", "lib", "node_modules", pkgName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return null;
}

// This sandbox has no local node_modules (no npm registry access), but
// `react`/`react-dom` are installed globally for other tooling. In any
// normal environment (`npm install` has run), delete this block entirely —
// esbuild/Vite will resolve "react" from ./node_modules automatically.
const reactDir = findGlobalPackageDir("react");
const reactDomDir = findGlobalPackageDir("react-dom");
if (!reactDir || !reactDomDir) {
  throw new Error("Could not locate a global react/react-dom install for sandbox verification.");
}
const reactAliases = {
  react: path.join(reactDir, "index.js"),
  "react/jsx-runtime": path.join(reactDir, "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(reactDir, "jsx-dev-runtime.js"),
  "react-dom": path.join(reactDomDir, "index.js"),
  "react-dom/client": path.join(reactDomDir, "client.js"),
};

const outDir = path.join(root, "dist-sandbox");
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "src", "main.tsx")],
  bundle: true,
  outfile: path.join(outDir, "bundle.js"),
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  jsxImportSource: "react",
  loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
  alias: {
    "@engine": path.join(root, "src", "engine"),
    "@data": path.join(root, "src", "data"),
    "@store": path.join(root, "src", "store"),
    "@ui": path.join(root, "src", "ui"),
    ...reactAliases,
  },
  // Never bundled here: not installed in this sandbox, and not on the
  // default code path (see src/data/index.ts — gated behind env vars).
  external: ["@supabase/supabase-js"],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": "undefined",
    "import.meta.env.VITE_SUPABASE_ANON_KEY": "undefined",
  },
  minify: false,
  sourcemap: true,
  logLevel: "info",
});

// esbuild's CSS loader only applies to CSS *imported from JS*; index.html
// links the stylesheet directly, so just copy it next to the bundle.
fs.copyFileSync(path.join(root, "src", "styles", "index.css"), path.join(outDir, "index.css"));

// Mirror Vite's public/ convention (copied verbatim to the build root) so
// static assets like the homepage demo video work the same way here.
const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  for (const entry of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, entry), path.join(outDir, entry));
  }
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>NFL LIFE — Live the Career</title>
    <link rel="stylesheet" href="./index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="./bundle.js"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);

console.log(`\nSandbox build written to ${outDir}`);
