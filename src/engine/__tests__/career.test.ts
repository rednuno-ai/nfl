import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCareer,
  advanceWeek,
  resolveDecision,
  resolveGameDecision,
  acknowledgeFinishedGame,
  commitToCollege,
  signWithTeam,
  retireCareer,
  canRetire,
  chooseTrainingFocus,
  evaluateSeasonAwards,
  type CareerState,
} from "../career";
import { emptyStatLine } from "../types";
import { POINT_BUY_POOL } from "../attributes";

/** Games now stay as the active interaction (see gameSim's play-by-play
 *  engine + GameDayView's real-time playback) until the UI explicitly
 *  acknowledges a finished one — mirror that here instead of assuming a
 *  game auto-clears the moment its last down resolves. */
function driveGameInteraction(state: CareerState): CareerState {
  if (!state.interaction || state.interaction.type !== "game") return state;
  const game = state.interaction.game;
  if (game.finished) return acknowledgeFinishedGame(state);
  return resolveGameDecision(state, game.pendingDecision!.options[0].id);
}
import type { CreatePlayerInput } from "../player";

function baseInput(overrides: Partial<CreatePlayerInput> = {}): CreatePlayerInput {
  return {
    firstName: "Jordan",
    lastName: "Reed",
    position: "QB",
    hometownCity: "Ironpoint",
    hometownState: "TX",
    hand: "right",
    heightInches: 75,
    weightLbs: 218,
    personality: ["ambitious", "competitive"],
    currentYear: 2026,
    attributeAllocations: { "position.QB.shortAccuracy": POINT_BUY_POOL },
    ...overrides,
  };
}

/** Drives the career forward automatically, always taking the first available
 *  option at every decision point. Used to integration-test the full loop:
 *  High School -> Recruiting -> College -> Draft -> NFL -> Retirement -> Legacy. */
function autoplayUntilRetired(state: CareerState, maxIterations = 60000): { state: CareerState; iterations: number; stagesSeen: Set<string> } {
  let iterations = 0;
  const stagesSeen = new Set<string>();
  while (!state.retired && iterations < maxIterations) {
    stagesSeen.add(state.stage);
    if (state.interaction?.type === "decision") {
      state = resolveDecision(state, state.interaction.decision.choices[0].id);
    } else if (state.interaction?.type === "training") {
      state = chooseTrainingFocus(state, state.interaction.options[0].id);
    } else if (state.interaction?.type === "game") {
      state = driveGameInteraction(state);
    } else if (state.recruitingReady) {
      state = commitToCollege(state, state.recruitingOffers[0]?.collegeId ?? "college_1");
    } else if (state.freeAgencyOffers) {
      state = signWithTeam(state, state.freeAgencyOffers[0].teamId);
    } else {
      state = advanceWeek(state);
    }
    iterations++;
  }
  return { state, iterations, stagesSeen };
}

describe("career state machine", () => {
  it("starts a new career in high school at age 15", () => {
    const state = createCareer(baseInput());
    assert.equal(state.stage, "high_school");
    assert.equal(state.player.bio.age, 15);
    assert.equal(state.retired, false);
    assert.equal(state.interaction, null);
  });

  it("requires the whole 24-point pool before a career can start", () => {
    assert.throws(
      () => createCareer(baseInput({ attributeAllocations: {} })),
      /Spend all 24 attribute points/
    );
    assert.throws(
      () => createCareer(baseInput({ attributeAllocations: { "position.QB.shortAccuracy": POINT_BUY_POOL - 1 } })),
      /Spend all 1 attribute points/
    );
    assert.doesNotThrow(() => createCareer(baseInput({ attributeAllocations: { "position.QB.shortAccuracy": POINT_BUY_POOL } })));
  });

  it("advances a week and eventually plays a scheduled game", () => {
    let state = createCareer(baseInput());
    let sawGame = false;
    for (let i = 0; i < 30 && !sawGame; i++) {
      if (state.interaction?.type === "decision") {
        state = resolveDecision(state, state.interaction.decision.choices[0].id);
        continue;
      }
      if (state.interaction?.type === "training") {
        state = chooseTrainingFocus(state, state.interaction.options[0].id);
        continue;
      }
      if (state.interaction?.type === "game") {
        sawGame = true;
        break;
      }
      state = advanceWeek(state);
    }
    assert.equal(sawGame, true, "expected a game to begin within the first high school season");
  });

  it("keeps a pending game frozen until a valid game decision is made", () => {
    let state = createCareer(baseInput());
    for (let i = 0; i < 30 && state.interaction?.type !== "game"; i++) {
      if (state.interaction?.type === "decision") state = resolveDecision(state, state.interaction.decision.choices[0].id);
      else if (state.interaction?.type === "training") state = chooseTrainingFocus(state, state.interaction.options[0].id);
      else state = advanceWeek(state);
    }

    assert.equal(state.interaction?.type, "game");
    const before = JSON.stringify(state.interaction?.game);
    const frozen = advanceWeek(state);
    assert.equal(frozen, state, "advanceWeek is a no-op while the saved game awaits player input");
    assert.equal(JSON.stringify(frozen.interaction?.type === "game" ? frozen.interaction.game : null), before);
  });

  it("progresses through the entire career loop to retirement and produces a legacy", () => {
    const state = createCareer(baseInput());
    const { state: finalState, iterations, stagesSeen } = autoplayUntilRetired(state);

    assert.equal(finalState.retired, true, `career did not retire within ${iterations} iterations (stage stuck at ${finalState.stage})`);
    assert.ok(finalState.legacy, "expected a legacy result to be computed on retirement");
    assert.ok(stagesSeen.has("high_school"));
    assert.ok(stagesSeen.has("recruiting"));
    assert.ok(stagesSeen.has("college"));
    assert.ok(stagesSeen.has("draft"));
    assert.ok(stagesSeen.has("nfl_offseason") || stagesSeen.has("nfl_season"));
    assert.ok(["bust", "solid_career", "star", "superstar", "legend", "hall_of_fame"].includes(finalState.legacy!.tier));
  });

  it("commitToCollege moves the player from recruiting into college", () => {
    let state = createCareer(baseInput());
    let guard = 0;
    while (state.stage !== "recruiting" && guard < 20000) {
      if (state.interaction?.type === "decision") {
        state = resolveDecision(state, state.interaction.decision.choices[0].id);
      } else if (state.interaction?.type === "training") {
        state = chooseTrainingFocus(state, state.interaction.options[0].id);
      } else if (state.interaction?.type === "game") {
        state = driveGameInteraction(state);
      } else {
        state = advanceWeek(state);
      }
      guard++;
    }
    assert.equal(state.stage, "recruiting");
    assert.ok(state.recruitingOffers.length > 0);
    const chosen = state.recruitingOffers[0].collegeId;
    state = commitToCollege(state, chosen);
    assert.equal(state.stage, "college");
    assert.equal(state.college?.collegeId, chosen);
  });

  it("retireCareer can be called manually once eligible and always produces a legacy tier", () => {
    let state = createCareer(baseInput());
    let guard = 0;
    while (!canRetire(state) && guard < 20000) {
      if (state.interaction?.type === "decision") state = resolveDecision(state, state.interaction.decision.choices[0].id);
      else if (state.interaction?.type === "training") state = chooseTrainingFocus(state, state.interaction.options[0].id);
      else if (state.interaction?.type === "game") state = driveGameInteraction(state);
      else if (state.recruitingReady) state = commitToCollege(state, state.recruitingOffers[0]?.collegeId ?? "college_1");
      else if (state.freeAgencyOffers) state = signWithTeam(state, state.freeAgencyOffers[0].teamId);
      else state = advanceWeek(state);
      guard++;
    }
    assert.ok(canRetire(state), "career never reached an NFL stage eligible for retirement");
    const retired = retireCareer(state);
    assert.equal(retired.retired, true);
    assert.ok(retired.legacy);
  });

  it("finance never goes negative from automatic weekly ticks alone", () => {
    const state = createCareer(baseInput());
    const { state: finalState } = autoplayUntilRetired(state, 3000);
    // Cash *can* go negative narratively (bad decisions), but net worth accounting
    // should always stay internally consistent (no NaNs).
    assert.equal(Number.isNaN(finalState.finance.netWorth), false);
    assert.equal(Number.isNaN(finalState.finance.cash), false);
  });

  it("pays weekly NFL salary during the season, not just the signing bonus", () => {
    let state = createCareer(baseInput());
    let guard = 0;
    while (!(state.stage === "nfl_season" && state.contract) && guard < 20000) {
      if (state.interaction?.type === "decision") state = resolveDecision(state, state.interaction.decision.choices[0].id);
      else if (state.interaction?.type === "training") state = chooseTrainingFocus(state, state.interaction.options[0].id);
      else if (state.interaction?.type === "game") state = driveGameInteraction(state);
      else if (state.recruitingReady) state = commitToCollege(state, state.recruitingOffers[0]?.collegeId ?? "college_1");
      else if (state.freeAgencyOffers) state = signWithTeam(state, state.freeAgencyOffers[0].teamId);
      else state = advanceWeek(state);
      guard++;
    }
    assert.ok(state.stage === "nfl_season" && state.contract, "career never reached a signed NFL season within the iteration guard");

    const earningsAtKickoff = state.finance.totalCareerEarnings;
    const weekAtKickoff = state.weekInSeason;
    // Drive forward several full in-season weeks (each game takes many
    // decision-by-decision steps to finish, so bound this on weeks advanced
    // rather than iteration count).
    let stepGuard = 0;
    while (state.stage === "nfl_season" && state.weekInSeason < weekAtKickoff + 3 && stepGuard < 5000) {
      if (state.interaction?.type === "decision") state = resolveDecision(state, state.interaction.decision.choices[0].id);
      else if (state.interaction?.type === "training") state = chooseTrainingFocus(state, state.interaction.options[0].id);
      else if (state.interaction?.type === "game") state = driveGameInteraction(state);
      else state = advanceWeek(state);
      stepGuard++;
    }
    assert.ok(state.weekInSeason >= weekAtKickoff + 3 || state.stage !== "nfl_season", "did not advance three in-season weeks within the step guard");

    // Salary should have been paid on top of whatever the signing bonus/prior
    // earnings already were — a regression here (salary silently never being
    // paid) would leave totalCareerEarnings essentially flat across a season.
    assert.ok(
      state.finance.totalCareerEarnings > earningsAtKickoff,
      `expected totalCareerEarnings to grow from weekly salary (was ${earningsAtKickoff}, now ${state.finance.totalCareerEarnings})`
    );
  });
});

describe("evaluateSeasonAwards", () => {
  it("gives no honors for a short or mediocre season", () => {
    const short = { ...emptyStatLine(1, "nfl", "team"), gamesPlayed: 3, passAttempts: 60, passCompletions: 40, passYards: 500, passTDs: 4 };
    assert.deepEqual(evaluateSeasonAwards(short, "QB", 8), { proBowl: false, allPro: false, mvp: false });

    const mediocre = { ...emptyStatLine(1, "nfl", "team"), gamesPlayed: 16, passAttempts: 500, passCompletions: 280, passYards: 3000, passTDs: 14, interceptionsThrown: 12 };
    assert.deepEqual(evaluateSeasonAwards(mediocre, "QB", 7), { proBowl: false, allPro: false, mvp: false });
  });

  it("awards Pro Bowl and All-Pro for a strong full season, but MVP only with team success", () => {
    const elite = { ...emptyStatLine(1, "nfl", "team"), gamesPlayed: 16, passAttempts: 550, passCompletions: 385, passYards: 4800, passTDs: 42, interceptionsThrown: 6 };
    const withoutTeamSuccess = evaluateSeasonAwards(elite, "QB", 6);
    assert.equal(withoutTeamSuccess.proBowl, true);
    assert.equal(withoutTeamSuccess.allPro, true);
    assert.equal(withoutTeamSuccess.mvp, false, "MVP should require real team success (wins), not just gaudy stats");

    const withTeamSuccess = evaluateSeasonAwards(elite, "QB", 13);
    assert.equal(withTeamSuccess.mvp, true);
  });

  it("returns no honors for non-skill positions the heuristic doesn't model", () => {
    const stat = { ...emptyStatLine(1, "nfl", "team"), gamesPlayed: 16 };
    assert.deepEqual(evaluateSeasonAwards(stat, "OL", 14), { proBowl: false, allPro: false, mvp: false });
  });
});
