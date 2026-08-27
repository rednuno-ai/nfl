import { TEAMS, getTeam } from "../teams";
import { COLLEGES, getCollege } from "../colleges";
import type { RNG } from "../rng";

// =============================================================================
// Season scheduling & standings helpers. Kept deliberately lightweight for
// the MVP: full divisional scheduling logic can be layered on later without
// touching the career state machine, which only consumes ScheduleEntry[].
// =============================================================================

export interface ScheduleEntry {
  week: number;
  opponentId: string;
  opponentLabel: string;
  isHome: boolean;
  played: boolean;
}

const FICTIONAL_HIGH_SCHOOLS = [
  "Cedar Hill High", "Northgate Prep", "Ridgeview High", "Lakeside Academy", "Union High",
  "Franklin High", "Riverside High", "Central High", "Oakmont High", "Westbrook High",
  "Southridge High", "Trinity Prep",
];

export function generateHighSchoolSchedule(rng: RNG, weeks = 10): ScheduleEntry[] {
  const opponents = rng.shuffle(FICTIONAL_HIGH_SCHOOLS).slice(0, weeks);
  return opponents.map((label, i) => ({
    week: i + 1,
    opponentId: `hs_opponent_${i}`,
    opponentLabel: label,
    isHome: i % 2 === 0,
    played: false,
  }));
}

export function generateCollegeSchedule(ownCollegeId: string, rng: RNG, weeks = 12): ScheduleEntry[] {
  const pool = COLLEGES.filter((c) => c.id !== ownCollegeId);
  const opponents = rng.shuffle(pool).slice(0, weeks);
  return opponents.map((college, i) => ({
    week: i + 1,
    opponentId: college.id,
    opponentLabel: `${college.name} ${college.mascot}`,
    isHome: i % 2 === 0,
    played: false,
  }));
}

export function generateNFLSchedule(ownTeamId: string, rng: RNG, weeks = 17): ScheduleEntry[] {
  const pool = TEAMS.filter((t) => t.id !== ownTeamId);
  const shuffled = rng.shuffle(pool);
  const opponents: typeof pool = [];
  while (opponents.length < weeks) {
    opponents.push(...shuffled);
  }
  return opponents.slice(0, weeks).map((team, i) => ({
    week: i + 1,
    opponentId: team.id,
    opponentLabel: `${team.city} ${team.name}`,
    isHome: i % 2 === 0,
    played: false,
  }));
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  ties: number;
}

export function emptyRecord(): SeasonRecord {
  return { wins: 0, losses: 0, ties: 0 };
}

export function recordResult(record: SeasonRecord, result: "win" | "loss" | "tie"): SeasonRecord {
  return {
    wins: record.wins + (result === "win" ? 1 : 0),
    losses: record.losses + (result === "loss" ? 1 : 0),
    ties: record.ties + (result === "tie" ? 1 : 0),
  };
}

export function winPct(record: SeasonRecord): number {
  const total = record.wins + record.losses + record.ties;
  return total === 0 ? 0 : (record.wins + record.ties * 0.5) / total;
}

/** Simplified playoff qualification: better records and higher team prestige
 *  both help. This avoids simulating all 31 other teams' full seasons for MVP. */
export function qualifiesForPlayoffs(record: SeasonRecord, teamPrestige: number, rng: RNG): boolean {
  const pct = winPct(record);
  if (pct < 0.4) return false;
  if (pct >= 0.7) return true;
  const chance = clampChance(pct * 0.6 + (teamPrestige / 100) * 0.3);
  return rng.chance(chance);
}

function clampChance(v: number): number {
  return Math.max(0.05, Math.min(0.95, v));
}

export type PlayoffRoundName = "Wild Card" | "Divisional" | "Conference Championship" | "Super Bowl";

export interface PlayoffRoundResult {
  round: PlayoffRoundName;
  opponentLabel: string;
  won: boolean;
  scorePlayer: number;
  scoreOpponent: number;
}

const ROUNDS: PlayoffRoundName[] = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

/** Resolves a full playoff bracket run for the player's team as a sequence of
 *  single-elimination rounds. Stops at the first loss. Returns whether the
 *  Super Bowl was won. Uses team overall quality + a talent factor from the
 *  player's overall rating as a light proxy for roster strength — an
 *  MVP-caliber player nudges their team's playoff odds up over a
 *  bench-level teammate on the identical roster, without letting one player
 *  single-handedly overwhelm 52 other guys' worth of team quality. */
export function simulatePlayoffRun(teamOverall: number, rng: RNG, playerOverall = teamOverall): { rounds: PlayoffRoundResult[]; wonSuperBowl: boolean } {
  const effectiveOverall = teamOverall * 0.85 + playerOverall * 0.15;
  const rounds: PlayoffRoundResult[] = [];
  for (const round of ROUNDS) {
    const opponentQuality = 45 + rng.next() * 45;
    const winProb = clampChance(0.5 + (effectiveOverall - opponentQuality) / 120);
    const won = rng.chance(winProb);
    const scorePlayer = 14 + Math.floor(rng.next() * 24);
    const scoreOpponent = won ? scorePlayer - (3 + Math.floor(rng.next() * 14)) : scorePlayer + (1 + Math.floor(rng.next() * 14));
    rounds.push({
      round,
      opponentLabel: pickOpponentLabel(rng),
      won,
      scorePlayer,
      scoreOpponent: Math.max(0, scoreOpponent),
    });
    if (!won) break;
  }
  return { rounds, wonSuperBowl: rounds.length === ROUNDS.length && rounds[rounds.length - 1].won };
}

function pickOpponentLabel(rng: RNG): string {
  const team = rng.pick(TEAMS);
  return `${team.city} ${team.name}`;
}

export { getTeam, getCollege };
