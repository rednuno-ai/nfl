import type { Position, StatLine } from "./types";

// Player-centric goals make each game more legible: one clear challenge,
// tailored to the position, and a modest reward that never overwhelms the
// regular progression system. They are deterministic from position + week so
// UI and simulation can independently arrive at the same mission.
export interface GameDayObjective {
  id: string;
  title: string;
  description: string;
  rewardLabel: string;
  target: number;
  progress: (stat: StatLine) => number;
}

const objective = (id: string, title: string, description: string, target: number, progress: (stat: StatLine) => number): GameDayObjective => ({
  id,
  title,
  description,
  target,
  progress,
  rewardLabel: "+3 confidence · +1 fame",
});

export function getGameDayObjective(position: Position, week: number): GameDayObjective {
  const rotation = Math.abs(week) % 2;
  switch (position) {
    case "QB":
      return rotation === 0
        ? objective("qb_precision", "Own the pocket", "Complete 16 passes.", 16, (stat) => stat.passCompletions)
        : objective("qb_explosive", "Move the chains", "Throw for 225 yards.", 225, (stat) => stat.passYards);
    case "RB":
      return rotation === 0
        ? objective("rb_ground", "Set the tempo", "Rush for 65 yards.", 65, (stat) => stat.rushYards)
        : objective("rb_total", "Two-way threat", "Create 85 yards from scrimmage.", 85, (stat) => stat.rushYards + stat.receivingYards);
    case "WR":
    case "TE":
      return rotation === 0
        ? objective("receiver_volume", "Be the answer", "Make 5 receptions.", 5, (stat) => stat.receptions)
        : objective("receiver_yards", "Find the space", "Record 65 receiving yards.", 65, (stat) => stat.receivingYards);
    case "DL":
      return rotation === 0
        ? objective("dl_pressure", "Collapse the pocket", "Record 1 sack.", 1, (stat) => stat.sacks)
        : objective("dl_disrupt", "Disrupt the drive", "Make 4 tackles.", 4, (stat) => stat.tackles);
    case "LB":
      return rotation === 0
        ? objective("lb_sideline", "Sideline to sideline", "Make 6 tackles.", 6, (stat) => stat.tackles)
        : objective("lb_impact", "Create a negative play", "Record 1 sack or interception.", 1, (stat) => stat.sacks + stat.interceptions);
    case "CB":
    case "S":
      return rotation === 0
        ? objective("db_lockdown", "Close the window", "Break up 2 passes.", 2, (stat) => stat.passesDefended)
        : objective("db_takeaway", "Flip the field", "Record 1 interception.", 1, (stat) => stat.interceptions);
    default:
      return rotation === 0
        ? objective("team_clean", "Play clean", "Finish without a fumble.", 1, (stat) => (stat.fumbles === 0 ? 1 : 0))
        : objective("team_finish", "Finish the job", "Win the game.", 1, (_stat) => 0);
  }
}

export function isGameDayObjectiveComplete(objective: GameDayObjective, stat: StatLine, gameResult: "win" | "loss" | "tie" | null): boolean {
  if (objective.id === "team_finish") return gameResult === "win";
  return objective.progress(stat) >= objective.target;
}

export function objectiveProgress(objective: GameDayObjective, stat: StatLine): number {
  return Math.max(0, Math.min(objective.target, objective.progress(stat)));
}
