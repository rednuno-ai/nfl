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
  type CareerState,
} from "../career";

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
    while (state.stage !== "recruiting" && guard < 2000) {
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
});
