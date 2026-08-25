import type { Player, Position, StatLine, Team } from "../types";
import { emptyStatLine } from "../types";
import { clamp, RNG } from "../rng";

// =============================================================================
// Game Day simulation engine.
// -----------------------------------------------------------------------------
// Design goal (per spec item 15/16): NOT a full X's-and-O's simulator. Instead,
// the game is broken into a sequence of possessions. Most resolve
// automatically from a probability model driven by attributes, fatigue,
// confidence, coaching, and opponent quality. A handful of *key moments* —
// high-leverage, late-game situations — pause the simulation and hand control
// to the player: "decision -> execution -> consequence", exactly as spec'd.
//
// The whole thing is a pure step function: `beginGame` sets up state and runs
// until the first pause or final whistle; `advanceGame` resumes it, consuming
// a decision if one is pending. This makes it trivial to unit test.
// =============================================================================

export type RiskLevel = "safe" | "balanced" | "aggressive";

export interface KeyMomentOption {
  id: string;
  label: string;
  description: string;
  riskLevel: RiskLevel;
}

export interface KeyMomentPrompt {
  possessionIndex: number;
  quarter: number;
  clockLabel: string;
  down: number;
  distance: number;
  fieldPosition: number; // 0-100, own end zone to opponent's
  scorePlayer: number;
  scoreOpponent: number;
  side: "offense" | "defense";
  situation: string;
  options: KeyMomentOption[];
}

export interface PossessionLogEntry {
  possessionIndex: number;
  quarter: number;
  text: string;
  playerInvolved: boolean;
}

export interface GameSimState {
  week: number;
  teamId: string;
  opponentId: string;
  opponentName: string;
  totalPossessions: number;
  possessionIndex: number; // next possession to resolve
  quarter: number;
  scorePlayer: number;
  scoreOpponent: number;
  fatigue: number; // 0-100, rises through the game
  confidence: number; // 0-100, mirrors but is independent of season-level confidence
  stat: StatLine;
  log: PossessionLogEntry[];
  pendingDecision: KeyMomentPrompt | null;
  finished: boolean;
  result: "win" | "loss" | "tie" | null;
  keyMomentsResolved: number;
}

export interface BeginGameInput {
  player: Player;
  overall: number;
  team: Team;
  opponent: Team;
  week: number;
  season: number;
  homeAdvantage: boolean;
}

const OFFENSE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "OL"];
const DEFENSE_POSITIONS: Position[] = ["LB", "CB", "S", "DL"];

function playerSide(position: Position): "offense" | "defense" | "special" {
  if (OFFENSE_POSITIONS.includes(position)) return "offense";
  if (DEFENSE_POSITIONS.includes(position)) return "defense";
  return "special";
}

function teamRating(team: Team, side: "offense" | "defense", playerBoostSide: "offense" | "defense" | "special", overall: number): number {
  const base = team.rosterStrength * 0.5 + team.coachingQuality * 0.25 + 12;
  const boosted = playerBoostSide === side;
  const boost = boosted ? overall * 0.32 : team.rosterStrength * 0.1;
  return clamp(base + boost, 20, 99);
}

// Key-moment density: most of the player's own possessions become an
// interactive decision (up to a per-game cap) rather than a handful of fixed
// late-game slots, so a full game plays out as a real sequence of
// decision -> execution -> consequence beats instead of mostly auto-sim.
const KEY_MOMENT_CHANCE = 0.9;
const MAX_KEY_MOMENTS_PER_GAME = 20;

export function beginGame(input: BeginGameInput, rng: RNG): GameSimState {
  const totalPossessions = 24 + Math.floor(rng.next() * 13); // 24-36 — a longer, more decision-dense game (see GAME_DESIGN.md §5)
  const state: GameSimState = {
    week: input.week,
    teamId: input.team.id,
    opponentId: input.opponent.id,
    opponentName: `${input.opponent.city} ${input.opponent.name}`,
    totalPossessions,
    possessionIndex: 0,
    quarter: 1,
    scorePlayer: 0,
    scoreOpponent: 0,
    fatigue: 0,
    confidence: clamp(input.player.attributes.general.confidence, 20, 90),
    stat: emptyStatLine(input.season, "nfl", input.team.id),
    log: [],
    pendingDecision: null,
    finished: false,
    result: null,
    keyMomentsResolved: 0,
  };
  return advanceGame(state, input, rng);
}

export function advanceGame(state: GameSimState, input: BeginGameInput, rng: RNG, decisionOptionId?: string): GameSimState {
  let next: GameSimState = { ...state, log: [...state.log], stat: { ...state.stat } };

  // If a decision was pending, resolve it first using the supplied choice.
  if (next.pendingDecision) {
    if (!decisionOptionId) return next; // still waiting on the caller
    next = resolvePossession(next, input, rng, next.pendingDecision, decisionOptionId);
    next.pendingDecision = null;
    next.keyMomentsResolved += 1;
    next.possessionIndex += 1;
  }

  while (next.possessionIndex < next.totalPossessions) {
    next.quarter = Math.min(4, 1 + Math.floor((next.possessionIndex / next.totalPossessions) * 4));
    next.fatigue = clamp(next.fatigue + 100 / next.totalPossessions, 0, 100);

    const side = playerSide(input.player.position);
    const isOffensivePossession = next.possessionIndex % 2 === 0; // alternate; player's team gets even indices
    const relevantSide: "offense" | "defense" = isOffensivePossession ? "offense" : "defense";

    const playerInvolvedInThisSide = side === relevantSide;

    if (playerInvolvedInThisSide && next.keyMomentsResolved < MAX_KEY_MOMENTS_PER_GAME && rng.chance(KEY_MOMENT_CHANCE)) {
      next.pendingDecision = buildKeyMomentPrompt(next, input, relevantSide, rng);
      return next; // pause for player input
    }

    next = resolvePossession(next, input, rng, null, undefined);
    next.possessionIndex += 1;
  }

  next.finished = true;
  next.result = next.scorePlayer > next.scoreOpponent ? "win" : next.scorePlayer < next.scoreOpponent ? "loss" : "tie";
  return next;
}

const DOWN_LABELS = ["1st", "2nd", "3rd", "4th"];

function buildKeyMomentPrompt(state: GameSimState, input: BeginGameInput, side: "offense" | "defense", rng: RNG): KeyMomentPrompt {
  const clockLabel = `${["1st", "2nd", "3rd", "4th"][state.quarter - 1]} quarter`;
  const down = 1 + Math.floor(rng.next() * 4);
  const distance = down >= 3 ? 4 + Math.floor(rng.next() * 7) : 2 + Math.floor(rng.next() * 9);
  const trailing = state.scorePlayer < state.scoreOpponent;
  const situation =
    state.quarter >= 3
      ? `${DOWN_LABELS[down - 1]} & ${distance}, ${state.quarter === 4 ? "under 3 minutes left" : "second half"}, ${
          trailing ? `trailing ${state.scoreOpponent - state.scorePlayer}` : "the game is close"
        }.`
      : `${DOWN_LABELS[down - 1]} & ${distance} in the ${clockLabel.toLowerCase()}.`;

  return {
    possessionIndex: state.possessionIndex,
    quarter: state.quarter,
    clockLabel,
    down,
    distance,
    fieldPosition: 30 + Math.floor(rng.next() * 40),
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    side,
    situation,
    options: getKeyMomentOptions(input.player.position, side),
  };
}

export function getKeyMomentOptions(position: Position, side: "offense" | "defense"): KeyMomentOption[] {
  if (side === "offense") {
    if (position === "QB") {
      return [
        { id: "safe_check_down", label: "Check it down", description: "Take the safe, short completion.", riskLevel: "safe" },
        { id: "audible_run", label: "Audible to a run", description: "Trust your line to get the tough yards.", riskLevel: "balanced" },
        { id: "shot_downfield", label: "Take a shot deep", description: "Push it downfield to your top target.", riskLevel: "aggressive" },
      ];
    }
    if (position === "RB") {
      return [
        { id: "safe_inside", label: "Grind it up the middle", description: "Trust your blocking for a reliable gain.", riskLevel: "safe" },
        { id: "bounce_outside", label: "Bounce it outside", description: "Look for a crease to the edge.", riskLevel: "balanced" },
        { id: "break_it", label: "Try to break one", description: "Go for the home-run cutback.", riskLevel: "aggressive" },
      ];
    }
    if (position === "WR" || position === "TE") {
      return [
        { id: "safe_route", label: "Run the safe route", description: "Get open underneath and secure the catch.", riskLevel: "safe" },
        { id: "work_middle", label: "Work the middle", description: "Find space between the numbers.", riskLevel: "balanced" },
        { id: "sell_out_deep", label: "Sell out for the deep ball", description: "Take your shot on the go route.", riskLevel: "aggressive" },
      ];
    }
    return [
      { id: "safe_execute", label: "Execute the called play", description: "Do your job, nothing fancy.", riskLevel: "safe" },
      { id: "extra_effort", label: "Give extra effort", description: "Push for more than the play calls for.", riskLevel: "aggressive" },
    ];
  }

  // Defense
  if (position === "LB") {
    return [
      { id: "play_gap", label: "Play your gap", description: "Stay disciplined against the run.", riskLevel: "safe" },
      { id: "blitz", label: "Bring the blitz", description: "Attack the backfield.", riskLevel: "aggressive" },
      { id: "drop_coverage", label: "Drop into coverage", description: "Read the quarterback's eyes.", riskLevel: "balanced" },
    ];
  }
  if (position === "CB") {
    return [
      { id: "play_zone", label: "Sit in zone", description: "Keep everything in front of you.", riskLevel: "safe" },
      { id: "press_man", label: "Press at the line", description: "Get physical and disrupt the route.", riskLevel: "balanced" },
      { id: "jump_route", label: "Jump the route", description: "Gamble for the interception.", riskLevel: "aggressive" },
    ];
  }
  return [
    { id: "safe_assignment", label: "Play your assignment", description: "Stay sound, avoid the big play.", riskLevel: "safe" },
    { id: "gamble", label: "Gamble for a big play", description: "Sell out for the turnover.", riskLevel: "aggressive" },
  ];
}

interface RiskModifier {
  successBonus: number;
  turnoverBonus: number;
  bigPlayBonus: number;
}

const RISK_MODIFIERS: Record<RiskLevel, RiskModifier> = {
  safe: { successBonus: 0.06, turnoverBonus: -0.03, bigPlayBonus: -0.05 },
  balanced: { successBonus: 0.0, turnoverBonus: 0.0, bigPlayBonus: 0.0 },
  aggressive: { successBonus: -0.03, turnoverBonus: 0.05, bigPlayBonus: 0.14 },
};

function resolvePossession(
  state: GameSimState,
  input: BeginGameInput,
  rng: RNG,
  decision: KeyMomentPrompt | null,
  decisionOptionId?: string
): GameSimState {
  const { player, team, opponent, overall } = input;
  const side = playerSide(player.position);
  const isOffensivePossession = decision ? decision.side === "offense" : state.possessionIndex % 2 === 0;

  const offenseTeam = isOffensivePossession ? team : opponent;
  const defenseTeam = isOffensivePossession ? opponent : team;
  const offenseRating = teamRating(offenseTeam, "offense", isOffensivePossession ? side : "special", overall);
  const defenseRating = teamRating(defenseTeam, "defense", !isOffensivePossession ? side : "special", overall);

  const fatiguePenalty = (state.fatigue / 100) * 6;
  const confidenceBonus = ((state.confidence - 50) / 50) * 5;
  const pressureAdj = state.quarter === 4 ? (player.attributes.mental.pressure - 50) / 50 * 4 : 0;

  let modifier: RiskModifier = { successBonus: 0, turnoverBonus: 0, bigPlayBonus: 0 };
  const involved = (isOffensivePossession && side === "offense") || (!isOffensivePossession && side === "defense");
  if (decision && decisionOptionId) {
    const chosen = decision.options.find((o) => o.id === decisionOptionId) ?? decision.options[0];
    modifier = RISK_MODIFIERS[chosen.riskLevel];
  }

  const ratingDiff = offenseRating - defenseRating;
  let scoreProb = clamp(0.42 + ratingDiff / 130 - fatiguePenalty / 100 + confidenceBonus / 100 + pressureAdj / 100 + modifier.successBonus, 0.1, 0.85);
  const turnoverProb = clamp(0.14 - ratingDiff / 260 + modifier.turnoverBonus, 0.03, 0.35);
  const bigPlayProb = clamp(0.18 + ratingDiff / 200 + modifier.bigPlayBonus, 0.05, 0.55);

  const roll = rng.next();
  let outcome: "touchdown" | "field_goal" | "turnover" | "punt";
  let scoringTeam: "player" | "opponent" | null = null;

  if (roll < turnoverProb) {
    outcome = "turnover";
  } else if (roll < turnoverProb + scoreProb) {
    const bigPlay = rng.chance(bigPlayProb);
    outcome = bigPlay || rng.chance(0.55) ? "touchdown" : "field_goal";
  } else {
    outcome = "punt";
  }

  let text = "";
  const teamLabel = (isOffensivePossession ? `${team.city} ${team.name}` : `${opponent.city} ${opponent.name}`).replace(/\s+/g, " ").trim();

  if (outcome === "touchdown") {
    if (isOffensivePossession) {
      state.scorePlayer += 7;
      scoringTeam = "player";
    } else {
      state.scoreOpponent += 7;
      scoringTeam = "opponent";
    }
    text = `${teamLabel} drive ends in a touchdown.`;
  } else if (outcome === "field_goal") {
    if (isOffensivePossession) {
      state.scorePlayer += 3;
      scoringTeam = "player";
    } else {
      state.scoreOpponent += 3;
      scoringTeam = "opponent";
    }
    text = `${teamLabel} settle for a field goal.`;
  } else if (outcome === "turnover") {
    text = `${teamLabel} turn the ball over.`;
  } else {
    text = `${teamLabel} are forced to punt.`;
  }

  const stat = { ...state.stat };
  if (involved) {
    applyStatContribution(stat, player.position, outcome, isOffensivePossession, rng);
  }
  stat.gamesPlayed = 1;

  const confidenceDelta = scoringTeam === "player" ? 3 : scoringTeam === "opponent" ? -2 : outcome === "turnover" ? -4 : 0;

  return {
    ...state,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    confidence: clamp(state.confidence + confidenceDelta, 5, 99),
    stat,
    log: [...state.log, { possessionIndex: state.possessionIndex, quarter: state.quarter, text, playerInvolved: involved }],
  };
}

function applyStatContribution(stat: StatLine, position: Position, outcome: string, isOffensivePossession: boolean, rng: RNG) {
  if (isOffensivePossession) {
    if (position === "QB") {
      const attempts = 3 + Math.floor(rng.next() * 4);
      const completions = Math.round(attempts * (0.55 + rng.next() * 0.25));
      const yards = completions * (7 + Math.floor(rng.next() * 8));
      stat.passAttempts += attempts;
      stat.passCompletions += completions;
      stat.passYards += yards;
      if (outcome === "touchdown") stat.passTDs += 1;
      if (outcome === "turnover" && rng.chance(0.6)) stat.interceptionsThrown += 1;
    } else if (position === "RB") {
      if (rng.chance(0.55)) {
        const carries = 1 + Math.floor(rng.next() * 3);
        const yards = carries * (2 + Math.floor(rng.next() * 6));
        stat.rushAttempts += carries;
        stat.rushYards += yards;
        if (outcome === "touchdown" && rng.chance(0.6)) stat.rushTDs += 1;
      } else if (rng.chance(0.4)) {
        stat.receptions += 1;
        stat.receivingYards += 3 + Math.floor(rng.next() * 8);
      }
      if (outcome === "turnover" && rng.chance(0.3)) stat.fumbles += 1;
    } else if (position === "WR" || position === "TE") {
      if (rng.chance(0.4)) {
        const yards = 6 + Math.floor(rng.next() * 20);
        stat.receptions += 1;
        stat.receivingYards += yards;
        if (outcome === "touchdown" && rng.chance(0.45)) stat.receivingTDs += 1;
      }
    }
  } else {
    if (position === "LB") {
      stat.tackles += 1 + Math.floor(rng.next() * 3);
      if (rng.chance(0.12)) stat.sacks += 1;
      if (outcome === "turnover" && rng.chance(0.25)) stat.interceptions += 1;
    } else if (position === "CB") {
      if (rng.chance(0.4)) stat.tackles += 1;
      if (rng.chance(0.15)) stat.passesDefended += 1;
      if (outcome === "turnover" && rng.chance(0.35)) stat.interceptions += 1;
    } else {
      stat.tackles += rng.chance(0.5) ? 1 : 0;
    }
  }
}
