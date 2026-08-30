import type { Player, PersonalityTrait, Position, StatLine, Team } from "../types";
import { emptyStatLine } from "../types";
import { clamp, RNG } from "../rng";

// =============================================================================
// Game Day simulation engine — play-by-play, NFL-rules model.
// -----------------------------------------------------------------------------
// The game is simulated one real down at a time: down, distance, field
// position (0-100, own goal line to opponent's goal line, from the CURRENT
// offense's perspective), and a real game clock (four 15:00 quarters, plus
// sudden-death overtime) all advance play by play for BOTH teams. Most plays
// resolve automatically from a probability model driven by attributes,
// fatigue, confidence, coaching, opponent quality, and the defense's read of
// the offense's recent tendencies. High-leverage snaps — 3rd/4th down, red
// zone, two-minute drill, a close 4th quarter — pause the sim and hand the
// player a real decision: play call -> (sometimes) a target read -> outcome.
// When the player is on defense, the same high-leverage snaps hand them a
// coverage/blitz call instead.
//
// `beginGame` sets up kickoff and runs until the first decision or the final
// whistle; `advanceGame` resumes it, consuming a decision if one is pending.
// Everything is a pure function of (state, input, rng, choice) so the whole
// thing stays trivially unit-testable and fully deterministic for a given
// seed + set of choices.
// =============================================================================

export type RiskLevel = "safe" | "balanced" | "aggressive";

export type PlayType = "run" | "short_pass" | "deep_pass" | "play_action" | "qb_scramble" | "trick_play";
export type TargetPriority = "wr1" | "te" | "checkdown" | "mismatch" | "let_qb_decide";
export type DefenseCall = "cover2" | "cover3" | "man" | "blitz" | "double_wr1";
export type MomentKind = "play_call" | "defense_look" | "target_priority" | "defense_call" | "fourth_down_approach" | "fourth_down" | "two_point";
/** A lightweight "vibe" read on the player's own team's last few notable offensive
 *  snaps — not a hard stat, just narrative texture (see spec point 9, "Momentum"). */
export type MomentumState = "hot_streak" | "shaken" | "neutral";

export interface KeyMomentOption {
  id: string;
  label: string;
  description: string;
  riskLevel: RiskLevel;
  icon: string;
}

export interface DefenseIntel {
  boxCount: number;
  runProb: number; // 0-100
  passProb: number; // 0-100
  note: string;
}

export interface KeyMomentPrompt {
  kind: MomentKind;
  quarter: number;
  overtime: boolean;
  clockLabel: string;
  down: number;
  distance: number;
  ballOn: number; // 0-100, current offense's perspective
  scorePlayer: number;
  scoreOpponent: number;
  timeoutsPlayer: number;
  timeoutsOpponent: number;
  side: "offense" | "defense";
  situation: string;
  options: KeyMomentOption[];
  defenseIntel?: DefenseIntel;
  analystNote?: string;
  momentumNote?: string;
  defenseLookNote?: string;
}

export interface PossessionLogEntry {
  quarter: number;
  overtime: boolean;
  clockLabel: string;
  text: string;
  playerInvolved: boolean;
  down: number;
  distance: number;
  possession: "player" | "opponent";
  displayBallOnBefore: number; // 0-100, ALWAYS player's-own-goal(0) -> opponent's-goal(100), for the field UI
  displayBallOnAfter: number;
  scoringPlay: boolean;
  turnover: boolean;
  scorePlayerAfter: number; // score snapshot as of this play, for UI playback pacing
  scoreOpponentAfter: number;
  momentum: MomentumState; // player's team vibe as of this play, for UI playback pacing
}

export interface GameSimState {
  week: number;
  teamId: string;
  opponentId: string;
  opponentName: string;
  quarter: number; // 1-4, 5 = overtime
  overtime: boolean;
  secondsRemaining: number;
  possession: "player" | "opponent";
  down: number;
  distance: number;
  ballOn: number; // 0-100, current offense's perspective
  scorePlayer: number;
  scoreOpponent: number;
  timeoutsPlayer: number;
  timeoutsOpponent: number;
  fatigue: number; // 0-100, rises through the game
  confidence: number; // 0-100
  stat: StatLine;
  log: PossessionLogEntry[];
  pendingDecision: KeyMomentPrompt | null;
  finished: boolean;
  result: "win" | "loss" | "tie" | null;
  keyMomentsResolved: number;
  playCount: number;
  recentPlayFamily: ("run" | "pass")[]; // player's own team's recent offensive tendency (read by the opposing D)
  recentOpponentFamily: ("run" | "pass")[]; // opponent's recent offensive tendency (read by the player's D)
  trickPlayCooldown: number; // plays since the player's team last ran a trick play
  opponentTrickPlayCooldown: number; // plays since the opponent last ran a trick play — tracked separately so the AI's own gadget-play staleness isn't judged against the player's history
  firstHalfReceiver: "player" | "opponent";
  recentOutcomes: ("good" | "bad")[]; // player's team's last few notable offensive snaps, feeds `momentum`
  momentum: MomentumState;
  // Carries a stage-1 choice into a stage-2 prompt (e.g. play_call -> target_priority)
  // without consuming a down. Cleared once the play actually resolves.
  carriedPlayType: PlayType | null;
  // The defense's call, revealed to the player at the pre-snap "defense_look" stage and
  // carried through to whichever stage actually resolves the play, so it's rolled once
  // and the reveal is never a lie.
  carriedDefenseCall: DefenseCall | null;
  carriedRiskLevel: RiskLevel | null;
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
const DOWN_LABELS = ["1st", "2nd", "3rd", "4th"];
const QUARTER_SECONDS = 900;
const OVERTIME_SECONDS = 600;

function playerSide(position: Position): "offense" | "defense" | "special" {
  if (OFFENSE_POSITIONS.includes(position)) return "offense";
  if (DEFENSE_POSITIONS.includes(position)) return "defense";
  return "special";
}

function teamRating(
  team: Team,
  side: "offense" | "defense",
  playerBoostSide: "offense" | "defense" | "special",
  overall: number,
  isOwnTeam: boolean,
  homeAdvantage: boolean
): number {
  const base = team.rosterStrength * 0.5 + team.coachingQuality * 0.25 + 12;
  const boosted = playerBoostSide === side;
  const boost = boosted ? overall * 0.32 : team.rosterStrength * 0.1;
  const homeAdj = isOwnTeam ? (homeAdvantage ? 2 : -1) : 0;
  return clamp(base + boost + homeAdj, 20, 99);
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function quarterLabel(quarter: number, overtime: boolean): string {
  return overtime ? "OT" : `Q${quarter}`;
}

function yardLinePhrase(ballOn: number): string {
  const v = Math.round(ballOn);
  if (v === 50) return "midfield";
  if (v > 50) return `the opponent's ${100 - v}`;
  return `your own ${v}`;
}

// =============================================================================
// Setup
// =============================================================================

export function beginGame(input: BeginGameInput, rng: RNG): GameSimState {
  const firstHalfReceiver: "player" | "opponent" = rng.chance(0.5) ? "player" : "opponent";
  const state: GameSimState = {
    week: input.week,
    teamId: input.team.id,
    opponentId: input.opponent.id,
    opponentName: `${input.opponent.city} ${input.opponent.name}`,
    quarter: 1,
    overtime: false,
    secondsRemaining: QUARTER_SECONDS,
    possession: firstHalfReceiver,
    down: 1,
    distance: 10,
    ballOn: 25,
    scorePlayer: 0,
    scoreOpponent: 0,
    timeoutsPlayer: 3,
    timeoutsOpponent: 3,
    fatigue: 0,
    confidence: clamp(input.player.attributes.general.confidence, 20, 90),
    stat: emptyStatLine(input.season, "nfl", input.team.id),
    log: [],
    pendingDecision: null,
    finished: false,
    result: null,
    keyMomentsResolved: 0,
    playCount: 0,
    recentPlayFamily: [],
    recentOpponentFamily: [],
    trickPlayCooldown: 99,
    opponentTrickPlayCooldown: 99,
    firstHalfReceiver,
    carriedPlayType: null,
    carriedDefenseCall: null,
    carriedRiskLevel: null,
    recentOutcomes: [],
    momentum: "neutral",
  };
  return runLoop(state, input, rng);
}

export function advanceGame(state: GameSimState, input: BeginGameInput, rng: RNG, decisionOptionId?: string): GameSimState {
  let next: GameSimState = {
    ...state,
    log: [...state.log],
    stat: { ...state.stat },
    recentPlayFamily: [...state.recentPlayFamily],
    recentOpponentFamily: [...state.recentOpponentFamily],
    recentOutcomes: [...state.recentOutcomes],
  };

  if (next.pendingDecision) {
    if (!decisionOptionId) return next; // still waiting on the caller
    const { next: resolved, continueLoop } = resolveDecision(next, input, rng, next.pendingDecision, decisionOptionId);
    next = resolved;
    if (!continueLoop) return next; // mid multi-stage decision (e.g. play_call -> target_priority)
  }

  return runLoop(next, input, rng);
}

// =============================================================================
// Main loop — advances real plays until a decision is needed or time expires.
// =============================================================================

function runLoop(state: GameSimState, input: BeginGameInput, rng: RNG): GameSimState {
  let next = state;

  while (!next.finished) {
    // Safety net: some decision-resolution paths (e.g. a converted 4th down that
    // reaches the end zone) can themselves set a NEW pendingDecision (a 2-point
    // choice) before returning. Never plow past one.
    if (next.pendingDecision) return next;

    if (next.secondsRemaining <= 0) {
      next = advanceClockPeriod(next, rng);
      if (next.finished) break;
      continue;
    }

    const offenseIsPlayer = next.possession === "player";
    const side: "offense" | "defense" = offenseIsPlayer ? "offense" : "defense";
    const myPos = playerSide(input.player.position);
    const playerInvolved = myPos === side;

    // 4th down is always a real decision for whoever's offense it is. This is
    // gated on `offenseIsPlayer` (not `playerInvolved`) on purpose: go/kick/punt
    // is a team-level call every position cares about, not a skill-position read —
    // unlike the play_call/defense_call gate below, which is deliberately
    // position-specific.
    if (next.down === 4) {
      if (offenseIsPlayer) {
        next.pendingDecision = buildFourthDownApproachPrompt(next, input);
        return next;
      }
      next = aiResolveFourthDown(next, input, rng);
      continue;
    }

    const highLeverage = isHighLeverageDown(next);

    if (playerInvolved && highLeverage) {
      next.pendingDecision = side === "offense" ? buildPlayCallPrompt(next, input, rng) : buildDefenseCallPrompt(next, input, rng);
      return next;
    }

    // Auto-resolved play (either not high-leverage, or the player isn't on the field for this snap).
    next = simulateAutoPlay(next, input, rng);
  }

  return next;
}

function isHighLeverageDown(state: GameSimState): boolean {
  if (state.down === 3) return true;
  if (state.ballOn >= 80) return true; // red zone / goal line for the current offense
  if ((state.quarter === 2 || state.quarter === 4 || state.overtime) && state.secondsRemaining <= 120) return true;
  if (state.quarter === 4 && state.secondsRemaining <= 300 && Math.abs(state.scorePlayer - state.scoreOpponent) <= 8) return true;
  return false;
}

function advanceClockPeriod(state: GameSimState, rng: RNG): GameSimState {
  const next = { ...state, log: [...state.log] };
  if (next.overtime) {
    next.finished = true;
    next.result = next.scorePlayer > next.scoreOpponent ? "win" : next.scorePlayer < next.scoreOpponent ? "loss" : "tie";
    return next;
  }
  if (next.quarter >= 4) {
    if (next.scorePlayer === next.scoreOpponent) {
      next.overtime = true;
      next.quarter = 5;
      next.secondsRemaining = OVERTIME_SECONDS;
      next.timeoutsPlayer = 2;
      next.timeoutsOpponent = 2;
      // Coin toss for OT possession, independent of the opening kickoff.
      // A real 50/50 roll off the seeded RNG — this used to key off
      // playCount's parity, which made OT possession a deterministic
      // function of how many plays happened to occur in regulation rather
      // than an actual coin flip.
      next.possession = rng.chance(0.5) ? "player" : "opponent";
      next.down = 1;
      next.distance = 10;
      next.ballOn = 25;
      return next;
    }
    next.finished = true;
    next.result = next.scorePlayer > next.scoreOpponent ? "win" : "loss";
    return next;
  }
  next.quarter += 1;
  next.secondsRemaining = QUARTER_SECONDS;
  if (next.quarter === 3) {
    // Second-half kickoff goes the other way.
    next.possession = next.firstHalfReceiver === "player" ? "opponent" : "player";
    next.down = 1;
    next.distance = 10;
    next.ballOn = 25;
    next.timeoutsPlayer = 3;
    next.timeoutsOpponent = 3;
  }
  return next;
}

// =============================================================================
// Decision resolution dispatcher
// =============================================================================

function resolveDecision(
  state: GameSimState,
  input: BeginGameInput,
  rng: RNG,
  decision: KeyMomentPrompt,
  optionId: string
): { next: GameSimState; continueLoop: boolean } {
  let next = { ...state };

  if (decision.kind === "play_call") {
    const playType = PLAY_CALL_TAGS[optionId] ?? "run";
    const riskLevel = decision.options.find((o) => o.id === optionId)?.riskLevel ?? "balanced";
    // Roll the defense's call now and reveal it to the player before the play
    // actually happens — a real pre-snap read, with a chance to check out of a
    // bad matchup, instead of the defense being a hidden dice roll.
    const defenseCall = aiChooseDefense(next, true, rng);
    next.carriedPlayType = playType;
    next.carriedRiskLevel = riskLevel;
    next.carriedDefenseCall = defenseCall;
    next.pendingDecision = buildDefenseLookPrompt(next, defenseCall, playType);
    return { next, continueLoop: false };
  }

  if (decision.kind === "defense_look") {
    const originalPlayType = next.carriedPlayType ?? "run";
    const originalRiskLevel = next.carriedRiskLevel ?? "balanced";
    const defenseCall = next.carriedDefenseCall ?? aiChooseDefense(next, true, rng);
    next.carriedDefenseCall = null;

    if (optionId === "look_audible") {
      // A quick, safe check-out — never the original call, always the cautious
      // read of what the revealed defense is vulnerable to.
      next.carriedPlayType = null;
      next.carriedRiskLevel = null;
      const audibledType: PlayType = originalPlayType === "run" ? "short_pass" : "run";
      const target: TargetPriority | undefined = audibledType === "short_pass" ? "checkdown" : undefined;
      next = executePlayerOffensePlay(next, input, rng, audibledType, target, "safe", defenseCall);
      next.pendingDecision = null;
      next.keyMomentsResolved += 1;
      return { next, continueLoop: true };
    }

    // Snap it — proceed with the original call, now that the D is locked in.
    if (input.player.position === "QB" && needsTargetPriority(originalPlayType)) {
      next.pendingDecision = buildTargetPriorityPrompt(next, input, originalPlayType);
      return { next, continueLoop: false };
    }
    next.carriedPlayType = null;
    next.carriedRiskLevel = null;
    next = executePlayerOffensePlay(next, input, rng, originalPlayType, undefined, originalRiskLevel, defenseCall);
    next.pendingDecision = null;
    next.keyMomentsResolved += 1;
    return { next, continueLoop: true };
  }

  if (decision.kind === "target_priority") {
    const target = TARGET_TAGS[optionId] ?? "let_qb_decide";
    const playType = next.carriedPlayType ?? "short_pass";
    const riskLevel = decision.options.find((o) => o.id === optionId)?.riskLevel ?? "balanced";
    const defenseCall = next.carriedDefenseCall;
    next.carriedPlayType = null;
    next.carriedDefenseCall = null;
    next.carriedRiskLevel = null;
    next = executePlayerOffensePlay(next, input, rng, playType, target, riskLevel, defenseCall ?? undefined);
    next.pendingDecision = null;
    next.keyMomentsResolved += 1;
    return { next, continueLoop: true };
  }

  if (decision.kind === "defense_call") {
    const defenseCall = DEFENSE_TAGS[optionId] ?? "cover3";
    const riskLevel = decision.options.find((o) => o.id === optionId)?.riskLevel ?? "balanced";
    next = executePlayerDefensePlay(next, input, rng, defenseCall, riskLevel);
    next.pendingDecision = null;
    next.keyMomentsResolved += 1;
    return { next, continueLoop: true };
  }

  if (decision.kind === "fourth_down_approach") {
    if (optionId === "trust_analyst") {
      const recommended = recommendFourthDown(next, input);
      next = resolveFourthDownChoice(next, input, rng, recommended);
      next.keyMomentsResolved += 1;
      return { next, continueLoop: true };
    }
    next.pendingDecision = buildFourthDownPrompt(next, input);
    return { next, continueLoop: false };
  }

  if (decision.kind === "fourth_down") {
    const choice = FOURTH_DOWN_TAGS[optionId] ?? "punt";
    next = resolveFourthDownChoice(next, input, rng, choice);
    next.keyMomentsResolved += 1;
    return { next, continueLoop: true };
  }

  if (decision.kind === "two_point") {
    next = resolveTwoPointChoice(next, input, rng, optionId === "two_go");
    next.keyMomentsResolved += 1;
    return { next, continueLoop: true };
  }

  next.pendingDecision = null;
  return { next, continueLoop: true };
}

function needsTargetPriority(playType: PlayType): boolean {
  return playType === "short_pass" || playType === "deep_pass" || playType === "play_action";
}

// =============================================================================
// Prompt builders
// =============================================================================

function marginPhrase(state: GameSimState): string {
  const diff = state.scorePlayer - state.scoreOpponent;
  if (diff === 0) return "the game is tied";
  return diff > 0 ? `you lead by ${diff}` : `you trail by ${-diff}`;
}

function baseSituation(state: GameSimState): string {
  const downLabel = DOWN_LABELS[state.down - 1];
  return `${downLabel} & ${state.distance} — ${formatClock(state.secondsRemaining)} left in ${quarterLabel(state.quarter, state.overtime)}. ${
    marginPhrase(state)
  }, ${state.scorePlayer}-${state.scoreOpponent}. Ball on ${yardLinePhrase(state.ballOn)}.`;
}

function computeTendency(family: ("run" | "pass")[]): { boxCount: number; runRate: number } | null {
  if (family.length < 3) return null;
  const window = family.slice(-8);
  const runs = window.filter((f) => f === "run").length;
  const runRate = runs / window.length;
  const boxCount = clamp(6 + Math.round(runRate * 3), 6, 8);
  return { boxCount, runRate };
}

// =============================================================================
// Momentum — a lightweight narrative "vibe" read on the player's team's last
// few notable offensive snaps (spec point 9). Not a hard counter: only
// genuinely good/bad snaps get tracked, so a middling 3-yard gain neither
// starts nor breaks a streak. Feeds both a small probability nudge and the
// flavor banner shown on offense decisions.
// =============================================================================

function classifyMomentumOutcome(outcome: PlayOutcome): "good" | "bad" | null {
  if (outcome.sack || outcome.interception || outcome.fumble) return "bad";
  if ((outcome.complete || outcome.bigPlay) && outcome.yards >= 6) return "good";
  return null;
}

function computeMomentum(recent: ("good" | "bad")[]): MomentumState {
  if (recent.length >= 3 && recent.slice(-3).every((r) => r === "good")) return "hot_streak";
  if (recent.slice(-4).filter((r) => r === "bad").length >= 2) return "shaken";
  return "neutral";
}

function momentumAdjustment(momentum: MomentumState): { success: number; bigPlay: number; turnover: number } {
  if (momentum === "hot_streak") return { success: 0.035, bigPlay: 0.02, turnover: -0.005 };
  if (momentum === "shaken") return { success: -0.035, bigPlay: -0.01, turnover: 0.01 };
  return { success: 0, bigPlay: 0, turnover: 0 };
}

function momentumBannerNote(momentum: MomentumState): string | undefined {
  if (momentum === "hot_streak") return "🔥 HOT STREAK — the offense has clicked on its last few snaps.";
  if (momentum === "shaken") return "⚠️ SHAKEN — the offense has struggled the last few snaps.";
  return undefined;
}

// =============================================================================
// Personality — reuses the player's existing off-field personality traits
// (set at character creation) as small on-field tendencies, so "who they are"
// actually shapes how their team plays (spec point 10).
// =============================================================================

function personalityAdjustment(personality: PersonalityTrait[], quarter: number, overtime: boolean): { success: number; bigPlay: number; turnover: number } {
  let success = 0;
  let bigPlay = 0;
  let turnover = 0;
  if (personality.includes("risk_taker")) {
    bigPlay += 0.035;
    turnover += 0.015;
  }
  if (personality.includes("disciplined")) {
    turnover -= 0.012;
  }
  if (personality.includes("aggressive")) {
    bigPlay += 0.02;
    success -= 0.008;
  }
  if ((personality.includes("competitive") || personality.includes("ambitious")) && (quarter >= 4 || overtime)) {
    success += 0.02;
  }
  return { success, bigPlay, turnover };
}

// =============================================================================
// Position-skill edge — the player's own attributes now reach directly into
// the play math, not just the aggregate team rating. A cannon-armed QB
// actually throws a better deep ball; a burst RB actually breaks more tackles;
// a ball-hawk corner actually takes the catch away. Small, clamped nudges
// layered on top of everything else, gated to only the side of the ball the
// player's own position is actually on (mirrors offenseBoost/defenseBoost).
// =============================================================================

function positionSkillEdge(
  position: Position,
  player: Player,
  offenseBoost: "offense" | "defense" | "special",
  defenseBoost: "offense" | "defense" | "special",
  playType: PlayType,
  targetPriority: TargetPriority | undefined
): { success: number; bigPlay: number; turnover: number; sack: number } {
  let success = 0;
  let bigPlay = 0;
  let turnover = 0;
  let sack = 0;
  const pos = player.attributes.position;

  if (offenseBoost === "offense") {
    if (position === "QB") {
      const qb = pos.QB;
      if (playType === "deep_pass") success += (qb.deepAccuracy - 60) / 400;
      else if (playType === "short_pass") success += (qb.shortAccuracy - 60) / 500;
      else if (playType === "play_action") success += (qb.mediumAccuracy - 60) / 500;
      else if (playType === "qb_scramble") success += ((qb.throwOnRun + player.attributes.physical.agility) - 120) / 650;
      turnover -= (qb.awareness - 60) / 800;
      sack -= (qb.awareness - 60) / 900;
    } else if (position === "RB") {
      const rb = pos.RB;
      if (playType === "run") {
        success += (rb.vision - 60) / 400;
        bigPlay += (rb.breakTackle + rb.elusiveness - 120) / 600;
      } else {
        bigPlay += (rb.elusiveness - 60) / 500;
      }
      turnover -= (rb.carrying - 60) / 900;
    } else if (position === "WR" || position === "TE") {
      const wt = position === "WR" ? pos.WR : pos.TE;
      success += (wt.catching + wt.routeRunning - 120) / 500;
      if (playType === "deep_pass" || targetPriority === "mismatch") {
        bigPlay += ((position === "WR" ? pos.WR.spectacularCatch : 55) - 60) / 400;
      }
    }
  }

  if (defenseBoost === "defense") {
    if (position === "CB") {
      const cb = pos.CB;
      const coverageSkill = targetPriority === "wr1" || targetPriority === "mismatch" ? cb.manCoverage : cb.zoneCoverage;
      success -= (coverageSkill - 60) / 450;
      turnover += (cb.ballHawk - 60) / 700;
    } else if (position === "S") {
      const s = pos.S;
      success -= (s.technique - 60) / 550;
      bigPlay -= (s.technique - 60) / 500;
    } else if (position === "LB") {
      const lb = pos.LB;
      if (playType === "run" || playType === "qb_scramble") success -= (lb.tackling + lb.pursuit - 120) / 600;
      else success -= (lb.coverage - 60) / 600;
    } else if (position === "DL") {
      const dl = pos.DL;
      sack += (dl.technique - 60) / 500;
      success -= (dl.blocking - 60) / 800; // "blocking" doubles as run-stuffing technique for the generic DL block
    }
  }

  return { success, bigPlay, turnover, sack };
}

function buildPlayCallPrompt(state: GameSimState, input: BeginGameInput, rng: RNG): KeyMomentPrompt {
  const options = offensePlayOptions(input.player.position, state, rng);
  let defenseIntel: DefenseIntel | undefined;
  const tendency = computeTendency(state.recentPlayFamily);
  if (tendency && (tendency.runRate >= 0.65 || tendency.runRate <= 0.35)) {
    const runProb = clamp(Math.round(58 - (tendency.boxCount - 6) * 12), 15, 85);
    const passProb = clamp(Math.round(52 + (tendency.boxCount - 6) * 9), 15, 85);
    defenseIntel = {
      boxCount: tendency.boxCount,
      runProb,
      passProb,
      note:
        tendency.runRate >= 0.65
          ? `DEFENSE ADJUSTED — they're stacking ${tendency.boxCount} in the box.`
          : `DEFENSE ADJUSTED — they're playing back in coverage, expecting the pass.`,
    };
  }
  return {
    kind: "play_call",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: state.down,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: baseSituation(state),
    options,
    defenseIntel,
    momentumNote: momentumBannerNote(state.momentum),
  };
}

const DEFENSE_LOOK_LABELS: Record<DefenseCall, string> = {
  cover2: "Two deep safeties — Cover 2 shell.",
  cover3: "Three-deep zone — Cover 3.",
  man: "They're playing man coverage, all over the field.",
  blitz: "Extra rushers coming — they're bringing the house!",
  double_wr1: "Two defenders bracket your top target.",
};

function buildDefenseLookPrompt(state: GameSimState, defenseCall: DefenseCall, playType: PlayType): KeyMomentPrompt {
  return {
    kind: "defense_look",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: state.down,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: "The defense sets up before the snap. Stick with it, or check out?",
    options: [
      { id: "look_snap", label: "Snap It", description: "Stick with the called play.", riskLevel: "balanced", icon: "🏈" },
      {
        id: "look_audible",
        label: "Audible!",
        description: playType === "run" ? "Check to a quick, safe throw instead." : "Check it down to the ground game instead.",
        riskLevel: "safe",
        icon: "🔄",
      },
    ],
    defenseLookNote: DEFENSE_LOOK_LABELS[defenseCall],
  };
}

function buildTargetPriorityPrompt(state: GameSimState, _input: BeginGameInput, _playType: PlayType): KeyMomentPrompt {
  return {
    kind: "target_priority",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: state.down,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: "Who's the priority read?",
    options: [
      { id: "target_wr1", label: "Look for WR1", description: "Your number one target.", riskLevel: "balanced", icon: "🎯" },
      { id: "target_te", label: "Look for the TE", description: "Safer against tight coverage.", riskLevel: "safe", icon: "🟦" },
      { id: "target_checkdown", label: "Checkdown", description: "Easy yards to the running back.", riskLevel: "safe", icon: "🔵" },
      { id: "target_mismatch", label: "Find the mismatch", description: "Attack the weakest defender on the field.", riskLevel: "aggressive", icon: "🟣" },
      { id: "target_qb", label: "Let the QB decide", description: "Trust your read of the defense.", riskLevel: "balanced", icon: "🧠" },
    ],
  };
}

function buildDefenseCallPrompt(state: GameSimState, input: BeginGameInput, rng: RNG): KeyMomentPrompt {
  let analystNote: string | undefined;
  const tendency = computeTendency(state.recentOpponentFamily);
  if (tendency && (tendency.runRate >= 0.65 || tendency.runRate <= 0.35)) {
    analystNote =
      tendency.runRate >= 0.65
        ? `SCOUT REPORT — the opponent has been running the ball on ${Math.round(tendency.runRate * 100)}% of recent snaps.`
        : `SCOUT REPORT — the opponent has been throwing on ${Math.round((1 - tendency.runRate) * 100)}% of recent snaps.`;
  }
  return {
    kind: "defense_call",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: state.down,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "defense",
    situation: baseSituation(state),
    options: DEFENSE_OPTIONS,
    analystNote,
  };
}

function fgAttemptYards(state: GameSimState): number {
  return 100 - state.ballOn + 17;
}

function recommendFourthDown(state: GameSimState, input: BeginGameInput): "field_goal" | "go_for_it" | "punt" {
  const attemptYards = fgAttemptYards(state);
  const goProb = fourthDownConvertProb(state, input);
  if (state.distance <= 2 && goProb >= 0.55) return "go_for_it";
  if (attemptYards <= 50) return "field_goal";
  if (attemptYards <= 62 && state.ballOn >= 55) return "field_goal";
  if (state.ballOn >= 60 && goProb >= 0.5) return "go_for_it";
  return "punt";
}

function fourthDownConvertProb(state: GameSimState, input: BeginGameInput): number {
  const ratingDiff = teamRating(input.team, "offense", "offense", input.overall, true, input.homeAdvantage) - teamRating(input.opponent, "defense", "special", input.overall, false, input.homeAdvantage);
  // Distance penalty steepens (0.055 -> 0.07) and the ceiling comes down from
  // .92 -> .78: real 4th-and-short conversion rates sit well below 90% even
  // for a strong offense, and a never-punt strategy shouldn't turn every
  // long 4th down into a near-certainty regardless of distance.
  return clamp(0.68 - state.distance * 0.07 + ratingDiff / 300, 0.06, 0.78);
}

function fgSuccessProb(attemptYards: number): number {
  return clamp(1 - Math.max(0, attemptYards - 20) * 0.017, 0.05, 0.97);
}

function buildFourthDownApproachPrompt(state: GameSimState, input: BeginGameInput): KeyMomentPrompt {
  const attemptYards = fgAttemptYards(state);
  const goProb = fourthDownConvertProb(state, input);
  const fgProb = fgSuccessProb(attemptYards);
  const analystNote =
    attemptYards <= 62
      ? `Our offense converts about ${Math.round(goProb * 100)}% of the time on 4th & ${state.distance}. A ${attemptYards}-yard field goal has roughly a ${Math.round(fgProb * 100)}% chance.`
      : `Our offense converts about ${Math.round(goProb * 100)}% of the time on 4th & ${state.distance}. We're out of realistic field goal range.`;
  return {
    kind: "fourth_down_approach",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: 4,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: baseSituation(state),
    options: [
      { id: "trust_analyst", label: "Trust the Analyst", description: analystNote, riskLevel: "safe", icon: "🎯" },
      { id: "trust_instinct", label: "Follow Your Instinct", description: "Make the call yourself.", riskLevel: "aggressive", icon: "🔥" },
    ],
    analystNote,
  };
}

function buildFourthDownPrompt(state: GameSimState, input: BeginGameInput): KeyMomentPrompt {
  const attemptYards = fgAttemptYards(state);
  const options: KeyMomentOption[] = [];
  if (attemptYards <= 62) {
    options.push({ id: "fourth_fg", label: "Field Goal", description: `${attemptYards}-yard attempt.`, riskLevel: "safe", icon: "🦵" });
  }
  options.push({ id: "fourth_go", label: "Go For It", description: `Try to convert 4th & ${state.distance}.`, riskLevel: "aggressive", icon: "🏈" });
  options.push({ id: "fourth_punt", label: "Punt", description: "Flip the field position.", riskLevel: "safe", icon: "📣" });
  options.push({ id: "fourth_fake", label: "Fake", description: "Catch them off guard — high risk.", riskLevel: "aggressive", icon: "🎭" });
  return {
    kind: "fourth_down",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: 4,
    distance: state.distance,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: baseSituation(state),
    options,
  };
}

function buildTwoPointPrompt(state: GameSimState): KeyMomentPrompt {
  return {
    kind: "two_point",
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    down: 0,
    distance: 0,
    ballOn: state.ballOn,
    scorePlayer: state.scorePlayer,
    scoreOpponent: state.scoreOpponent,
    timeoutsPlayer: state.timeoutsPlayer,
    timeoutsOpponent: state.timeoutsOpponent,
    side: "offense",
    situation: `Touchdown! ${marginPhrase(state)}, ${state.scorePlayer}-${state.scoreOpponent}. How do you want the extra point?`,
    options: [
      { id: "two_kick", label: "Extra Point", description: "The safe, near-automatic kick.", riskLevel: "safe", icon: "🦵" },
      { id: "two_go", label: "2-Point Conversion", description: "Go for two and try to change the math.", riskLevel: "aggressive", icon: "✌️" },
    ],
  };
}

// =============================================================================
// Offense play-call option sets (position-flavored, tagged to a PlayType)
// =============================================================================

const PLAY_CALL_TAGS: Record<string, PlayType> = {
  play_run: "run",
  play_short: "short_pass",
  play_deep: "deep_pass",
  play_pa: "play_action",
  play_scramble: "qb_scramble",
  play_trick: "trick_play",
  play_run_inside: "run",
  play_run_outside: "run",
  play_screen: "short_pass",
  play_pa_rb: "play_action",
  play_route_short: "short_pass",
  play_route_deep: "deep_pass",
  play_pa_wr: "play_action",
  play_jet: "run",
  play_execute: "run",
  play_extra: "run",
};

const TARGET_TAGS: Record<string, TargetPriority> = {
  target_wr1: "wr1",
  target_te: "te",
  target_checkdown: "checkdown",
  target_mismatch: "mismatch",
  target_qb: "let_qb_decide",
};

const DEFENSE_TAGS: Record<string, DefenseCall> = {
  def_cover2: "cover2",
  def_cover3: "cover3",
  def_man: "man",
  def_blitz: "blitz",
  def_double: "double_wr1",
};

const FOURTH_DOWN_TAGS: Record<string, "field_goal" | "go_for_it" | "punt" | "fake"> = {
  fourth_fg: "field_goal",
  fourth_go: "go_for_it",
  fourth_punt: "punt",
  fourth_fake: "fake",
};

const DEFENSE_OPTIONS: KeyMomentOption[] = [
  { id: "def_cover2", label: "Cover 2", description: "Two deep safeties — protects against the long ball.", riskLevel: "safe", icon: "🟦" },
  { id: "def_cover3", label: "Cover 3", description: "Balanced zone coverage.", riskLevel: "balanced", icon: "🟩" },
  { id: "def_man", label: "Man Coverage", description: "Lock down their guys, one-on-one. Aggressive.", riskLevel: "balanced", icon: "🟨" },
  { id: "def_blitz", label: "Blitz", description: "Bring extra pressure on the quarterback.", riskLevel: "aggressive", icon: "🟥" },
  { id: "def_double", label: "Double Team WR1", description: "Two defenders on their top target.", riskLevel: "balanced", icon: "🟪" },
];

function offensePlayOptions(position: Position, _state: GameSimState, _rng: RNG): KeyMomentOption[] {
  if (position === "QB") {
    return [
      { id: "play_run", label: "Run", description: "Trust the line and run game. A steadier floor, but a loaded box can stop it cold.", riskLevel: "balanced", icon: "🟢" },
      { id: "play_short", label: "Safe Pass", description: "Short accuracy and awareness protect the ball; smaller gains, stronger completion floor.", riskLevel: "safe", icon: "🔵" },
      { id: "play_deep", label: "Deep Pass", description: "Deep accuracy and confidence chase the explosive gain; pressure raises the downside.", riskLevel: "aggressive", icon: "🟣" },
      { id: "play_pa", label: "Play Action", description: "Use the run fake to create space. It is stronger when your recent run tendency is believable.", riskLevel: "balanced", icon: "🟠" },
      { id: "play_scramble", label: "Improvise", description: "Throw on the move or escape with agility. High upside, but late pressure can punish it.", riskLevel: "aggressive", icon: "🔴" },
      { id: "play_trick", label: "Trick Play", description: "A gadget play — boom or bust.", riskLevel: "aggressive", icon: "⚡" },
    ];
  }
  if (position === "RB") {
    return [
      { id: "play_run_inside", label: "Run — Inside", description: "Grind it up the middle for a reliable gain.", riskLevel: "safe", icon: "🟢" },
      { id: "play_run_outside", label: "Run — Outside", description: "Bounce it to the edge looking for a crease.", riskLevel: "balanced", icon: "🟢" },
      { id: "play_screen", label: "Screen Pass", description: "Let the defense come to you, then break it.", riskLevel: "safe", icon: "🔵" },
      { id: "play_pa_rb", label: "Play Action", description: "Sell the handoff, then release into the pattern.", riskLevel: "balanced", icon: "🟠" },
    ];
  }
  if (position === "WR" || position === "TE") {
    return [
      { id: "play_route_short", label: "Short Route", description: "Get open underneath and secure the catch.", riskLevel: "safe", icon: "🔵" },
      { id: "play_route_deep", label: "Go Route", description: "Sell out for the deep ball.", riskLevel: "aggressive", icon: "🟣" },
      { id: "play_pa_wr", label: "Play Action", description: "Work off the run fake for a clean release.", riskLevel: "balanced", icon: "🟠" },
      { id: "play_jet", label: "Jet Sweep", description: "Take the handoff in motion.", riskLevel: "aggressive", icon: "🟢" },
    ];
  }
  return [
    { id: "play_execute", label: "Execute the Called Play", description: "Do your job, nothing fancy.", riskLevel: "safe", icon: "🟢" },
    { id: "play_extra", label: "Give Extra Effort", description: "Push for more than the play calls for.", riskLevel: "aggressive", icon: "🔴" },
  ];
}

// =============================================================================
// Risk nudge (kept from the original model as a small universal modifier
// layered under the richer play-type/defense-call interactions below)
// =============================================================================

interface RiskModifier {
  successBonus: number;
  turnoverBonus: number;
  bigPlayBonus: number;
}

const RISK_MODIFIERS: Record<RiskLevel, RiskModifier> = {
  safe: { successBonus: 0.05, turnoverBonus: -0.02, bigPlayBonus: -0.04 },
  balanced: { successBonus: 0, turnoverBonus: 0, bigPlayBonus: 0 },
  aggressive: { successBonus: -0.03, turnoverBonus: 0.03, bigPlayBonus: 0.1 },
};

// =============================================================================
// Play resolution — the heart of the model.
// =============================================================================

interface PlayOutcome {
  yards: number;
  complete: boolean; // meaningful for pass plays; true for a "successful" run/scramble
  isPassAttempt: boolean;
  sack: boolean;
  interception: boolean;
  fumble: boolean;
  bigPlay: boolean;
  text: string;
}

function playFamily(playType: PlayType): "run" | "pass" | null {
  if (playType === "run" || playType === "qb_scramble") return "run";
  if (playType === "trick_play") return null; // too novel to classify for tendency purposes
  return "pass";
}

// =============================================================================
// Play-by-play commentary variety — every outcome family gets several phrasings
// so the ticker doesn't repeat itself. rng.pick() selects one per resolved play.
// =============================================================================

const TEXT_SACK: ((lost: number) => string)[] = [
  (lost) => `sacked for a loss of ${lost}.`,
  (lost) => `brought down behind the line for a ${lost}-yard sack.`,
  (lost) => `can't escape the pocket — sacked for ${lost}.`,
  (lost) => `swallowed up in the backfield, loses ${lost}.`,
];
const TEXT_SACK_FUMBLE = ["sacked and fumbles!", "hit as he throws — ball comes loose!", "strip-sacked!"];
const TEXT_PASS_COMPLETE: ((yards: number) => string)[] = [
  (y) => `completes it for ${y}.`,
  (y) => `finds his man for a gain of ${y}.`,
  (y) => `connects on the throw for ${y}.`,
  (y) => `drops it in for ${y} yards.`,
  (y) => `hits the target in stride for ${y}.`,
];
const TEXT_PASS_BIG: ((yards: number) => string)[] = [
  (y) => `takes it deep — big gain of ${y}!`,
  (y) => `hits paydirt down the sideline for ${y}!`,
  (y) => `airs it out for a huge ${y}-yard gain!`,
  (y) => `beats the coverage deep — ${y} yards!`,
];
const TEXT_INTERCEPTION = ["intercepted!", "picked off!", "throws it right to a defender — intercepted!", "the pass is jumped and picked off!"];
const TEXT_INCOMPLETE = ["incomplete.", "pass falls incomplete.", "can't connect — incomplete.", "throws it away, incomplete.", "broken up at the last second — incomplete."];
const TEXT_RUN_SUCCESS: ((yards: number) => string)[] = [
  (y) => `picks up ${y}.`,
  (y) => `grinds out ${y} yards.`,
  (y) => `fights forward for ${y}.`,
  (y) => `finds a crease for ${y}.`,
  (y) => `bounces it outside for ${y}.`,
];
const TEXT_RUN_BIG: ((yards: number) => string)[] = [
  (y) => `breaks free for ${y}!`,
  (y) => `turns the corner and takes it ${y} yards!`,
  (y) => `hits the hole and won't be caught — ${y} yards!`,
  (y) => `bursts through the line for ${y}!`,
];
const TEXT_RUN_STUFFED: ((yards: number) => string)[] = [
  (y) => `stuffed for ${y <= 0 ? "no gain" : `${y}`}.`,
  (y) => `met at the line — ${y <= 0 ? "no gain" : `${y}`}.`,
  (y) => `no room to run — ${y <= 0 ? "no gain" : `${y}`}.`,
  (y) => `wrapped up quickly for ${y <= 0 ? "no gain" : `${y}`}.`,
];
const TEXT_RUN_FUMBLE = ["fumbles the ball!", "ball comes loose — fumble!", "can't hang on to it — fumble!", "hit hard and fumbles!"];

// Crunch-time flavor: a short reaction line appended after a high-stakes 4th
// down conversion attempt (Q4/OT, one-score game) resolves — the moment the
// broadcast would cut to a reaction shot. Adds narrative weight to exactly
// the decisions that already matter most, without touching any probability.
const TEXT_CRUNCH_CONVERT = [
  " The sideline erupts.",
  " You can feel the momentum shift.",
  " The crowd is deafening.",
  " That's the play of the game.",
];
const TEXT_CRUNCH_FAIL = [
  " The sideline goes silent.",
  " A gut punch at the worst possible time.",
  " You can see the deflation on the bench.",
  " That one's going to sting.",
];

function crunchReaction(highStakes: boolean, success: boolean, rng: RNG): string {
  if (!highStakes) return "";
  return success ? rng.pick(TEXT_CRUNCH_CONVERT) : rng.pick(TEXT_CRUNCH_FAIL);
}

function resolvePlay(
  state: GameSimState,
  input: BeginGameInput,
  rng: RNG,
  offenseIsPlayer: boolean,
  playType: PlayType,
  targetPriority: TargetPriority | undefined,
  defenseCall: DefenseCall,
  riskLevel: RiskLevel
): PlayOutcome {
  const offenseTeam = offenseIsPlayer ? input.team : input.opponent;
  const defenseTeam = offenseIsPlayer ? input.opponent : input.team;
  const mySide = playerSide(input.player.position);
  const offenseBoost: "offense" | "defense" | "special" = offenseIsPlayer && mySide === "offense" ? "offense" : "special";
  const defenseBoost: "offense" | "defense" | "special" = !offenseIsPlayer && mySide === "defense" ? "defense" : "special";
  const offenseRating = teamRating(offenseTeam, "offense", offenseBoost, input.overall, offenseTeam.id === input.team.id, input.homeAdvantage);
  const defenseRating = teamRating(defenseTeam, "defense", defenseBoost, input.overall, defenseTeam.id === input.team.id, input.homeAdvantage);
  const ratingDiff = offenseRating - defenseRating;

  const fatiguePenalty = (state.fatigue / 100) * 6;
  const confidenceBonus = ((state.confidence - 50) / 50) * 5;
  const pressureAdj = state.quarter >= 4 || state.overtime ? ((input.player.attributes.mental.pressure - 50) / 50) * 4 : 0;
  const situational = ratingDiff / 130 - fatiguePenalty / 100 + confidenceBonus / 100 + pressureAdj / 100;

  const riskMod = RISK_MODIFIERS[riskLevel];

  // Momentum and personality only color the PLAYER's own team's snaps — they
  // represent the human player's makeup and their team's current vibe, not
  // the (AI-controlled) opponent's.
  const flavorAdj = offenseIsPlayer
    ? {
        success: momentumAdjustment(state.momentum).success + personalityAdjustment(input.player.personality, state.quarter, state.overtime).success,
        bigPlay: momentumAdjustment(state.momentum).bigPlay + personalityAdjustment(input.player.personality, state.quarter, state.overtime).bigPlay,
        turnover: momentumAdjustment(state.momentum).turnover + personalityAdjustment(input.player.personality, state.quarter, state.overtime).turnover,
      }
    : { success: 0, bigPlay: 0, turnover: 0 };

  const skillEdge = positionSkillEdge(input.player.position, input.player, offenseBoost, defenseBoost, playType, targetPriority);

  const offenseFamily = offenseIsPlayer ? state.recentPlayFamily : state.recentOpponentFamily;
  const tendency = computeTendency(offenseFamily);
  const boxDelta = tendency ? tendency.boxCount - 6 : 0;

  let defAdj = { success: 0, bigPlay: 0, turnover: 0, sack: 0 };
  switch (defenseCall) {
    case "cover2":
      if (playType === "deep_pass") defAdj = { success: -0.07, bigPlay: -0.09, turnover: 0.01, sack: 0 };
      else if (playType === "run") defAdj = { success: 0.02, bigPlay: 0, turnover: 0, sack: 0 };
      break;
    case "cover3":
      if (playType === "deep_pass") defAdj = { success: -0.04, bigPlay: -0.03, turnover: 0, sack: 0 };
      else if (playType === "short_pass" || targetPriority === "checkdown") defAdj = { success: 0.03, bigPlay: 0, turnover: 0, sack: 0 };
      break;
    case "man":
      if (playType === "short_pass") defAdj = { success: -0.04, bigPlay: 0, turnover: 0, sack: 0 };
      else if (playType === "deep_pass") defAdj = { success: 0, bigPlay: 0.05, turnover: 0.02, sack: 0 };
      if (targetPriority === "mismatch") defAdj = { success: defAdj.success + 0.1, bigPlay: defAdj.bigPlay + 0.05, turnover: defAdj.turnover, sack: defAdj.sack };
      break;
    case "blitz":
      if (playType === "run") defAdj = { success: -0.05, bigPlay: 0, turnover: 0, sack: 0 };
      else if (playType === "qb_scramble") defAdj = { success: 0.02, bigPlay: 0.1, turnover: 0, sack: 0.03 };
      else defAdj = { success: 0, bigPlay: 0, turnover: 0.03, sack: 0.1 };
      if (playType === "short_pass" || targetPriority === "checkdown") defAdj.success += 0.05;
      break;
    case "double_wr1":
      if (targetPriority === "wr1") defAdj = { success: -0.18, bigPlay: -0.1, turnover: 0.05, sack: 0 };
      else if (targetPriority) defAdj = { success: 0.05, bigPlay: 0.02, turnover: 0, sack: 0 };
      break;
  }

  const isPassPlay = playType === "short_pass" || playType === "deep_pass" || playType === "play_action";

  // Play-action gets a bonus proportional to how run-heavy the offense has looked lately —
  // the defense "bites" on the fake. This is the concrete payoff of the tendency system.
  let paBonus = 0;
  let paYardsBonus = 0;
  if (playType === "play_action" && tendency) {
    paBonus = tendency.runRate * 0.16;
    paYardsBonus = tendency.runRate * 4;
  }

  if (playType === "trick_play") {
    return resolveTrickPlay(state, rng, ratingDiff, riskMod, offenseIsPlayer);
  }

  if (isPassPlay) {
    const profile = playType === "short_pass" ? { comp: 0.68, yards: 7.5, variance: 3, sack: 0.05, turnover: 0.022, big: 0.05 }
      : playType === "deep_pass" ? { comp: 0.42, yards: 24, variance: 9, sack: 0.09, turnover: 0.08, big: 0.22 }
      : { comp: 0.6, yards: 11, variance: 6, sack: 0.07, turnover: 0.045, big: 0.13 };

    const boxPassAdj = boxDelta * 0.03;
    const sackChance = clamp(profile.sack + defAdj.sack - situational * 0.4 + skillEdge.sack, 0.02, 0.35);
    if (rng.chance(sackChance)) {
      const lost = rng.int(3, 9);
      const fumble = rng.chance(0.08);
      return { yards: -lost, complete: false, isPassAttempt: true, sack: true, interception: false, fumble, bigPlay: false, text: fumble ? rng.pick(TEXT_SACK_FUMBLE) : rng.pick(TEXT_SACK)(lost) };
    }

    const completionChance = clamp(profile.comp + situational + riskMod.successBonus + defAdj.success + boxPassAdj + paBonus + flavorAdj.success + skillEdge.success, 0.15, 0.92);
    if (rng.chance(completionChance)) {
      const bigPlayChance = clamp(profile.big + riskMod.bigPlayBonus + defAdj.bigPlay + situational * 0.3 + flavorAdj.bigPlay + skillEdge.bigPlay, 0.03, 0.55);
      const isBig = rng.chance(bigPlayChance);
      let yards = Math.max(1, Math.round(profile.yards + paYardsBonus + rng.gaussian() * profile.variance));
      if (isBig) yards += rng.int(15, 35);
      const fumble = rng.chance(0.012);
      return { yards, complete: true, isPassAttempt: true, sack: false, interception: false, fumble, bigPlay: isBig, text: isBig ? rng.pick(TEXT_PASS_BIG)(yards) : rng.pick(TEXT_PASS_COMPLETE)(yards) };
    }
    const interceptionChance = clamp(profile.turnover + defAdj.turnover + riskMod.turnoverBonus - situational * 0.3 + flavorAdj.turnover + skillEdge.turnover, 0.01, 0.35);
    if (rng.chance(interceptionChance)) {
      return { yards: 0, complete: false, isPassAttempt: true, sack: false, interception: true, fumble: false, bigPlay: false, text: rng.pick(TEXT_INTERCEPTION) };
    }
    return { yards: 0, complete: false, isPassAttempt: true, sack: false, interception: false, fumble: false, bigPlay: false, text: rng.pick(TEXT_INCOMPLETE) };
  }

  // Run family: "run" or "qb_scramble"
  const profile = playType === "qb_scramble" ? { base: 0.72, yards: 6.5, variance: 4, turnover: 0.02, big: 0.12 } : { base: 0.68, yards: 4.3, variance: 3.2, turnover: 0.015, big: 0.06 };
  const boxRunAdj = -boxDelta * 0.05;
  const successChance = clamp(profile.base + situational + riskMod.successBonus + defAdj.success + boxRunAdj + flavorAdj.success + skillEdge.success, 0.2, 0.9);
  const success = rng.chance(successChance);
  const bigPlayChance = clamp(profile.big + riskMod.bigPlayBonus + defAdj.bigPlay - Math.max(0, boxDelta) * 0.02 + flavorAdj.bigPlay + skillEdge.bigPlay, 0.02, 0.4);
  const isBig = success && rng.chance(bigPlayChance);
  let yards: number;
  if (success) {
    yards = Math.max(1, Math.round(profile.yards - boxDelta * 1.1 + rng.gaussian() * profile.variance));
    if (isBig) yards += rng.int(12, 30);
  } else {
    yards = rng.int(-2, 1);
  }
  const fumbleChance = clamp(profile.turnover + riskMod.turnoverBonus - situational * 0.2 + flavorAdj.turnover + skillEdge.turnover, 0.005, 0.06);
  const fumble = rng.chance(fumbleChance);
  return {
    yards,
    complete: success,
    isPassAttempt: false,
    sack: false,
    interception: false,
    fumble,
    bigPlay: isBig,
    text: fumble ? rng.pick(TEXT_RUN_FUMBLE) : isBig ? rng.pick(TEXT_RUN_BIG)(yards) : success ? rng.pick(TEXT_RUN_SUCCESS)(yards) : rng.pick(TEXT_RUN_STUFFED)(yards),
  };
}

function resolveTrickPlay(state: GameSimState, rng: RNG, ratingDiff: number, riskMod: RiskModifier, offenseIsPlayer: boolean): PlayOutcome {
  // Each side's own staleness — trickPlayCooldown tracks the player's team, so an
  // opponent gadget play must be judged against opponentTrickPlayCooldown instead.
  // Before this split, an opponent trick play was scored against the PLAYER's
  // cooldown, which is a different team's history entirely.
  const cooldown = offenseIsPlayer ? state.trickPlayCooldown : state.opponentTrickPlayCooldown;
  const staleness = cooldown < 6 ? 0.15 : 0;
  const successChance = clamp(0.5 + ratingDiff / 250 + riskMod.successBonus - staleness, 0.15, 0.75);
  if (rng.chance(successChance)) {
    const yards = rng.int(15, 45);
    return { yards, complete: true, isPassAttempt: false, sack: false, interception: false, fumble: false, bigPlay: true, text: `trick play works to perfection — ${yards} yards!` };
  }
  const turnover = rng.chance(0.3);
  if (turnover) {
    return { yards: 0, complete: false, isPassAttempt: false, sack: false, interception: rng.chance(0.5), fumble: rng.chance(0.5), bigPlay: false, text: "the trick play backfires — turned over!" };
  }
  const lost = rng.int(1, 8);
  return { yards: -lost, complete: false, isPassAttempt: false, sack: false, interception: false, fumble: false, bigPlay: false, text: `the gadget play is blown up for a loss of ${lost}.` };
}

// =============================================================================
// Applying a resolved play to game state (downs, clock, score, possession)
// =============================================================================

function applyPlayToState(
  state: GameSimState,
  input: BeginGameInput,
  rng: RNG,
  offenseIsPlayer: boolean,
  playType: PlayType,
  targetPriority: TargetPriority | undefined,
  outcome: PlayOutcome,
  playerInvolvedThisSnap: boolean
): GameSimState {
  let next = { ...state, log: [...state.log], stat: { ...state.stat } };
  next.playCount += 1;
  next.fatigue = clamp(next.fatigue + 3600 / 130 / 36, 0, 100); // gentle rise across a realistic ~130-160 play game

  const family = playFamily(playType);
  if (offenseIsPlayer && family) next.recentPlayFamily = [...next.recentPlayFamily, family].slice(-8);
  if (!offenseIsPlayer && family) next.recentOpponentFamily = [...next.recentOpponentFamily, family].slice(-8);
  if (playType === "trick_play" && offenseIsPlayer) next.trickPlayCooldown = 0;
  else next.trickPlayCooldown += 1;
  if (playType === "trick_play" && !offenseIsPlayer) next.opponentTrickPlayCooldown = 0;
  else next.opponentTrickPlayCooldown += 1;

  if (offenseIsPlayer) {
    const momentumTag = classifyMomentumOutcome(outcome);
    if (momentumTag) next.recentOutcomes = [...next.recentOutcomes, momentumTag].slice(-6);
    next.momentum = computeMomentum(next.recentOutcomes);
  }

  const displayBefore = offenseIsPlayer ? next.ballOn : 100 - next.ballOn;
  const startBallOn = next.ballOn;
  const startDown = next.down;
  const startDistance = next.distance;

  const turnoverThisPlay = outcome.interception || outcome.fumble;
  const offenseTeamLabel = offenseIsPlayer ? `${input.team.city} ${input.team.name}`.trim() : next.opponentName;

  const featuredName =
    playerInvolvedThisSnap && offenseIsPlayer && isFeaturedOnOffense(input.player.position, playType, targetPriority)
      ? input.player.bio.lastName
      : null;

  let scoringPlay = false;
  let turnover = false;
  let text = "";
  let endBallOn = startBallOn;

  if (turnoverThisPlay) {
    turnover = true;
    // Spot the turnover where the play actually ended: behind the line on a
    // sack (negative yards), at the line on an interception (yards is
    // always 0 there), and — importantly — at the point of the gain for a
    // fumble on a positive-yardage run/catch. This used to clamp to
    // Math.min(0, yards), which zeroed out any gain before a fumble and
    // spotted the recovery back at the original line of scrimmage no matter
    // how many yards the runner had actually picked up first.
    const spotAfterLoss = clamp(startBallOn + outcome.yards, 0, 100);
    endBallOn = spotAfterLoss;
    text = `${featuredName ? `${featuredName} ` : `${offenseTeamLabel} `}${outcome.text}`;
    next.possession = offenseIsPlayer ? "opponent" : "player";
    next.ballOn = clamp(100 - spotAfterLoss, 1, 99);
    next.down = 1;
    next.distance = 10;
  } else if (startBallOn + outcome.yards >= 100) {
    scoringPlay = true;
    endBallOn = 100;
    text = `${featuredName ? `${featuredName} ` : `${offenseTeamLabel} `}${outcome.text} Touchdown!`;
    if (offenseIsPlayer) next.scorePlayer += 6;
    else next.scoreOpponent += 6;
    next = applyStatFromPlay(next, input.player.position, offenseIsPlayer && playerInvolvedThisSnap, { playType, targetPriority, complete: outcome.complete, yards: Math.max(0, 100 - startBallOn), touchdown: true, interception: false, fumble: false, sack: outcome.sack }, rng);
    // In OT the touchdown itself already breaks the tie — no PAT/2pt attempt happens.
    next = next.overtime ? endSuddenDeathIfScored(next) : setupAfterTouchdown(next, input, rng, offenseIsPlayer);
  } else if (startBallOn + outcome.yards < 0) {
    // Safety: tackled behind the offense's own goal line. Strictly negative —
    // landing exactly on the goal line (0) is just a stop at the 1, not a
    // safety; the old `<= 0` incorrectly turned a tackle at the goal line
    // itself into a safety.
    endBallOn = 0;
    text = `${featuredName ? `${featuredName} is ` : `${offenseTeamLabel} is `}tackled in the end zone — safety!`;
    if (offenseIsPlayer) next.scoreOpponent += 2;
    else next.scorePlayer += 2;
    next.possession = offenseIsPlayer ? "opponent" : "player";
    next.ballOn = 35;
    next.down = 1;
    next.distance = 10;
    next = endSuddenDeathIfScored(next);
  } else {
    endBallOn = clamp(startBallOn + outcome.yards, 1, 99);
    const gained = endBallOn - startBallOn;
    const firstDown = gained >= startDistance;
    text = `${featuredName ? `${featuredName} ` : `${offenseTeamLabel} `}${outcome.text}`;
    if (firstDown) {
      next.down = 1;
      next.distance = Math.min(10, 100 - endBallOn);
      next.ballOn = endBallOn;
      text += " First down!";
    } else if (startDown >= 4) {
      // Only reachable for an auto-resolved (or player-defended) opponent "go for it"
      // that fails without a score or turnover — a normal down/distance failure on
      // 4th down is a turnover on downs, not a 5th down.
      next.possession = offenseIsPlayer ? "opponent" : "player";
      next.ballOn = clamp(100 - endBallOn, 1, 99);
      next.down = 1;
      next.distance = 10;
      text += " Turnover on downs.";
    } else {
      next.down = startDown + 1;
      next.distance = startDistance - gained;
      next.ballOn = endBallOn;
    }
  }

  if (!scoringPlay && !turnoverThisPlay) {
    next = applyStatFromPlay(next, input.player.position, offenseIsPlayer && playerInvolvedThisSnap, { playType, targetPriority, complete: outcome.complete, yards: outcome.yards, touchdown: false, interception: outcome.interception, fumble: outcome.fumble, sack: outcome.sack }, rng);
  } else if (turnoverThisPlay) {
    next = applyStatFromPlay(next, input.player.position, offenseIsPlayer && playerInvolvedThisSnap, { playType, targetPriority, complete: outcome.complete, yards: outcome.yards, touchdown: false, interception: outcome.interception, fumble: outcome.fumble, sack: outcome.sack }, rng);
  }
  next.stat.gamesPlayed = 1;

  // A sack ends with the QB tackled in bounds, same as a stuffed run — the
  // clock keeps running. Only a genuine incompletion (no sack) stops it here,
  // same as an actual incomplete pass would in real football.
  const stopsClock = !outcome.complete && outcome.isPassAttempt && !outcome.sack ? true : scoringPlay || turnover || rng.chance(0.16);
  const consumed = stopsClock ? rng.int(4, 10) : rng.int(28, 42);
  next.secondsRemaining = clamp(next.secondsRemaining - consumed, 0, QUARTER_SECONDS);

  const confidenceDelta = scoringPlay ? (offenseIsPlayer ? 3 : -2) : turnoverThisPlay ? (offenseIsPlayer ? -4 : 3) : 0;
  next.confidence = clamp(next.confidence + confidenceDelta, 5, 99);

  const displayAfter = offenseIsPlayer ? endBallOn : 100 - endBallOn;
  next.log = [
    ...next.log,
    {
      quarter: next.quarter,
      overtime: next.overtime,
      clockLabel: formatClock(next.secondsRemaining),
      text,
      playerInvolved: playerInvolvedThisSnap,
      down: startDown,
      distance: startDistance,
      possession: offenseIsPlayer ? "player" : "opponent",
      displayBallOnBefore: displayBefore,
      displayBallOnAfter: displayAfter,
      scoringPlay,
      turnover,
      scorePlayerAfter: next.scorePlayer,
      scoreOpponentAfter: next.scoreOpponent,
      momentum: next.momentum,
    },
  ];

  return next;
}

function isFeaturedOnOffense(position: Position, playType: PlayType, targetPriority: TargetPriority | undefined): boolean {
  if (position === "QB") return playType === "qb_scramble" || playType === "short_pass" || playType === "deep_pass" || playType === "play_action" || playType === "trick_play";
  if (position === "RB") return playType === "run" || playType === "short_pass" || playType === "play_action";
  if (position === "WR" || position === "TE") return true; // WR/TE options are always self-featured (run = jet sweep to them)
  return false;
}

function setupAfterTouchdown(state: GameSimState, input: BeginGameInput, rng: RNG, scorerIsPlayer: boolean): GameSimState {
  let next = { ...state };
  const marginBeforeConversion = next.scorePlayer - next.scoreOpponent;

  if (scorerIsPlayer && (next.quarter === 4 || next.overtime) && (marginBeforeConversion === -1 || marginBeforeConversion === -2)) {
    next.pendingDecision = buildTwoPointPrompt(next);
    return next;
  }

  // Auto-resolve the extra point (opponent always kicks; player's team kicks when the
  // situation isn't a marquee 2-point decision).
  const patGood = rng.chance(0.94);
  if (scorerIsPlayer) next.scorePlayer += patGood ? 1 : 0;
  else next.scoreOpponent += patGood ? 1 : 0;
  next.secondsRemaining = clamp(next.secondsRemaining - rng.int(3, 6), 0, QUARTER_SECONDS);
  const kickerLabel = scorerIsPlayer ? "Extra point" : `${next.opponentName} extra point`;
  next.log = [
    ...next.log,
    {
      quarter: next.quarter,
      overtime: next.overtime,
      clockLabel: formatClock(next.secondsRemaining),
      text: patGood ? `${kickerLabel} is good.` : `${kickerLabel} is no good!`,
      playerInvolved: scorerIsPlayer,
      down: 0,
      distance: 0,
      possession: scorerIsPlayer ? "player" : "opponent",
      displayBallOnBefore: scorerIsPlayer ? 98 : 2,
      displayBallOnAfter: scorerIsPlayer ? 98 : 2,
      scoringPlay: patGood,
      turnover: false,
      scorePlayerAfter: next.scorePlayer,
      scoreOpponentAfter: next.scoreOpponent,
      momentum: next.momentum,
    },
  ];
  next = kickoffAfterScore(next, scorerIsPlayer);
  return next;
}

// Sudden-death overtime only continues while the score is tied (see
// advanceClockPeriod's tie-check when regulation ends), so ANY score during
// OT — touchdown, field goal, safety, a 4th-down-conversion touchdown —
// immediately decides the winner. Call this right after such a score instead
// of chaining into the normal PAT/2pt-choice/kickoff follow-up, which would
// otherwise let the trailing team keep playing after the game is already over.
function endSuddenDeathIfScored(state: GameSimState): GameSimState {
  if (!state.overtime || state.scorePlayer === state.scoreOpponent) return state;
  return { ...state, finished: true, result: state.scorePlayer > state.scoreOpponent ? "win" : "loss", pendingDecision: null };
}

function kickoffAfterScore(state: GameSimState, scorerIsPlayer: boolean): GameSimState {
  const next = { ...state };
  next.possession = scorerIsPlayer ? "opponent" : "player";
  next.ballOn = 25;
  next.down = 1;
  next.distance = 10;
  return next;
}

function resolveTwoPointChoice(state: GameSimState, input: BeginGameInput, rng: RNG, goForTwo: boolean): GameSimState {
  let next = { ...state, log: [...state.log] };
  next.secondsRemaining = clamp(next.secondsRemaining - rng.int(3, 6), 0, QUARTER_SECONDS);
  if (goForTwo) {
    const success = rng.chance(0.48);
    if (success) next.scorePlayer += 2;
    next.log = [...next.log, twoPointLogEntry(next, success ? "2-point conversion is good!" : "2-point conversion fails.", success)];
  } else {
    const success = rng.chance(0.94);
    if (success) next.scorePlayer += 1;
    next.log = [...next.log, twoPointLogEntry(next, success ? "Extra point is good." : "Extra point is no good!", success)];
  }
  next.pendingDecision = null;
  next = kickoffAfterScore(next, true);
  return next;
}

function twoPointLogEntry(state: GameSimState, text: string, success: boolean): PossessionLogEntry {
  return {
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    text,
    playerInvolved: true,
    down: 0,
    distance: 0,
    possession: "player",
    displayBallOnBefore: 98,
    displayBallOnAfter: 98,
    scoringPlay: success,
    turnover: false,
    scorePlayerAfter: state.scorePlayer,
    scoreOpponentAfter: state.scoreOpponent,
    momentum: state.momentum,
  };
}

// =============================================================================
// 4th down resolution (analyst path or manual FG/Go/Punt/Fake)
// =============================================================================

function resolveFourthDownChoice(state: GameSimState, input: BeginGameInput, rng: RNG, choice: "field_goal" | "go_for_it" | "punt" | "fake"): GameSimState {
  let next = { ...state, log: [...state.log], stat: { ...state.stat } };
  next.pendingDecision = null;
  next.secondsRemaining = clamp(next.secondsRemaining - rng.int(5, 9), 0, QUARTER_SECONDS);
  const attemptYards = fgAttemptYards(next);
  const startBallOn = next.ballOn;

  if (choice === "field_goal") {
    const success = rng.chance(fgSuccessProb(attemptYards));
    if (success) next.scorePlayer += 3;
    next.log = [...next.log, fourthDownLogEntry(next, success ? `Field goal is good from ${attemptYards} yards!` : `Field goal from ${attemptYards} yards is no good.`, { scoringPlay: success, turnover: !success }, startBallOn)];
    if (success) {
      // In OT the field goal itself already breaks the tie — game over, no kickoff.
      next = next.overtime ? endSuddenDeathIfScored(next) : kickoffAfterScore(next, true); // opponent receives after the player's made field goal
    } else {
      next.possession = "opponent";
      next.ballOn = clamp(100 - startBallOn, 1, 99);
      next.down = 1;
      next.distance = 10;
    }
    return next;
  }

  if (choice === "punt") {
    const net = rng.int(35, 48);
    const landing = startBallOn + net;
    const touchback = landing >= 100;
    next.log = [...next.log, fourthDownLogEntry(next, touchback ? "Punts it into the end zone — touchback." : `Punts it away, ${net} yards.`, { scoringPlay: false, turnover: true }, startBallOn)];
    next.possession = next.possession === "player" ? "opponent" : "player";
    next.ballOn = touchback ? 25 : clamp(100 - landing, 5, 40);
    next.down = 1;
    next.distance = 10;
    return next;
  }

  // "go_for_it" and "fake" both attempt to convert; fake carries a penalty and a bonus if it hits.
  const highStakes = (state.quarter === 4 || state.overtime) && Math.abs(state.scorePlayer - state.scoreOpponent) <= 8;
  const baseProb = fourthDownConvertProb(next, input);
  const prob = choice === "fake" ? clamp(baseProb - 0.15, 0.05, 0.85) : baseProb;
  const converts = rng.chance(prob);
  if (converts) {
    const gained = choice === "fake" ? next.distance + rng.int(5, 20) : next.distance + rng.int(0, 6);
    const rawEndBallOn = startBallOn + gained;
    if (rawEndBallOn >= 100) {
      next.scorePlayer += 6;
      next.log = [...next.log, fourthDownLogEntry(next, (choice === "fake" ? "The fake works — touchdown!" : "They convert — and take it to the house!") + crunchReaction(highStakes, true, rng), { scoringPlay: true, turnover: false }, startBallOn)];
      next = next.overtime ? endSuddenDeathIfScored(next) : setupAfterTouchdown(next, input, rng, true);
      return next;
    }
    const endBallOn = clamp(rawEndBallOn, 1, 99);
    next.down = 1;
    next.distance = Math.min(10, 100 - endBallOn);
    next.ballOn = endBallOn;
    next.log = [...next.log, fourthDownLogEntry(next, (choice === "fake" ? "The fake catches the defense off guard — they convert!" : "They convert the 4th down!") + crunchReaction(highStakes, true, rng), { scoringPlay: false, turnover: false, ballOnAfter: endBallOn }, startBallOn)];
    return next;
  }

  next.possession = "opponent";
  next.ballOn = clamp(100 - startBallOn, 1, 99);
  next.down = 1;
  next.distance = 10;
  next.log = [...next.log, fourthDownLogEntry(next, (choice === "fake" ? "The fake is blown up — turnover on downs." : "Stopped short — turnover on downs.") + crunchReaction(highStakes, false, rng), { scoringPlay: false, turnover: true }, startBallOn)];
  return next;
}

function fourthDownLogEntry(
  state: GameSimState,
  text: string,
  outcome: { scoringPlay: boolean; turnover: boolean; ballOnAfter?: number },
  startBallOn: number
): PossessionLogEntry {
  return {
    quarter: state.quarter,
    overtime: state.overtime,
    clockLabel: formatClock(state.secondsRemaining),
    text,
    playerInvolved: true,
    down: 4,
    distance: state.distance,
    possession: "player",
    displayBallOnBefore: startBallOn,
    displayBallOnAfter: outcome.scoringPlay ? 100 : outcome.ballOnAfter ?? startBallOn,
    scoringPlay: outcome.scoringPlay,
    turnover: outcome.turnover,
    scorePlayerAfter: state.scorePlayer,
    scoreOpponentAfter: state.scoreOpponent,
    momentum: state.momentum,
  };
}

function aiResolveFourthDown(state: GameSimState, input: BeginGameInput, rng: RNG): GameSimState {
  // Opponent's 4th down: let the AI pick, then — if they go for it and the player is a
  // defender — hand control to the player for that snap like any other high-leverage down.
  const attemptYards = fgAttemptYards(state);
  const goProb = clamp(0.68 - state.distance * 0.05, 0.1, 0.9);
  let choice: "field_goal" | "go_for_it" | "punt";
  if (state.distance <= 2 && rng.chance(goProb)) choice = "go_for_it";
  else if (attemptYards <= 52) choice = "field_goal";
  else choice = "punt";

  if (choice !== "go_for_it") {
    return resolveOpponentSpecialTeams(state, input, rng, choice);
  }

  const myPos = playerSide(input.player.position);
  if (myPos === "defense") {
    const decision = buildDefenseCallPrompt(state, input, rng);
    return { ...state, pendingDecision: decision };
  }
  return simulateAutoPlay(state, input, rng);
}

function resolveOpponentSpecialTeams(state: GameSimState, input: BeginGameInput, rng: RNG, choice: "field_goal" | "punt"): GameSimState {
  let next = { ...state, log: [...state.log] };
  next.secondsRemaining = clamp(next.secondsRemaining - rng.int(5, 9), 0, QUARTER_SECONDS);
  const attemptYards = fgAttemptYards(next);
  const startBallOn = next.ballOn;
  if (choice === "field_goal") {
    const success = rng.chance(fgSuccessProb(attemptYards));
    if (success) next.scoreOpponent += 3;
    next.log = [...next.log, { quarter: next.quarter, overtime: next.overtime, clockLabel: formatClock(next.secondsRemaining), text: success ? `${next.opponentName} field goal is good from ${attemptYards} yards.` : `${next.opponentName} field goal from ${attemptYards} yards is no good.`, playerInvolved: false, down: 4, distance: next.distance, possession: "opponent", displayBallOnBefore: 100 - startBallOn, displayBallOnAfter: success ? 0 : 100 - startBallOn, scoringPlay: success, turnover: !success, scorePlayerAfter: next.scorePlayer, scoreOpponentAfter: next.scoreOpponent, momentum: next.momentum }];
    if (success) {
      // In OT the field goal itself already breaks the tie — game over, no kickoff.
      next = next.overtime ? endSuddenDeathIfScored(next) : kickoffAfterScore(next, false); // player receives after the opponent's made field goal
    } else {
      next.possession = "player";
      next.ballOn = clamp(100 - startBallOn, 1, 99);
      next.down = 1;
      next.distance = 10;
    }
    return next;
  }
  const net = rng.int(35, 48);
  const landing = startBallOn + net;
  const touchback = landing >= 100;
  next.log = [...next.log, { quarter: next.quarter, overtime: next.overtime, clockLabel: formatClock(next.secondsRemaining), text: touchback ? `${next.opponentName} punts it into the end zone — touchback.` : `${next.opponentName} punts it away, ${net} yards.`, playerInvolved: false, down: 4, distance: next.distance, possession: "opponent", displayBallOnBefore: 100 - startBallOn, displayBallOnAfter: touchback ? 0 : 100 - landing, scoringPlay: false, turnover: true, scorePlayerAfter: next.scorePlayer, scoreOpponentAfter: next.scoreOpponent, momentum: next.momentum }];
  next.possession = "player";
  next.ballOn = touchback ? 25 : clamp(100 - landing, 5, 40);
  next.down = 1;
  next.distance = 10;
  return next;
}

// =============================================================================
// AI-controlled play calling (used for every auto-resolved snap on either side)
// =============================================================================

function aiChoosePlayType(state: GameSimState, offenseIsPlayer: boolean, rng: RNG): PlayType {
  const { down, distance, ballOn } = state;
  const trailing = offenseIsPlayer ? state.scorePlayer < state.scoreOpponent : state.scoreOpponent < state.scorePlayer;
  const desperate = state.quarter === 4 && state.secondsRemaining <= 180 && trailing;

  if (desperate) {
    return rng.weighted([
      { item: "deep_pass" as PlayType, weight: 35 },
      { item: "short_pass" as PlayType, weight: 40 },
      { item: "play_action" as PlayType, weight: 10 },
      { item: "qb_scramble" as PlayType, weight: 15 },
    ]);
  }
  if (distance <= 2) {
    return rng.weighted([
      { item: "run" as PlayType, weight: 50 },
      { item: "play_action" as PlayType, weight: 20 },
      { item: "short_pass" as PlayType, weight: 25 },
      { item: "qb_scramble" as PlayType, weight: 5 },
    ]);
  }
  if (down === 3 && distance >= 7) {
    return rng.weighted([
      { item: "short_pass" as PlayType, weight: 35 },
      { item: "deep_pass" as PlayType, weight: 30 },
      { item: "play_action" as PlayType, weight: 15 },
      { item: "qb_scramble" as PlayType, weight: 15 },
      { item: "trick_play" as PlayType, weight: 5 },
    ]);
  }
  if (ballOn >= 90) {
    return rng.weighted([
      { item: "run" as PlayType, weight: 40 },
      { item: "short_pass" as PlayType, weight: 35 },
      { item: "play_action" as PlayType, weight: 20 },
      { item: "qb_scramble" as PlayType, weight: 5 },
    ]);
  }
  return rng.weighted([
    { item: "run" as PlayType, weight: down === 1 ? 45 : 30 },
    { item: "short_pass" as PlayType, weight: 30 },
    { item: "deep_pass" as PlayType, weight: 12 },
    { item: "play_action" as PlayType, weight: 15 },
    { item: "qb_scramble" as PlayType, weight: 5 },
    { item: "trick_play" as PlayType, weight: 3 },
  ]);
}

function aiChooseTarget(rng: RNG): TargetPriority {
  return rng.weighted([
    { item: "wr1" as TargetPriority, weight: 35 },
    { item: "te" as TargetPriority, weight: 20 },
    { item: "checkdown" as TargetPriority, weight: 20 },
    { item: "mismatch" as TargetPriority, weight: 15 },
    { item: "let_qb_decide" as TargetPriority, weight: 10 },
  ]);
}

// The defense's call is no longer blind to what the offense has been doing: a
// defense that's just watched a run-heavy or pass-heavy stretch leans into
// counters for it, on top of the box-count math tendency already applies —
// spamming one play family gets read and punished by the actual call, not
// just a hidden probability tweak.
function aiChooseDefense(state: GameSimState, offenseIsPlayer: boolean, rng: RNG): DefenseCall {
  const { down, distance } = state;
  let weights: { item: DefenseCall; weight: number }[];
  if (down >= 3 && distance >= 7) {
    weights = [
      { item: "cover3", weight: 35 },
      { item: "cover2", weight: 25 },
      { item: "blitz", weight: 20 },
      { item: "man", weight: 15 },
      { item: "double_wr1", weight: 5 },
    ];
  } else if (distance <= 2) {
    weights = [
      { item: "blitz", weight: 30 },
      { item: "man", weight: 25 },
      { item: "cover3", weight: 25 },
      { item: "cover2", weight: 20 },
    ];
  } else {
    weights = [
      { item: "cover3", weight: 30 },
      { item: "cover2", weight: 25 },
      { item: "man", weight: 25 },
      { item: "blitz", weight: 15 },
      { item: "double_wr1", weight: 5 },
    ];
  }

  const tendency = computeTendency(offenseIsPlayer ? state.recentPlayFamily : state.recentOpponentFamily);
  if (tendency && tendency.runRate >= 0.65) {
    weights = weights.map((w) => (w.item === "blitz" || w.item === "cover3" ? { ...w, weight: w.weight * 1.6 } : { ...w, weight: w.weight * 0.7 }));
  } else if (tendency && tendency.runRate <= 0.35) {
    weights = weights.map((w) => (w.item === "cover2" || w.item === "man" || w.item === "double_wr1" ? { ...w, weight: w.weight * 1.6 } : { ...w, weight: w.weight * 0.7 }));
  }

  return rng.weighted(weights);
}

function simulateAutoPlay(state: GameSimState, input: BeginGameInput, rng: RNG): GameSimState {
  const offenseIsPlayer = state.possession === "player";
  const playType = aiChoosePlayType(state, offenseIsPlayer, rng);
  const target = needsTargetPriority(playType) ? aiChooseTarget(rng) : undefined;
  const defenseCall = aiChooseDefense(state, offenseIsPlayer, rng);
  const outcome = resolvePlay(state, input, rng, offenseIsPlayer, playType, target, defenseCall, "balanced");
  const myPos = playerSide(input.player.position);
  const playerInvolvedThisSnap = (offenseIsPlayer && myPos === "offense") || (!offenseIsPlayer && myPos === "defense");
  return applyPlayToState(state, input, rng, offenseIsPlayer, playType, target, outcome, playerInvolvedThisSnap);
}

function executePlayerOffensePlay(
  state: GameSimState,
  input: BeginGameInput,
  rng: RNG,
  playType: PlayType,
  target: TargetPriority | undefined,
  riskLevel: RiskLevel,
  presetDefenseCall?: DefenseCall
): GameSimState {
  const defenseCall = presetDefenseCall ?? aiChooseDefense(state, true, rng);
  const outcome = resolvePlay(state, input, rng, true, playType, target, defenseCall, riskLevel);
  return applyPlayToState(state, input, rng, true, playType, target, outcome, true);
}

function executePlayerDefensePlay(state: GameSimState, input: BeginGameInput, rng: RNG, defenseCall: DefenseCall, riskLevel: RiskLevel): GameSimState {
  const playType = aiChoosePlayType(state, false, rng);
  const target = needsTargetPriority(playType) ? aiChooseTarget(rng) : undefined;
  const outcome = resolvePlay(state, input, rng, false, playType, target, defenseCall, riskLevel);
  return applyPlayToState(state, input, rng, false, playType, target, outcome, true);
}

// =============================================================================
// Stat accumulation
// =============================================================================

interface PlayStatContext {
  playType: PlayType;
  targetPriority: TargetPriority | undefined;
  complete: boolean;
  yards: number;
  touchdown: boolean;
  interception: boolean;
  fumble: boolean;
  sack: boolean;
}

function applyStatFromPlay(state: GameSimState, position: Position, offenseIsPlayerSnap: boolean, ctx: PlayStatContext, rng: RNG): GameSimState {
  const stat = { ...state.stat };
  const { playType, complete, yards, touchdown, interception, fumble, sack } = ctx;

  if (offenseIsPlayerSnap) {
    if (position === "QB") {
      if (playType === "qb_scramble") {
        stat.rushAttempts += 1;
        stat.rushYards += Math.max(0, yards);
        if (touchdown) stat.rushTDs += 1;
        if (fumble) stat.fumbles += 1;
      } else if (playType !== "run") {
        stat.passAttempts += 1;
        if (complete) {
          stat.passCompletions += 1;
          stat.passYards += Math.max(0, yards);
          if (touchdown) stat.passTDs += 1;
        }
        if (interception) stat.interceptionsThrown += 1;
        if (fumble) stat.fumbles += 1;
      }
    } else if (position === "RB") {
      if (playType === "run") {
        stat.rushAttempts += 1;
        stat.rushYards += Math.max(0, yards);
        if (touchdown) stat.rushTDs += 1;
        if (fumble) stat.fumbles += 1;
      } else {
        if (complete) {
          stat.receptions += 1;
          stat.receivingYards += Math.max(0, yards);
          if (touchdown) stat.receivingTDs += 1;
          if (fumble) stat.fumbles += 1;
        }
      }
    } else if (position === "WR" || position === "TE") {
      if (playType === "run") {
        stat.rushAttempts += 1;
        stat.rushYards += Math.max(0, yards);
        if (touchdown) stat.rushTDs += 1;
        if (fumble) stat.fumbles += 1;
      } else if (complete) {
        stat.receptions += 1;
        stat.receivingYards += Math.max(0, yards);
        if (touchdown) stat.receivingTDs += 1;
        if (fumble) stat.fumbles += 1;
      }
    }
  } else if (!offenseIsPlayerSnap && (position === "LB" || position === "CB" || position === "S" || position === "DL")) {
    if (sack && (position === "LB" || position === "DL")) stat.sacks += 1;
    if (interception && (position === "CB" || position === "S" || position === "LB")) stat.interceptions += 1;
    else if (!complete && (position === "CB" || position === "S") && rng.chance(0.22)) stat.passesDefended += 1;
    else if (rng.chance(position === "DL" ? 0.3 : 0.45)) stat.tackles += 1;
  }

  return { ...state, stat };
}
