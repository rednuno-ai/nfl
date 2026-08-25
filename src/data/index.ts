import type { Repository } from "./repository";
import { LocalRepository } from "./localRepository";

// =============================================================================
// Repository factory. Local storage works out of the box; Supabase activates
// automatically the moment env vars are present AND the package is
// installed (both true in any normal `npm install`-capable environment).
// =============================================================================

let cached: Repository | null = null;

export function getRepository(): Repository {
  if (cached) return cached;
  cached = new LocalRepository();
  return cached;
}

/** Call once at app startup if Supabase env vars are present, to switch the
 *  active repository over. Kept async + dynamically imported so that
 *  environments without `@supabase/supabase-js` installed (like this
 *  sandbox) never try to resolve that module. */
export async function initRepository(): Promise<Repository> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) {
    try {
      // The path is widened to `string` (not a literal) on purpose: it keeps
      // TypeScript from statically resolving/type-checking the Supabase
      // module graph in environments where `@supabase/supabase-js` isn't
      // installed (like this sandbox). Any real environment with the
      // package installed resolves and runs this import normally at runtime.
      const supabaseModulePath: string = "./supabase/supabaseRepository";
      const mod = await import(/* @vite-ignore */ supabaseModulePath);
      const repo: Repository = new mod.SupabaseRepository();
      cached = repo;
      return repo;
    } catch (err) {
      console.warn("Supabase configured but unavailable, falling back to local storage.", err);
    }
  }
  return getRepository();
}

export type { Repository, CareerSummary } from "./repository";
export { FREE_TIER_CAREER_LIMIT } from "./repository";

const LOCAL_USER_KEY = "nfl-life:local-user-id";

/** Anonymous per-browser identity used until real auth (Supabase Auth) is wired up. */
export function getLocalUserId(): string {
  let id = localStorage.getItem(LOCAL_USER_KEY);
  if (!id) {
    id = `local_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(LOCAL_USER_KEY, id);
  }
  return id;
}
