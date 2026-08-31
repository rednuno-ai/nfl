import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_DEFINITIONS,
  achievementDef,
  initialAchievements,
  unlock,
  checkGameAchievements,
  checkCareerEarningsAchievement,
  checkSeasonsAchievement,
  checkTeamHistoryAchievements,
} from "../achievements";
import { emptyStatLine } from "../types";
import type { StatLine } from "../types";

function line(overrides: Partial<StatLine>): StatLine {
  return { ...emptyStatLine(2026, "nfl", "team_1"), ...overrides };
}

describe("achievements", () => {
  it("initialAchievements starts every achievement locked", () => {
    const achievements = initialAchievements();
    assert.equal(achievements.length, ACHIEVEMENT_DEFINITIONS.length);
    assert.ok(achievements.every((a) => a.unlockedWeek === null));
  });

  it("achievementDef looks up a definition by id and returns undefined for an unknown one", () => {
    assert.equal(achievementDef("mvp")?.title, "MVP");
    assert.equal(achievementDef("not_a_real_id"), undefined);
  });

  describe("unlock", () => {
    it("stamps the unlock week the first time", () => {
      const achievements = unlock(initialAchievements(), "mvp", 42);
      assert.equal(achievements.find((a) => a.id === "mvp")!.unlockedWeek, 42);
    });

    it("never overwrites an already-unlocked achievement's week (idempotent)", () => {
      let achievements = unlock(initialAchievements(), "mvp", 10);
      achievements = unlock(achievements, "mvp", 99);
      assert.equal(achievements.find((a) => a.id === "mvp")!.unlockedWeek, 10, "the original unlock week should stick");
    });

    it("unlocking an unknown id is a harmless no-op", () => {
      const before = initialAchievements();
      const after = unlock(before, "not_a_real_id", 5);
      assert.deepEqual(after, before);
    });
  });

  describe("checkGameAchievements", () => {
    it("unlocks first_nfl_start only on a first career game where the player started", () => {
      const a = checkGameAchievements(initialAchievements(), 1, true, line({}), true);
      assert.notEqual(a.find((x) => x.id === "first_nfl_start")!.unlockedWeek, null);

      const b = checkGameAchievements(initialAchievements(), 1, false, line({}), true);
      assert.equal(b.find((x) => x.id === "first_nfl_start")!.unlockedWeek, null, "benched on the first game shouldn't unlock it");

      const c = checkGameAchievements(initialAchievements(), 5, true, line({}), false);
      assert.equal(c.find((x) => x.id === "first_nfl_start")!.unlockedWeek, null, "starting a later game (not the first) shouldn't unlock it");
    });

    it("unlocks first_touchdown on any scoring stat line, offense or defense-adjacent", () => {
      const passTD = checkGameAchievements(initialAchievements(), 1, true, line({ passTDs: 1 }), false);
      const rushTD = checkGameAchievements(initialAchievements(), 1, true, line({ rushTDs: 1 }), false);
      const recTD = checkGameAchievements(initialAchievements(), 1, true, line({ receivingTDs: 1 }), false);
      const noTD = checkGameAchievements(initialAchievements(), 1, true, line({}), false);
      for (const result of [passTD, rushTD, recTD]) {
        assert.notEqual(result.find((x) => x.id === "first_touchdown")!.unlockedWeek, null);
      }
      assert.equal(noTD.find((x) => x.id === "first_touchdown")!.unlockedWeek, null);
    });
  });

  it("checkCareerEarningsAchievement unlocks only at $100M or more", () => {
    const under = checkCareerEarningsAchievement(initialAchievements(), 1, 99_999_999);
    const at = checkCareerEarningsAchievement(initialAchievements(), 1, 100_000_000);
    assert.equal(under.find((a) => a.id === "hundred_million_career")!.unlockedWeek, null);
    assert.notEqual(at.find((a) => a.id === "hundred_million_career")!.unlockedWeek, null);
  });

  it("checkSeasonsAchievement unlocks only at 15+ seasons", () => {
    const under = checkSeasonsAchievement(initialAchievements(), 1, 14);
    const at = checkSeasonsAchievement(initialAchievements(), 1, 15);
    assert.equal(under.find((a) => a.id === "fifteen_seasons")!.unlockedWeek, null);
    assert.notEqual(at.find((a) => a.id === "fifteen_seasons")!.unlockedWeek, null);
  });

  describe("checkTeamHistoryAchievements", () => {
    it("unlocks journeyman at 4+ teams regardless of retirement status", () => {
      const teams = new Set(["a", "b", "c", "d"]);
      const active = checkTeamHistoryAchievements(initialAchievements(), 1, teams, false);
      assert.notEqual(active.find((a) => a.id === "journeyman")!.unlockedWeek, null);
    });

    it("unlocks one_team_man only on retirement with exactly one team, never mid-career", () => {
      const oneTeam = new Set(["a"]);
      const midCareer = checkTeamHistoryAchievements(initialAchievements(), 1, oneTeam, false);
      const retired = checkTeamHistoryAchievements(initialAchievements(), 1, oneTeam, true);
      assert.equal(midCareer.find((a) => a.id === "one_team_man")!.unlockedWeek, null, "still playing shouldn't unlock it yet");
      assert.notEqual(retired.find((a) => a.id === "one_team_man")!.unlockedWeek, null);
    });

    it("never unlocks one_team_man for a player who bounced between 2-3 teams", () => {
      const twoTeams = new Set(["a", "b"]);
      const retired = checkTeamHistoryAchievements(initialAchievements(), 1, twoTeams, true);
      assert.equal(retired.find((a) => a.id === "one_team_man")!.unlockedWeek, null);
    });
  });
});
