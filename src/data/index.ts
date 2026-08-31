import type { Repository } from "./repository";
import { LocalRepository } from "./localRepository";
import { WorkerRepository } from "./workerRepository";

// =============================================================================
// Repository factory. The published Worker is the default source of truth;
// Supabase stays an explicit optional integration and localStorage is only
// used for Vite/offline development.
// =============================================================================

let cached: Repository | null = null;

export function getRepository(): Repository {
  if (cached) return cached;
  cached = shouldUseWorkerPersistence() ? new WorkerRepository() : new LocalRepository();
  return cached;
}

function shouldUseWorkerPersistence(): boolean {
  if (typeof window === "undefined") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
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
  if (shouldUseWorkerPersistence()) {
    cached = new WorkerRepository();
    return cached;
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
