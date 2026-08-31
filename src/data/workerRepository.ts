import type { CareerState } from "@engine/career";
import { computeOverall } from "@engine/attributes";
import { FREE_TIER_CAREER_LIMIT, type CareerSummary, type Repository } from "./repository";

interface StoredCareer {
  id: string;
  state: CareerState;
  updatedAt: number;
}

interface ApiEnvelope {
  ok?: boolean;
  error?: string;
}

/** Repository for the same-origin Cloudflare Worker API. Authentication is
 * performed by its HttpOnly cookie; userId is retained in this interface only
 * for parity with the local and Supabase repositories. */
export class WorkerRepository implements Repository {
  private async request<T extends ApiEnvelope>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = (await response.json()) as T;
    if (!response.ok || data.ok === false) throw new Error(data.error ?? "The secure save service rejected this request.");
    return data;
  }

  private summary(row: StoredCareer): CareerSummary {
    const state = row.state;
    return {
      id: state.id,
      playerName: `${state.player.bio.firstName} ${state.player.bio.lastName}`,
      position: state.player.position,
      stage: state.stage,
      age: state.player.bio.age,
      overall: computeOverall(state.player.attributes, state.player.position),
      updatedAt: row.updatedAt,
      seed: state.seed,
      referralUnlocked:
        state.currentSeasonGameStats.some((line) => line.gamesPlayed > 0) ||
        state.statHistory.some((line) => line.gamesPlayed > 0) ||
        state.achievements.some((achievement) => achievement.unlockedWeek !== null),
    };
  }

  async listCareers(_userId: string): Promise<CareerSummary[]> {
    const data = await this.request<{ ok: boolean; careers: StoredCareer[] }>("/api/careers");
    return data.careers.map((career) => this.summary(career));
  }

  async loadCareer(_userId: string, careerId: string): Promise<CareerState | null> {
    const data = await this.request<{ ok: boolean; state: CareerState | null }>(`/api/careers/${encodeURIComponent(careerId)}`);
    return data.state;
  }

  async saveCareer(_userId: string, state: CareerState): Promise<void> {
    await this.request(`/api/careers/${encodeURIComponent(state.id)}`, { method: "PUT", body: JSON.stringify({ state }) });
  }

  async deleteCareer(_userId: string, careerId: string): Promise<void> {
    await this.request(`/api/careers/${encodeURIComponent(careerId)}`, { method: "DELETE" });
  }

  async careerLimit(_userId: string): Promise<number> {
    return FREE_TIER_CAREER_LIMIT;
  }
}
