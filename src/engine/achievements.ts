import type { Achievement, StatLine } from "./types";

// =============================================================================
// Achievements — pure evaluation functions run after significant moments
// (game end, season end, contract signed, retirement) against career state.
// =============================================================================

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, "unlockedWeek">[] = [
  { id: "first_nfl_start", title: "First NFL Start", description: "Started your first NFL game." },
  { id: "first_touchdown", title: "First Touchdown", description: "Scored your first NFL touchdown." },
  { id: "pro_bowl", title: "Pro Bowl", description: "Selected to the Pro Bowl." },
  { id: "all_pro", title: "All-Pro", description: "Named an All-Pro." },
  { id: "mvp", title: "MVP", description: "Named league MVP." },
  { id: "super_bowl_champion", title: "Super Bowl Champion", description: "Won the Super Bowl." },
  { id: "comeback_player", title: "Comeback Player", description: "Returned to form after a serious injury." },
  { id: "hall_of_famer", title: "Hall of Famer", description: "Inducted into the Hall of Fame." },
  { id: "hundred_million_career", title: "$100M Career", description: "Earned $100,000,000 in career earnings." },
  { id: "fifteen_seasons", title: "15 Seasons", description: "Played 15 NFL seasons." },
  { id: "undrafted_to_superstar", title: "Undrafted to Superstar", description: "Went undrafted and became a superstar." },
  { id: "one_team_man", title: "One Team Man", description: "Played your entire career with a single team." },
  { id: "journeyman", title: "Journeyman", description: "Played for 4 or more different teams." },
  { id: "comeback_from_injury", title: "Comeback From Injury", description: "Played again after a career-threatening injury." },
];

export function achievementDef(id: string) {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
}

export function initialAchievements(): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((def) => ({ ...def, unlockedWeek: null }));
}

export function unlock(achievements: Achievement[], id: string, week: number): Achievement[] {
  return achievements.map((a) => (a.id === id && a.unlockedWeek === null ? { ...a, unlockedWeek: week } : a));
}

export function checkGameAchievements(
  achievements: Achievement[],
  week: number,
  wasStarter: boolean,
  gameStat: StatLine,
  isFirstCareerGame: boolean
): Achievement[] {
  let next = achievements;
  if (isFirstCareerGame && wasStarter) next = unlock(next, "first_nfl_start", week);
  if (gameStat.passTDs + gameStat.rushTDs + gameStat.receivingTDs > 0) next = unlock(next, "first_touchdown", week);
  return next;
}

export function checkCareerEarningsAchievement(achievements: Achievement[], week: number, totalCareerEarnings: number): Achievement[] {
  if (totalCareerEarnings >= 100_000_000) return unlock(achievements, "hundred_million_career", week);
  return achievements;
}

export function checkSeasonsAchievement(achievements: Achievement[], week: number, seasonsPlayed: number): Achievement[] {
  if (seasonsPlayed >= 15) return unlock(achievements, "fifteen_seasons", week);
  return achievements;
}

export function checkTeamHistoryAchievements(achievements: Achievement[], week: number, teamsPlayedFor: Set<string>, retired: boolean): Achievement[] {
  let next = achievements;
  if (teamsPlayedFor.size >= 4) next = unlock(next, "journeyman", week);
  if (retired && teamsPlayedFor.size === 1) next = unlock(next, "one_team_man", week);
  return next;
}
