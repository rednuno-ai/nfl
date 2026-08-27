import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCombineScores, generateDraftProjection, resolveDraft, rookieContractValue } from "../draft";
import { createPlayer } from "../player";
import { RNG } from "../rng";

function makePlayer(overrides: Partial<{ position: "QB" | "RB" | "WR" | "TE" | "LB" | "CB" }> = {}) {
  return createPlayer(
    {
      firstName: "Jordan",
      lastName: "Reed",
      position: overrides.position ?? "QB",
      hometownCity: "X",
      hometownState: "TX",
      hand: "right",
      heightInches: 74,
      weightLbs: 215,
      personality: [],
      currentYear: 2026,
    },
    new RNG(7)
  );
}

describe("draft", () => {
  it("generateCombineScores produces plausible, bounded numbers", () => {
    const player = makePlayer();
    const combine = generateCombineScores(player, new RNG(3));
    assert.ok(combine.fortyYardDash > 3.5 && combine.fortyYardDash < 6.5, `forty time out of plausible range: ${combine.fortyYardDash}`);
    assert.ok(combine.interviewScore >= 20 && combine.interviewScore <= 99);
    assert.ok(combine.benchPressReps >= 0);
  });

  it("generateDraftProjection keeps projectedRoundLow <= projectedRoundHigh within 1-7", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const player = makePlayer();
      const projection = generateDraftProjection(player, new RNG(seed));
      assert.ok(projection.projectedRoundLow >= 1 && projection.projectedRoundLow <= 7);
      assert.ok(projection.projectedRoundHigh >= 1 && projection.projectedRoundHigh <= 7);
      assert.ok(projection.projectedRoundLow <= projection.projectedRoundHigh, `seed ${seed}: low (${projection.projectedRoundLow}) > high (${projection.projectedRoundHigh})`);
      assert.ok(projection.stock >= 5 && projection.stock <= 99);
    }
  });

  it("resolveDraft's round and pick always agree with each other (round = ceil(pick/32)), across many seeds and stock levels", () => {
    const player = makePlayer();
    for (let seed = 1; seed <= 300; seed++) {
      const rng = new RNG(seed);
      const projection = generateDraftProjection(player, rng);
      const result = resolveDraft(projection, 2026, rng);
      if (result.round === 0) {
        assert.equal(result.pick, 0, `seed ${seed}: undrafted result should have pick 0`);
        assert.equal(result.teamId, null);
        continue;
      }
      assert.ok(result.round >= 1 && result.round <= 7, `seed ${seed}: round ${result.round} out of 1-7`);
      assert.ok(result.pick >= 1 && result.pick <= 224, `seed ${seed}: pick ${result.pick} out of 1-224`);
      const expectedRound = Math.min(7, Math.max(1, Math.ceil(result.pick / 32)));
      assert.equal(result.round, expectedRound, `seed ${seed}: pick ${result.pick} reported as round ${result.round}, expected round ${expectedRound}`);
      assert.ok(result.teamId, `seed ${seed}: drafted result should have a team`);
    }
  });

  describe("rookieContractValue", () => {
    it("gives undrafted free agents a fixed, modest one-year deal", () => {
      const deal = rookieContractValue(0, 0);
      assert.deepEqual(deal, { years: 1, totalValue: 750_000, signingBonus: 5_000 });
    });

    it("pays a first-round pick meaningfully more than a late-round pick", () => {
      const firstRound = rookieContractValue(1, 1);
      const lateRound = rookieContractValue(7, 220);
      assert.ok(firstRound.totalValue > lateRound.totalValue, "pick 1 should be worth more than pick 220");
      assert.ok(firstRound.signingBonus > lateRound.signingBonus);
    });

    it("gives rounds 1-3 a 4-year deal and rounds 4-7 a 3-year deal", () => {
      assert.equal(rookieContractValue(1, 10).years, 4);
      assert.equal(rookieContractValue(3, 90).years, 4);
      assert.equal(rookieContractValue(4, 110).years, 3);
      assert.equal(rookieContractValue(7, 220).years, 3);
    });

    it("never produces a negative or zero total value for any drafted round", () => {
      for (let round = 1; round <= 7; round++) {
        const deal = rookieContractValue(round, round * 32);
        assert.ok(deal.totalValue > 0, `round ${round} totalValue should be positive`);
        assert.ok(deal.signingBonus > 0);
      }
    });
  });
});
