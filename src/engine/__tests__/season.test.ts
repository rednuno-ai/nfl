import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateHighSchoolSchedule,
  generateCollegeSchedule,
  generateNFLSchedule,
  emptyRecord,
  recordResult,
  winPct,
  qualifiesForPlayoffs,
  simulatePlayoffRun,
} from "../simulation/season";
import { TEAMS } from "../teams";
import { COLLEGES } from "../colleges";
import { RNG } from "../rng";

describe("season", () => {
  describe("schedule generation", () => {
    it("generateHighSchoolSchedule produces sequential weeks with no duplicate opponents", () => {
      const schedule = generateHighSchoolSchedule(new RNG(1), 10);
      assert.equal(schedule.length, 10);
      schedule.forEach((entry, i) => assert.equal(entry.week, i + 1));
      const labels = new Set(schedule.map((s) => s.opponentLabel));
      assert.equal(labels.size, schedule.length, "no repeated high school opponents in one season");
    });

    it("generateCollegeSchedule never schedules the player's own school and has no duplicate opponents", () => {
      const own = COLLEGES[0].id;
      const schedule = generateCollegeSchedule(own, new RNG(3), 12);
      assert.equal(schedule.length, 12);
      assert.ok(schedule.every((s) => s.opponentId !== own));
      const ids = new Set(schedule.map((s) => s.opponentId));
      assert.equal(ids.size, schedule.length);
    });

    it("generateNFLSchedule never schedules the player's own team across many seeds", () => {
      const own = TEAMS[5].id;
      for (let seed = 1; seed <= 20; seed++) {
        const schedule = generateNFLSchedule(own, new RNG(seed), 17);
        assert.equal(schedule.length, 17);
        assert.ok(schedule.every((s) => s.opponentId !== own), `seed ${seed}: own team ${own} appeared in its own schedule`);
        schedule.forEach((entry, i) => assert.equal(entry.week, i + 1));
      }
    });

    it("alternates home/away starting at home for week 1", () => {
      const schedule = generateNFLSchedule(TEAMS[0].id, new RNG(1), 6);
      schedule.forEach((entry, i) => assert.equal(entry.isHome, i % 2 === 0, `week ${entry.week} home/away mismatch`));
    });
  });

  describe("record tracking", () => {
    it("emptyRecord starts at 0-0-0 with a 0 win pct", () => {
      const record = emptyRecord();
      assert.deepEqual(record, { wins: 0, losses: 0, ties: 0 });
      assert.equal(winPct(record), 0);
    });

    it("recordResult accumulates wins/losses/ties independently", () => {
      let record = emptyRecord();
      record = recordResult(record, "win");
      record = recordResult(record, "win");
      record = recordResult(record, "loss");
      record = recordResult(record, "tie");
      assert.deepEqual(record, { wins: 2, losses: 1, ties: 1 });
    });

    it("winPct treats a tie as half a win", () => {
      const record = { wins: 1, losses: 1, ties: 2 };
      assert.equal(winPct(record), (1 + 2 * 0.5) / 4);
    });
  });

  describe("qualifiesForPlayoffs", () => {
    it("never qualifies a team under .400", () => {
      const record = { wins: 3, losses: 14, ties: 0 };
      for (let seed = 1; seed <= 20; seed++) {
        assert.equal(qualifiesForPlayoffs(record, 90, new RNG(seed)), false);
      }
    });

    it("always qualifies a team at .700 or better regardless of prestige", () => {
      const record = { wins: 12, losses: 5, ties: 0 };
      for (let seed = 1; seed <= 20; seed++) {
        assert.equal(qualifiesForPlayoffs(record, 10, new RNG(seed)), true);
      }
    });

    it("is probabilistic (not always true or false) for a middling record in between", () => {
      const record = { wins: 9, losses: 8, ties: 0 }; // pct ~0.529, in the probabilistic band
      let qualified = 0;
      for (let seed = 1; seed <= 200; seed++) {
        if (qualifiesForPlayoffs(record, 50, new RNG(seed))) qualified++;
      }
      assert.ok(qualified > 0 && qualified < 200, `expected a mix of outcomes, got ${qualified}/200 qualifying`);
    });
  });

  describe("simulatePlayoffRun", () => {
    it("stops at the first loss and never returns more than 4 rounds", () => {
      for (let seed = 1; seed <= 50; seed++) {
        const { rounds } = simulatePlayoffRun(70, new RNG(seed));
        assert.ok(rounds.length >= 1 && rounds.length <= 4);
        for (let i = 0; i < rounds.length - 1; i++) {
          assert.equal(rounds[i].won, true, "every round before the last must be a win");
        }
      }
    });

    it("wonSuperBowl is true only when all 4 rounds are played and the last is a win", () => {
      for (let seed = 1; seed <= 200; seed++) {
        const { rounds, wonSuperBowl } = simulatePlayoffRun(85, new RNG(seed), 90);
        if (wonSuperBowl) {
          assert.equal(rounds.length, 4);
          assert.equal(rounds[3].won, true);
        } else {
          assert.ok(rounds.length < 4 || !rounds[3].won);
        }
      }
    });

    it("a dominant team+player wins the Super Bowl far more often than a weak one, across many seeds", () => {
      let strongWins = 0;
      let weakWins = 0;
      for (let seed = 1; seed <= 150; seed++) {
        if (simulatePlayoffRun(95, new RNG(seed + 1000), 95).wonSuperBowl) strongWins++;
        if (simulatePlayoffRun(40, new RNG(seed + 1000), 40).wonSuperBowl) weakWins++;
      }
      assert.ok(strongWins > weakWins, `strong team (${strongWins}) should win more often than a weak team (${weakWins})`);
    });

    it("never reports a negative score", () => {
      for (let seed = 1; seed <= 100; seed++) {
        const { rounds } = simulatePlayoffRun(60, new RNG(seed));
        for (const r of rounds) {
          assert.ok(r.scorePlayer >= 0 && r.scoreOpponent >= 0);
        }
      }
    });
  });
});
