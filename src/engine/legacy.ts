import type { LegacyResult, LegacyTier, StatLine } from "./types";
import { careerTotals } from "./stats";

// =============================================================================
// Retirement & Legacy scoring.
// =============================================================================

export interface LegacyInput {
  seasonStats: StatLine[]; // NFL seasons only
  careerEarnings: number;
  netWorth: number;
  draftedRound: number; // 0 = undrafted
  seasonsPlayed: number;
}

export function computeLegacy(input: LegacyInput): LegacyResult {
  const totals = careerTotals(input.seasonStats);
  const gamesPlayed = totals.gamesPlayed;
  const championships = input.seasonStats.filter((s) => s.championshipWon).length;
  const proBowls = input.seasonStats.filter((s) => s.proBowl).length;
  const allPros = input.seasonStats.filter((s) => s.allPro).length;
  const mvps = input.seasonStats.filter((s) => s.mvp).length;

  const productionScore = Math.min(
    100,
    (totals.passYards / 400 + totals.rushYards / 120 + totals.receivingYards / 120 + totals.tackles / 12 + totals.sacks * 2 + totals.interceptions * 4) / 3
  );

  const accoladeScore = proBowls * 6 + allPros * 10 + mvps * 25 + championships * 20;
  const longevityScore = Math.min(30, input.seasonsPlayed * 2.2);
  const undraftedBonus = input.draftedRound === 0 ? 8 : 0;

  const score = Math.round(productionScore * 0.4 + accoladeScore * 0.9 + longevityScore + undraftedBonus);

  let tier: LegacyTier;
  let summary: string;

  if (gamesPlayed < 8) {
    tier = "bust";
    summary = "A career cut short before it ever really got going. The what-ifs will linger.";
  } else if (score >= 140) {
    tier = "hall_of_fame";
    summary = "A career for the history books — a first-ballot Hall of Fame résumé.";
  } else if (score >= 100) {
    tier = "legend";
    summary = "One of the defining players of your era. Your name belongs in the conversation of legends.";
  } else if (score >= 65) {
    tier = "superstar";
    summary = "A superstar who consistently delivered when it mattered most.";
  } else if (score >= 35) {
    tier = "star";
    summary = "A genuine star — the kind of player teams build around.";
  } else if (score >= 12) {
    tier = "solid_career";
    summary = "A solid, respectable NFL career. Not every headline, but plenty of contributions.";
  } else {
    tier = "bust";
    summary = "Never quite lived up to the promise, but you made it to the league and left your mark.";
  }

  return {
    tier,
    score,
    summary,
    seasonsPlayed: input.seasonsPlayed,
    gamesPlayed,
    championships,
    proBowls,
    allPros,
    mvps,
    careerEarnings: input.careerEarnings,
    netWorth: input.netWorth,
  };
}

export const LEGACY_TIER_LABELS: Record<LegacyTier, string> = {
  bust: "Bust",
  solid_career: "Solid Career",
  star: "Star",
  superstar: "Superstar",
  legend: "Legend",
  hall_of_fame: "Hall of Fame",
};
