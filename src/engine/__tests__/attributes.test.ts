import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  generateInitialAttributes,
  computeOverall,
  getAttributeByPath,
  applyAttributeDelta,
  applyAttributeDeltas,
  setAttributeByPath,
  applyPointBuy,
  previewPointBuyOverall,
  POINT_BUY_SLOTS,
  POINT_BUY_BASELINE,
  POINT_BUY_POOL,
  POINT_BUY_MAX,
  applyBuildEffects,
  getBuildEffects,
  pointBuyPointsLeft,
  recommendedPointBuyAllocations,
} from "../attributes";
import { RNG } from "../rng";
import type { Position } from "../types";

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "LB", "CB", "S", "OL", "DL", "K", "P"];

describe("attributes", () => {
  describe("generateInitialAttributes", () => {
    it("produces plausible, in-range values for every position across many seeds and talent levels", () => {
      for (const position of POSITIONS) {
        for (let seed = 1; seed <= 10; seed++) {
          const talent = seed / 10;
          const attrs = generateInitialAttributes(position, talent, new RNG(seed));
          assert.ok(attrs.general.potential >= 40 && attrs.general.potential <= 99);
          assert.ok(attrs.physical.durability >= 20 && attrs.physical.durability <= 95);
          assert.ok(attrs.physical.speed >= 20 && attrs.physical.speed <= 75);
        }
      }
    });

    it("gives higher talent a higher expected potential", () => {
      const lowTalentPotentials = Array.from({ length: 50 }, (_, i) => generateInitialAttributes("QB", 0, new RNG(i + 1)).general.potential);
      const highTalentPotentials = Array.from({ length: 50 }, (_, i) => generateInitialAttributes("QB", 1, new RNG(i + 1)).general.potential);
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      assert.ok(avg(highTalentPotentials) > avg(lowTalentPotentials), "talent=1 should average a higher potential than talent=0");
    });
  });

  describe("computeOverall", () => {
    it("stays within the documented 20-99 bound for every position", () => {
      for (const position of POSITIONS) {
        for (let seed = 1; seed <= 15; seed++) {
          const attrs = generateInitialAttributes(position, seed / 15, new RNG(seed));
          const overall = computeOverall(attrs, position);
          assert.ok(overall >= 20 && overall <= 99, `${position} seed ${seed}: overall ${overall} out of [20, 99]`);
          assert.ok(Number.isInteger(overall));
        }
      }
    });

    it("rewards a maxed-out attribute set with a near-ceiling overall for every position", () => {
      for (const position of POSITIONS) {
        const attrs = generateInitialAttributes(position, 1, new RNG(1));
        const maxed = JSON.parse(JSON.stringify(attrs));
        const setAll = (obj: Record<string, unknown>) => {
          for (const key of Object.keys(obj)) {
            if (typeof obj[key] === "number") obj[key] = 100;
            else if (typeof obj[key] === "object" && obj[key] !== null) setAll(obj[key] as Record<string, unknown>);
          }
        };
        setAll(maxed.physical);
        setAll(maxed.mental);
        setAll(maxed.position[position]);
        assert.equal(computeOverall(maxed, position), 99, `${position} with every relevant attribute at 100 should hit the 99 ceiling`);
      }
    });
  });

  describe("dotted-path get/set", () => {
    it("getAttributeByPath reads a nested numeric field", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      assert.equal(getAttributeByPath(attrs, "physical.speed"), attrs.physical.speed);
    });

    it("getAttributeByPath returns 0 for a non-existent path instead of throwing", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      assert.equal(getAttributeByPath(attrs, "physical.nonexistent"), 0);
      assert.equal(getAttributeByPath(attrs, "totally.bogus.path"), 0);
    });

    it("applyAttributeDelta adjusts and clamps to [0, 100], without mutating the input", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      const before = attrs.physical.speed;
      const next = applyAttributeDelta(attrs, "physical.speed", 5);
      assert.equal(next.physical.speed, Math.min(100, before + 5));
      assert.equal(attrs.physical.speed, before, "original attributes object should be untouched");

      const overflowed = applyAttributeDelta(attrs, "physical.speed", 1000);
      assert.equal(overflowed.physical.speed, 100);
      const underflowed = applyAttributeDelta(attrs, "physical.speed", -1000);
      assert.equal(underflowed.physical.speed, 0);
    });

    it("applyAttributeDeltas applies a batch of deltas in sequence", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      const next = applyAttributeDeltas(attrs, [
        { path: "physical.speed", delta: 2 },
        { path: "mental.composure", delta: -3 },
      ]);
      assert.equal(next.physical.speed, applyAttributeDelta(attrs, "physical.speed", 2).physical.speed);
      assert.equal(next.mental.composure, applyAttributeDelta(attrs, "mental.composure", -3).mental.composure);
    });

    it("setAttributeByPath pins an absolute value, clamped to [0, 100]", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      assert.equal(setAttributeByPath(attrs, "physical.speed", 42).physical.speed, 42);
      assert.equal(setAttributeByPath(attrs, "physical.speed", 500).physical.speed, 100);
      assert.equal(setAttributeByPath(attrs, "physical.speed", -500).physical.speed, 0);
    });
  });

  describe("point-buy character creation", () => {
    it("applyPointBuy pins each curated slot to baseline + allocated points", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(1));
      const slots = POINT_BUY_SLOTS.QB!;
      const allocations: Record<string, number> = {};
      slots.forEach((slot, i) => (allocations[slot.path] = i));
      const next = applyPointBuy(attrs, "QB", allocations);
      slots.forEach((slot, i) => {
        assert.equal(getAttributeByPath(next, slot.path), POINT_BUY_BASELINE + i);
      });
    });

    it("is a no-op for a position with no curated slots", () => {
      const attrs = generateInitialAttributes("OL", 0.5, new RNG(1));
      const next = applyPointBuy(attrs, "OL", { "position.OL.blocking": 20 });
      assert.deepEqual(next, attrs);
    });

    it("spending the full pool on one slot never exceeds POINT_BUY_MAX", () => {
      const preview = previewPointBuyOverall("QB", { "position.QB.shortAccuracy": POINT_BUY_POOL });
      assert.ok(POINT_BUY_BASELINE + POINT_BUY_POOL <= POINT_BUY_MAX, "pool fully spent on one slot should not exceed the documented max");
      assert.ok(preview >= 20 && preview <= 99);
    });

    it("previewPointBuyOverall increases as more points are allocated to relevant slots", () => {
      const zero = previewPointBuyOverall("WR", {});
      const boosted = previewPointBuyOverall("WR", { "position.WR.catching": 15, "position.WR.routeRunning": 9 });
      assert.ok(boosted > zero, "allocating points to relevant slots should raise the previewed overall");
    });

    it("tracks the exact 24, 1 and 0-point remaining states", () => {
      assert.equal(pointBuyPointsLeft("QB", {}), 24);
      assert.equal(pointBuyPointsLeft("QB", { "position.QB.shortAccuracy": 23 }), 1);
      assert.equal(pointBuyPointsLeft("QB", { "position.QB.shortAccuracy": 24 }), 0);
    });

    it("generates a legal, complete recommended build", () => {
      const allocations = recommendedPointBuyAllocations("WR");
      assert.equal(pointBuyPointsLeft("WR", allocations), 0);
      assert.equal(Object.values(allocations).reduce((sum, points) => sum + points, 0), POINT_BUY_POOL);
      assert.ok(Object.values(allocations).every((points) => points >= 0 && points <= POINT_BUY_MAX - POINT_BUY_BASELINE));
    });

    it("uses the documented body-profile advantages and trade-offs", () => {
      const attrs = generateInitialAttributes("QB", 0.5, new RNG(8));
      const tall = applyBuildEffects(attrs, 76, 225);
      assert.equal(tall.physical.strength, Math.min(100, attrs.physical.strength + 4));
      assert.equal(tall.physical.durability, Math.min(100, attrs.physical.durability + 2));
      assert.equal(tall.physical.agility, Math.max(0, attrs.physical.agility - 1));
      assert.equal(tall.physical.acceleration, Math.max(0, attrs.physical.acceleration - 1));
      assert.equal(getBuildEffects(72, 200).height.deltas.length, 0);
      assert.equal(getBuildEffects(72, 200).weight.deltas.length, 0);
    });
  });
});
