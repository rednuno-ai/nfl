import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createPlayer } from "../player";
import { computeOverall } from "../attributes";
import { RNG } from "../rng";

function makeInput(overrides: Partial<Parameters<typeof createPlayer>[0]> = {}) {
  return {
    firstName: "Jordan",
    lastName: "Reed",
    position: "QB" as const,
    hometownCity: "Ironpoint",
    hometownState: "TX",
    hand: "right" as const,
    heightInches: 74,
    weightLbs: 210,
    personality: ["ambitious" as const, "competitive" as const],
    currentYear: 2026,
    ...overrides,
  };
}

describe("player creation", () => {
  it("creates a 15-year-old freshman with valid attribute ranges", () => {
    const rng = new RNG(1);
    const player = createPlayer(makeInput(), rng);
    assert.equal(player.bio.age, 15);
    assert.equal(player.stage, "high_school");
    assert.equal(player.retired, false);

    for (const value of Object.values(player.attributes.physical)) {
      assert.ok(value >= 0 && value <= 100, `physical attribute out of range: ${value}`);
    }
    for (const value of Object.values(player.attributes.mental)) {
      assert.ok(value >= 0 && value <= 100);
    }
  });

  it("produces different players for different seeds", () => {
    const p1 = createPlayer(makeInput(), new RNG(1));
    const p2 = createPlayer(makeInput(), new RNG(2));
    assert.notEqual(JSON.stringify(p1.attributes), JSON.stringify(p2.attributes));
  });

  it("computes an overall rating within bounds for every position", () => {
    const positions = ["QB", "RB", "WR", "TE", "LB", "CB", "S", "OL", "DL", "K", "P"] as const;
    for (const position of positions) {
      const player = createPlayer(makeInput({ position }), new RNG(5));
      const overall = computeOverall(player.attributes, position);
      assert.ok(overall >= 20 && overall <= 99, `overall ${overall} out of range for ${position}`);
    }
  });
});
