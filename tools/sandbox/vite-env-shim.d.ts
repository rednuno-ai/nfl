// Sandbox-only substitute for src/vite-env.d.ts's `/// <reference types="vite/client" />`,
// which needs the `vite` package installed to resolve. Declares just enough
// of `import.meta.env` for tsc to check files that read our two Supabase env
// vars without erroring. Not used by the real project (which has vite/client).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
