import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addStatLine, sumStatLines, careerTotals, passerRating, yardsPerCarry, yardsPerReception } from "../stats";
import { emptyStatLine } from "../types";
import type { StatLine } from "../types";

function line(overrides: Partial<StatLine>): StatLine {
  return { ...emptyStatLine(2026, "nfl", "team_1"), ...overrides };
}

describe("stats", () => {
  it("addStatLine sums numeric fields and ORs the meta booleans", () => {
    const a = line({ passYards: 200, passTDs: 2, proBowl: true });
    const b = line({ passYards: 150, passTDs: 1, allPro: false, mvp: true });
    const sum = addStatLine(a, b);
    assert.equal(sum.passYards, 350);
    assert.equal(sum.passTDs, 3);
    assert.equal(sum.proBowl, true, "proBowl should stay true once true in either input");
    assert.equal(sum.mvp, true);
    assert.equal(sum.allPro, false);
  });

  it("sumStatLines folds a list of games into one line stamped with the given season/level/team", () => {
    const games = [line({ rushYards: 50, rushAttempts: 10 }), line({ rushYards: 80, rushAttempts: 15 })];
    const season = sumStatLines(games, 2026, "nfl", "team_1");
    assert.equal(season.rushYards, 130);
    assert.equal(season.rushAttempts, 25);
    assert.equal(season.season, 2026);
    assert.equal(season.teamOrSchoolId, "team_1");
  });

  it("careerTotals returns an empty line for an empty history instead of throwing", () => {
    const totals = careerTotals([]);
    assert.equal(totals.gamesPlayed, 0);
    assert.equal(totals.teamOrSchoolId, "career");
  });

  it("careerTotals sums across multiple seasons and tags the result as a career total", () => {
    const seasons = [line({ passYards: 3000, gamesPlayed: 16 }), line({ passYards: 3500, gamesPlayed: 17 })];
    const totals = careerTotals(seasons);
    assert.equal(totals.passYards, 6500);
    assert.equal(totals.gamesPlayed, 33);
    assert.equal(totals.teamOrSchoolId, "career");
  });

  describe("passerRating", () => {
    it("returns 0 with no pass attempts instead of dividing by zero", () => {
      assert.equal(passerRating(line({})), 0);
    });

    it("rates a clean, efficient game highly and a turnover-heavy game low", () => {
      const great = line({ passAttempts: 30, passCompletions: 22, passYards: 320, passTDs: 3, interceptionsThrown: 0 });
      const poor = line({ passAttempts: 30, passCompletions: 12, passYards: 110, passTDs: 0, interceptionsThrown: 4 });
      assert.ok(passerRating(great) > passerRating(poor));
      assert.ok(passerRating(great) <= 158.3 + 0.1, "rating should stay near/under the real-world NFL 158.3 ceiling");
    });
  });

  describe("yardsPerCarry / yardsPerReception", () => {
    it("return 0 on zero attempts/receptions instead of NaN", () => {
      assert.equal(yardsPerCarry(line({})), 0);
      assert.equal(yardsPerReception(line({})), 0);
    });

    it("compute a rounded-to-one-decimal average", () => {
      assert.equal(yardsPerCarry(line({ rushAttempts: 3, rushYards: 10 })), 3.3);
      assert.equal(yardsPerReception(line({ receptions: 4, receivingYards: 51 })), 12.8);
    });
  });
});
