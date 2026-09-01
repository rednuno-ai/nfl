import type { StatLine } from "./types";
import { emptyStatLine } from "./types";

// =============================================================================
// Statistics aggregation helpers — combine per-game StatLines into season and
// career totals. Kept separate from types.ts so it can be tree-shaken/tested
// independently.
// =============================================================================

const NUMERIC_FIELDS: (keyof StatLine)[] = [
  "gamesPlayed",
  "gamesStarted",
  "passAttempts",
  "passCompletions",
  "passYards",
  "passTDs",
  "interceptionsThrown",
  "rushAttempts",
  "rushYards",
  "rushTDs",
  "receptions",
  "receivingYards",
  "receivingTDs",
  "fumbles",
  "tackles",
  "sacks",
  "interceptions",
  "passesDefended",
  "forcedFumbles",
  "blocksWon",
  "fieldGoalAttempts",
  "fieldGoalsMade",
  "extraPointAttempts",
  "extraPointsMade",
  "punts",
  "puntYards",
  "puntsInside20",
];

export function addStatLine(a: StatLine, b: StatLine): StatLine {
  const result: StatLine = { ...a };
  for (const field of NUMERIC_FIELDS) {
    (result[field] as number) = (a[field] as number) + (b[field] as number);
  }
  result.proBowl = a.proBowl || b.proBowl;
  result.allPro = a.allPro || b.allPro;
  result.mvp = a.mvp || b.mvp;
  result.championshipWon = a.championshipWon || b.championshipWon;
  return result;
}

export function sumStatLines(lines: StatLine[], season: number, level: StatLine["level"], teamOrSchoolId: string): StatLine {
  return lines.reduce((acc, line) => addStatLine(acc, line), emptyStatLine(season, level, teamOrSchoolId));
}

export function careerTotals(lines: StatLine[]): StatLine {
  if (lines.length === 0) return emptyStatLine(0, "nfl", "career");
  return lines.reduce((acc, line) => addStatLine(acc, line), emptyStatLine(0, lines[0].level, "career"));
}

export function passerRating(stat: StatLine): number {
  if (stat.passAttempts === 0) return 0;
  const a = Math.max(0, Math.min(2.375, (stat.passCompletions / stat.passAttempts - 0.3) * 5));
  const b = Math.max(0, Math.min(2.375, (stat.passYards / stat.passAttempts - 3) * 0.25));
  const c = Math.max(0, Math.min(2.375, (stat.passTDs / stat.passAttempts) * 20));
  const d = Math.max(0, Math.min(2.375, 2.375 - (stat.interceptionsThrown / stat.passAttempts) * 25));
  return Math.round(((a + b + c + d) / 6) * 100 * 10) / 10;
}

export function yardsPerCarry(stat: StatLine): number {
  return stat.rushAttempts === 0 ? 0 : Math.round((stat.rushYards / stat.rushAttempts) * 10) / 10;
}

export function yardsPerReception(stat: StatLine): number {
  return stat.receptions === 0 ? 0 : Math.round((stat.receivingYards / stat.receptions) * 10) / 10;
}
