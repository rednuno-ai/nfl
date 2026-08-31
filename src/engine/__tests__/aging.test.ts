import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createPlayer } from "../player";
import { applySeasonalAging, applyTraining, trainingGrowthMultiplier } from "../aging";
import { RNG } from "../rng";

describe("aging", () => {
  it("improves physical attributes for a young player", () => {
    const rng = new RNG(3);
    const player = createPlayer(
      { firstName: "A", lastName: "B", position: "RB", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 70, weightLbs: 200, personality: [], currentYear: 2026 },
      rng
    );
    const before = player.attributes.physical.speed;
    const { attributes } = applySeasonalAging(player.attributes, 19, 1);
    assert.ok(attributes.physical.speed >= before, "speed should not decrease for a 19 year old");
  });

  it("declines physical attributes for an aging veteran", () => {
    const rng = new RNG(4);
    const player = createPlayer(
      { firstName: "A", lastName: "B", position: "RB", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 70, weightLbs: 200, personality: [], currentYear: 2026 },
      rng
    );
    const before = player.attributes.physical.speed;
    const { attributes } = applySeasonalAging(player.attributes, 34, 10);
    assert.ok(attributes.physical.speed < before, "speed should decline for a 34 year old veteran");
  });

  it("mental attributes climb with experience", () => {
    const rng = new RNG(5);
    const player = createPlayer(
      { firstName: "A", lastName: "B", position: "QB", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 74, weightLbs: 220, personality: [], currentYear: 2026 },
      rng
    );
    const before = player.attributes.mental.footballIQ;
    const { attributes } = applySeasonalAging(player.attributes, 28, 5);
    assert.ok(attributes.mental.footballIQ > before);
  });

  it("training increases the targeted focus area and adds fatigue", () => {
    const rng = new RNG(6);
    const player = createPlayer(
      { firstName: "A", lastName: "B", position: "WR", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 72, weightLbs: 190, personality: [], currentYear: 2026 },
      rng
    );
    const before = player.attributes.physical.speed;
    const result = applyTraining(player.attributes, "speed", 1, 1, rng);
    assert.ok(result.attributes.physical.speed >= before);
    assert.ok(result.fatigueDelta > 0);
  });

  it("recovery training reduces fatigue and raises morale", () => {
    const rng = new RNG(7);
    const player = createPlayer(
      { firstName: "A", lastName: "B", position: "WR", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 72, weightLbs: 190, personality: [], currentYear: 2026 },
      rng
    );
    const result = applyTraining(player.attributes, "recovery", 1, 1, rng);
    assert.ok(result.fatigueDelta < 0);
    assert.ok(result.moraleDelta > 0);
  });

  it("tapers training gains near a player's potential instead of allowing an infinite dominant grind", () => {
    const early = trainingGrowthMultiplier(70, 50);
    const nearCeiling = trainingGrowthMultiplier(70, 84);
    assert.ok(early > nearCeiling, "a skill well below potential should grow faster than one already beyond the soft ceiling");
    assert.ok(nearCeiling >= 0.12, "the soft ceiling must still permit rare late-career growth");
  });
});
