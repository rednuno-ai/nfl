import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLegacy, LEGACY_TIER_LABELS } from "../legacy";
import { emptyStatLine } from "../types";
import type { StatLine } from "../types";

function season(overrides: Partial<StatLine>): StatLine {
  return { ...emptyStatLine(2026, "nfl", "team_1"), ...overrides };
}

describe("legacy", () => {
  it("always tiers a career under 8 games played as a bust, no matter how gaudy the per-game stats are", () => {
    const result = computeLegacy({
      seasonStats: [season({ gamesPlayed: 3, passYards: 900, passTDs: 9, proBowl: true, mvp: true })],
      careerEarnings: 50_000_000,
      netWorth: 40_000_000,
      draftedRound: 1,
      seasonsPlayed: 1,
    });
    assert.equal(result.tier, "bust");
    assert.equal(result.gamesPlayed, 3);
  });

  it("gives a modest, accolade-free career a solid_career tier, with an undrafted bonus counted in", () => {
    const result = computeLegacy({
      seasonStats: [season({ gamesPlayed: 10 })],
      careerEarnings: 2_000_000,
      netWorth: 1_500_000,
      draftedRound: 0, // undrafted -> +8 bonus
      seasonsPlayed: 3, // longevity: min(30, 3*2.2) = 6.6
    });
    // productionScore 0, accoladeScore 0 -> score = round(0 + 0 + 6.6 + 8) = 15
    assert.equal(result.score, 15);
    assert.equal(result.tier, "solid_career");
  });

  it("a career with a couple Pro Bowls and modest production lands in the star tier", () => {
    const result = computeLegacy({
      seasonStats: [season({ gamesPlayed: 10, passYards: 12_000, proBowl: true }), season({ gamesPlayed: 10, allPro: true })],
      careerEarnings: 40_000_000,
      netWorth: 20_000_000,
      draftedRound: 1,
      seasonsPlayed: 15, // longevity capped at 30
    });
    assert.equal(result.tier, "star");
    assert.ok(result.score >= 35 && result.score < 65);
  });

  it("a career with several Pro Bowls, All-Pros, and a ring lands in the superstar tier", () => {
    const result = computeLegacy({
      seasonStats: [
        season({ gamesPlayed: 16, passYards: 12_000, proBowl: true, championshipWon: true }),
        season({ gamesPlayed: 16, proBowl: true, allPro: true }),
        season({ gamesPlayed: 16, proBowl: true }),
        season({ gamesPlayed: 16, proBowl: true, allPro: true }),
      ],
      careerEarnings: 120_000_000,
      netWorth: 60_000_000,
      draftedRound: 1,
      seasonsPlayed: 15,
    });
    assert.equal(result.tier, "superstar");
    assert.ok(result.score >= 65 && result.score < 100);
  });

  it("a decorated multi-MVP champion lands in the legend or hall_of_fame tier", () => {
    const result = computeLegacy({
      seasonStats: [
        season({ gamesPlayed: 16, passYards: 12_000, proBowl: true, allPro: true, mvp: true, championshipWon: true }),
        season({ gamesPlayed: 16, proBowl: true, allPro: true }),
        season({ gamesPlayed: 16, proBowl: true, allPro: true }),
        season({ gamesPlayed: 16, proBowl: true }),
        season({ gamesPlayed: 16, proBowl: true }),
      ],
      careerEarnings: 250_000_000,
      netWorth: 150_000_000,
      draftedRound: 1,
      seasonsPlayed: 14,
    });
    assert.ok(["legend", "hall_of_fame"].includes(result.tier), `expected an elite tier, got ${result.tier}`);
    assert.ok(result.score >= 100);
  });

  it("counts championships, proBowls, allPros, and mvps from the season history accurately", () => {
    const result = computeLegacy({
      seasonStats: [
        season({ gamesPlayed: 16, proBowl: true, championshipWon: true }),
        season({ gamesPlayed: 16, allPro: true, mvp: true, championshipWon: true }),
      ],
      careerEarnings: 10_000_000,
      netWorth: 5_000_000,
      draftedRound: 3,
      seasonsPlayed: 2,
    });
    assert.equal(result.championships, 2);
    assert.equal(result.proBowls, 1);
    assert.equal(result.allPros, 1);
    assert.equal(result.mvps, 1);
  });

  it("LEGACY_TIER_LABELS has a human-readable label for every tier computeLegacy can produce", () => {
    const tiers = ["bust", "solid_career", "star", "superstar", "legend", "hall_of_fame"] as const;
    for (const tier of tiers) {
      assert.ok(LEGACY_TIER_LABELS[tier] && LEGACY_TIER_LABELS[tier].length > 0);
    }
  });
});
