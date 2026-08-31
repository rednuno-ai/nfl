import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { RNG } from "../rng";

describe("RNG", () => {
  it("is deterministic for a given seed", () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    assert.deepEqual(seqA, seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = new RNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
    }
  });

  it("resumes correctly from a saved state", () => {
    const rng = new RNG(999);
    rng.next();
    rng.next();
    const state = rng.getState();
    const expectedNext = rng.next();

    const resumed = RNG.fromState(state);
    const actualNext = resumed.next();
    assert.equal(actualNext, expectedNext);
  });

  it("int() respects bounds", () => {
    const rng = new RNG(7);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 8);
      assert.ok(v >= 3 && v <= 8);
    }
  });

  it("weighted() never returns an item with a false-y branch when one weight dominates", () => {
    const rng = new RNG(1);
    const results = new Set<string>();
    for (let i = 0; i < 200; i++) {
      results.add(
        rng.weighted([
          { item: "a", weight: 1000 },
          { item: "b", weight: 0.001 },
        ])
      );
    }
    assert.ok(results.has("a"));
  });
});
