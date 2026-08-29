import type { CareerState } from "@engine/career";
import { computeOverall } from "@engine/attributes";
import type { CareerSummary, Repository } from "./repository";
import { FREE_TIER_CAREER_LIMIT } from "./repository";

// =============================================================================
// localStorage-backed Repository. This is what GRIDIRON LIFE runs on today (no
// backend required to play end-to-end). Storage layout:
//   nfl-life:index:{userId}        -> string[] of career ids
//   nfl-life:career:{careerId}     -> full CareerState JSON
// =============================================================================

const INDEX_KEY = (userId: string) => `nfl-life:index:${userId}`;
const CAREER_KEY = (careerId: string) => `nfl-life:career:${careerId}`;
const UPDATED_KEY = (careerId: string) => `nfl-life:career-updated:${careerId}`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getIndex(userId: string): string[] {
  return safeParse<string[]>(localStorage.getItem(INDEX_KEY(userId)), []);
}

function setIndex(userId: string, ids: string[]): void {
  localStorage.setItem(INDEX_KEY(userId), JSON.stringify(Array.from(new Set(ids))));
}

export class LocalRepository implements Repository {
  async listCareers(userId: string): Promise<CareerSummary[]> {
    const ids = getIndex(userId);
    const summaries: CareerSummary[] = [];
    for (const id of ids) {
      const state = safeParse<CareerState | null>(localStorage.getItem(CAREER_KEY(id)), null);
      if (!state) continue;
      const updatedAt = Number(localStorage.getItem(UPDATED_KEY(id)) ?? 0);
      summaries.push({
        id: state.id,
        playerName: `${state.player.bio.firstName} ${state.player.bio.lastName}`,
        position: state.player.position,
        stage: state.stage,
        age: state.player.bio.age,
        overall: computeOverall(state.player.attributes, state.player.position),
        updatedAt,
        seed: state.seed,
        referralUnlocked:
          state.currentSeasonGameStats.some((line) => line.gamesPlayed > 0) ||
          state.statHistory.some((line) => line.gamesPlayed > 0) ||
          state.achievements.some((achievement) => achievement.unlockedWeek !== null),
      });
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async loadCareer(_userId: string, careerId: string): Promise<CareerState | null> {
    return safeParse<CareerState | null>(localStorage.getItem(CAREER_KEY(careerId)), null);
  }

  async saveCareer(userId: string, state: CareerState): Promise<void> {
    localStorage.setItem(CAREER_KEY(state.id), JSON.stringify(state));
    localStorage.setItem(UPDATED_KEY(state.id), String(Date.now()));
    const ids = getIndex(userId);
    if (!ids.includes(state.id)) setIndex(userId, [...ids, state.id]);
  }

  async deleteCareer(userId: string, careerId: string): Promise<void> {
    localStorage.removeItem(CAREER_KEY(careerId));
    localStorage.removeItem(UPDATED_KEY(careerId));
    setIndex(userId, getIndex(userId).filter((id) => id !== careerId));
  }

  async careerLimit(_userId: string): Promise<number> {
    // Local mode has no billing; treat everyone as free tier until Supabase
    // + subscription state exists (see item 50).
    return FREE_TIER_CAREER_LIMIT;
  }
}
