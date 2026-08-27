import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { baseInjuryProbability, rollForInjury, tickInjuryRecovery, injuryTagFor } from "../injury";
import { RNG } from "../rng";

describe("injury", () => {
  describe("baseInjuryProbability", () => {
    it("stays within its documented floor/ceiling across the full durability range", () => {
      for (let durability = 0; durability <= 100; durability += 5) {
        const p = baseInjuryProbability(durability, 50);
        assert.ok(p >= 0.002 && p <= 0.5, `durability ${durability}: prob ${p} out of [0.002, 0.5]`);
      }
    });

    it("gives a more durable player a strictly lower injury chance, all else equal", () => {
      const fragile = baseInjuryProbability(20, 50);
      const durable = baseInjuryProbability(90, 50);
      assert.ok(durable < fragile, `durable player (${durable}) should have lower risk than fragile (${fragile})`);
    });

    it("scales linearly with the context multiplier", () => {
      const normal = baseInjuryProbability(60, 50, 1);
      const doubled = baseInjuryProbability(60, 50, 2);
      assert.ok(Math.abs(doubled - normal * 2) < 1e-9);
    });
  });

  describe("rollForInjury", () => {
    it("never injures a durable player at zero context risk across many seeds (floor prob is tiny)", () => {
      let injuries = 0;
      for (let seed = 1; seed <= 500; seed++) {
        const result = rollForInjury(1, 95, 90, new RNG(seed), 0);
        if (result) injuries++;
      }
      // Floor probability is 0.002, so a handful of "injuries" out of 500 seeds
      // is expected — but it should be rare, not the common case.
      assert.ok(injuries < 25, `expected injuries to be rare at zero context risk, got ${injuries}/500`);
    });

    it("produces a fully-populated injury within its template's own recovery/penalty/risk ranges", () => {
      for (let seed = 1; seed <= 200; seed++) {
        const result = rollForInjury(1, 10, 10, new RNG(seed), 5); // fragile player, high-risk context
        if (!result) continue;
        assert.ok(result.recoveryWeeks >= 1 && result.recoveryWeeks <= 60);
        assert.ok(result.performancePenalty > 0 && result.performancePenalty < 1);
        assert.ok(result.reinjuryRisk > 0 && result.reinjuryRisk < 1);
        assert.equal(result.weeksRemaining, result.recoveryWeeks);
        assert.equal(result.playedThrough, false);
        assert.equal(result.weekOccurred, 1);
      }
    });
  });

  describe("tickInjuryRecovery", () => {
    it("decrements weeksRemaining by one when not played through", () => {
      const injury = { id: "x", type: "Ankle sprain", severity: "minor" as const, weekOccurred: 1, recoveryWeeks: 4, weeksRemaining: 4, performancePenalty: 0.1, reinjuryRisk: 0.05, playedThrough: false };
      const { injury: next, setback } = tickInjuryRecovery(injury, false, new RNG(1));
      assert.equal(setback, false);
      assert.equal(next?.weeksRemaining, 3);
    });

    it("returns null once weeksRemaining reaches zero, signaling full recovery", () => {
      const injury = { id: "x", type: "Ankle sprain", severity: "minor" as const, weekOccurred: 1, recoveryWeeks: 1, weeksRemaining: 1, performancePenalty: 0.1, reinjuryRisk: 0.05, playedThrough: false };
      const { injury: next } = tickInjuryRecovery(injury, false, new RNG(1));
      assert.equal(next, null);
    });

    it("extends recovery and flags a setback when a guaranteed reinjury risk is played through", () => {
      const injury = { id: "x", type: "Torn MCL", severity: "severe" as const, weekOccurred: 1, recoveryWeeks: 10, weeksRemaining: 5, performancePenalty: 0.3, reinjuryRisk: 1, playedThrough: false };
      const { injury: next, setback } = tickInjuryRecovery(injury, true, new RNG(1));
      assert.equal(setback, true);
      // 5 - 1 (normal tick) + round(10 * 0.5) = 9
      assert.equal(next?.weeksRemaining, 9);
      assert.equal(next?.playedThrough, true);
    });

    it("never rolls reinjury risk when the player didn't play through", () => {
      const injury = { id: "x", type: "Torn MCL", severity: "severe" as const, weekOccurred: 1, recoveryWeeks: 10, weeksRemaining: 5, performancePenalty: 0.3, reinjuryRisk: 1, playedThrough: false };
      const { injury: next, setback } = tickInjuryRecovery(injury, false, new RNG(1));
      assert.equal(setback, false);
      assert.equal(next?.weeksRemaining, 4);
    });
  });

  it("injuryTagFor produces a stable, severity-specific tag", () => {
    assert.equal(injuryTagFor("minor"), "has_active_injury_minor");
    assert.equal(injuryTagFor("career_threatening"), "has_active_injury_career_threatening");
  });
});
