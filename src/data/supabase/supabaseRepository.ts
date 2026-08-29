import type { CareerState } from "@engine/career";
import { computeOverall } from "@engine/attributes";
import type { CareerSummary, Repository } from "../repository";
import { getSupabaseClient } from "./client";

// =============================================================================
// Supabase-backed Repository.
// -----------------------------------------------------------------------------
// Design choice: rather than exploding CareerState across a dozen normalized
// tables on every autosave (chatty, slow, and easy to get out of sync), the
// `careers` table stores the full simulation state as JSONB in `state`,
// while promoting the handful of fields we need for fast list queries, RLS,
// and (later) leaderboards/analytics into real columns. See
// DATABASE_SCHEMA.md for the full rationale and the normalized tables this
// still keeps for anything that needs to be queried/joined independently
// (achievements, news, stat lines for cross-career leaderboards, etc).
//
// This file is NOT imported anywhere by default — see src/data/index.ts. It
// is correct against the documented supabase-js v2 API but cannot be
// executed in this sandbox (no package registry access to install the
// client library). Wire it up by setting VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
// =============================================================================

interface CareerRow {
  id: string;
  user_id: string;
  player_name: string;
  position: string;
  stage: string;
  age: number;
  overall: number;
  updated_at: string;
  state: CareerState;
}

export class SupabaseRepository implements Repository {
  async listCareers(userId: string): Promise<CareerSummary[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("careers")
      .select("id, player_name, position, stage, age, overall, updated_at, state")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as CareerRow[]).map((row) => ({
      id: row.id,
      playerName: row.player_name,
      position: row.position,
      stage: row.stage,
      age: row.age,
      overall: row.overall,
      updatedAt: new Date(row.updated_at).getTime(),
      seed: row.state.seed,
      referralUnlocked:
        row.state.currentSeasonGameStats.some((line) => line.gamesPlayed > 0) ||
        row.state.statHistory.some((line) => line.gamesPlayed > 0) ||
        row.state.achievements.some((achievement) => achievement.unlockedWeek !== null),
    }));
  }

  async loadCareer(userId: string, careerId: string): Promise<CareerState | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("careers").select("state").eq("user_id", userId).eq("id", careerId).maybeSingle();
    if (error) throw error;
    return (data?.state as CareerState) ?? null;
  }

  async saveCareer(userId: string, state: CareerState): Promise<void> {
    const supabase = getSupabaseClient();
    const row = {
      id: state.id,
      user_id: userId,
      player_name: `${state.player.bio.firstName} ${state.player.bio.lastName}`,
      position: state.player.position,
      stage: state.stage,
      age: state.player.bio.age,
      overall: computeOverall(state.player.attributes, state.player.position),
      updated_at: new Date().toISOString(),
      state,
    };
    const { error } = await supabase.from("careers").upsert(row, { onConflict: "id" });
    if (error) throw error;
  }

  async deleteCareer(userId: string, careerId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("careers").delete().eq("user_id", userId).eq("id", careerId);
    if (error) throw error;
  }

  async careerLimit(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from("subscriptions").select("tier").eq("user_id", userId).maybeSingle();
    return data?.tier === "premium" ? Number.POSITIVE_INFINITY : 2;
  }
}
