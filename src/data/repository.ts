import type { CareerState } from "@engine/career";

// =============================================================================
// Repository abstraction — the ONLY interface the UI/store talks to for
// persistence. Two implementations exist:
//   - WorkerRepository  (src/data/workerRepository.ts) — published default;
//     authenticated, durable server-side storage in the Cloudflare Worker.
//   - LocalRepository   (src/data/localRepository.ts)  — Vite/offline fallback.
//   - SupabaseRepository (src/data/supabase/*)          — optional external sync,
//     wired up the moment `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set
//     and `npm install` has fetched `@supabase/supabase-js` in a normal
//     (non-sandboxed) environment.
//
// Swapping implementations never touches engine or UI code — see
// src/data/index.ts for the selection logic.
// =============================================================================

export interface CareerSummary {
  id: string;
  playerName: string;
  position: string;
  stage: string;
  age: number;
  overall: number;
  updatedAt: number;
  seed: number;
  /** Invite sharing is a post-play reward, not an immediate account prompt. */
  referralUnlocked: boolean;
}

export interface Repository {
  /** Lists every saved career for the current user, most recently updated first. */
  listCareers(userId: string): Promise<CareerSummary[]>;
  /** Loads a full CareerState by id, or null if it doesn't exist / isn't owned by this user. */
  loadCareer(userId: string, careerId: string): Promise<CareerState | null>;
  /** Creates or overwrites a career's saved state (autosave-friendly: cheap, idempotent). */
  saveCareer(userId: string, state: CareerState): Promise<void>;
  /** Permanently deletes a saved career. */
  deleteCareer(userId: string, careerId: string): Promise<void>;
  /** Returns the maximum number of concurrent careers this user's plan allows (see item 50: monetization). */
  careerLimit(userId: string): Promise<number>;
}

export const FREE_TIER_CAREER_LIMIT = 2;
