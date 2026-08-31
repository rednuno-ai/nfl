import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runBalanceCohort } from "../balance";

describe("1,000-career balance cohort", () => {
  it("keeps the projected career distribution bounded, varied and reproducible", () => {
    const report = runBalanceCohort({ size: 1_000, seed: 42, strategy: "balanced" });
    assert.equal(report.careers, 1_000);
    assert.ok(report.averageNFLSeasons > 2 && report.averageNFLSeasons < 14, `unexpected average career length: ${report.averageNFLSeasons}`);
    assert.ok(report.averagePeakOverall > 55 && report.averagePeakOverall < 90, `unexpected average peak: ${report.averagePeakOverall}`);
    assert.ok(report.maxPeakOverall <= 99, "overall must remain capped");
    assert.ok(report.injuryCareerRate > 0.05 && report.injuryCareerRate < 0.95, `injury distribution collapsed: ${report.injuryCareerRate}`);
    assert.ok(report.averageBestOffer > 600_000, "successful careers should create meaningful offers");
    assert.ok(report.championships > 0, "the cohort should include some championships");
  });

  it("keeps recovery meaningful instead of making all-out training strictly dominant", () => {
    const grind = runBalanceCohort({ size: 200, seed: 73, strategy: "grind" });
    const balanced = runBalanceCohort({ size: 200, seed: 73, strategy: "balanced" });
    const recovery = runBalanceCohort({ size: 200, seed: 73, strategy: "recovery" });
    assert.ok(grind.averagePeakOverall > recovery.averagePeakOverall, "hard training should have a development upside");
    assert.ok(grind.injuryCareerRate >= balanced.injuryCareerRate, "hard training should carry an observable injury cost");
    assert.ok(recovery.averageInjuries <= grind.averageInjuries, "recovery should protect availability");
  });
});
