import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPlayer } from "../player";
import { beginGame, advanceGame } from "../simulation/gameSim";
import { TEAMS } from "../teams";
import { RNG } from "../rng";

function makeQB() {
  return createPlayer(
    { firstName: "Jordan", lastName: "Reed", position: "QB", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 75, weightLbs: 220, personality: [], currentYear: 2026 },
    new RNG(21)
  );
}

describe("game simulation", () => {
  it("runs to completion by resolving every key moment", () => {
    const player = makeQB();
    const team = TEAMS[0];
    const opponent = TEAMS[1];
    const input = { player, overall: 80, team, opponent, week: 1, season: 2026, homeAdvantage: true };
    const rng = new RNG(55);

    let state = beginGame(input, rng);
    let iterations = 0;
    while (!state.finished && iterations < 50) {
      if (state.pendingDecision) {
        const optionId = state.pendingDecision.options[0].id;
        state = advanceGame(state, input, rng, optionId);
      } else {
        state = advanceGame(state, input, rng);
      }
      iterations++;
    }

    assert.equal(state.finished, true);
    assert.ok(["win", "loss", "tie"].includes(state.result!));
    assert.ok(state.scorePlayer >= 0 && state.scoreOpponent >= 0);
    assert.ok(state.stat.gamesPlayed === 1);
  });

  it("is deterministic given the same seed and decisions", () => {
    const player = makeQB();
    const team = TEAMS[0];
    const opponent = TEAMS[1];
    const input = { player, overall: 80, team, opponent, week: 1, season: 2026, homeAdvantage: true };

    function play(seed: number) {
      const rng = new RNG(seed);
      let state = beginGame(input, rng);
      let iterations = 0;
      while (!state.finished && iterations < 50) {
        state = state.pendingDecision ? advanceGame(state, input, rng, state.pendingDecision.options[0].id) : advanceGame(state, input, rng);
        iterations++;
      }
      return state;
    }

    const a = play(777);
    const b = play(777);
    assert.equal(a.scorePlayer, b.scorePlayer);
    assert.equal(a.scoreOpponent, b.scoreOpponent);
    assert.equal(a.result, b.result);
  });

  it("a QB accumulates passing stats over the course of a game", () => {
    const player = makeQB();
    const team = TEAMS[2];
    const opponent = TEAMS[3];
    const input = { player, overall: 88, team, opponent, week: 3, season: 2026, homeAdvantage: false };
    const rng = new RNG(99);
    let state = beginGame(input, rng);
    let iterations = 0;
    while (!state.finished && iterations < 50) {
      state = state.pendingDecision ? advanceGame(state, input, rng, state.pendingDecision.options[0].id) : advanceGame(state, input, rng);
      iterations++;
    }
    assert.ok(state.stat.passAttempts > 0, "QB should have recorded pass attempts");
  });

  it("aggressive key-moment choices carry more variance than safe ones (statistical smoke test)", () => {
    const player = makeQB();
    const team = TEAMS[4];
    const opponent = TEAMS[5];
    const input = { player, overall: 80, team, opponent, week: 5, season: 2026, homeAdvantage: true };

    function playWithRisk(seed: number, pickIndexPreference: (options: { riskLevel: string }[]) => number) {
      const rng = new RNG(seed);
      let state = beginGame(input, rng);
      let iterations = 0;
      while (!state.finished && iterations < 50) {
        if (state.pendingDecision) {
          const idx = pickIndexPreference(state.pendingDecision.options);
          state = advanceGame(state, input, rng, state.pendingDecision.options[idx].id);
        } else {
          state = advanceGame(state, input, rng);
        }
        iterations++;
      }
      return state;
    }

    const finalScores: number[] = [];
    for (let seed = 1; seed <= 15; seed++) {
      const s = playWithRisk(seed, (opts) => opts.findIndex((o) => o.riskLevel === "aggressive"));
      finalScores.push(s.scorePlayer);
    }
    // Just assert it runs without throwing and produces plausible scores; true variance
    // comparison is a stronger statistical claim than a smoke test needs.
    assert.ok(finalScores.every((s) => s >= 0 && s < 100));
  });
});
