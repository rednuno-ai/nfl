import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { runBalanceCohort, runCareerSimulation } from "../balance";
import { ALL_POSITIONS } from "../types";

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
  }, 20_000);

  it("keeps recovery meaningful instead of making all-out training strictly dominant", () => {
    const grind = runBalanceCohort({ size: 200, seed: 73, strategy: "grind" });
    const balanced = runBalanceCohort({ size: 200, seed: 73, strategy: "balanced" });
    const recovery = runBalanceCohort({ size: 200, seed: 73, strategy: "recovery" });
    assert.ok(grind.averagePeakOverall > recovery.averagePeakOverall, "hard training should have a development upside");
    // Injury-career rate can saturate near 100% over a long career, so use the
    // incident count to assert the meaningful cost of sustained hard training.
    assert.ok(grind.averageInjuries >= balanced.averageInjuries, "hard training should carry an observable injury cost");
    assert.ok(recovery.averageInjuries <= grind.averageInjuries, "recovery should protect availability");
  }, 20_000);

  it("covers every position with independently reproducible seeds and keeps its invariants intact", () => {
    const options = { careersPerPosition: 2, strategyCareersPerPosition: 1, seed: 91_004 };
    const first = runCareerSimulation(options);
    const second = runCareerSimulation(options);

    assert.deepEqual(first, second, "a fixed seed must replay the exact same cohort");
    assert.equal(first.baselineCareers, ALL_POSITIONS.length * 2);
    assert.equal(first.totalCareers, ALL_POSITIONS.length * 5);
    assert.deepEqual(first.positions.map((summary) => summary.position), ALL_POSITIONS);
    assert.ok(first.positions.every((summary) => summary.averageContracts > 0));
    assert.equal(first.impossibleResultFindings[0].severity, "pass");
    assert.ok(first.dominantStrategyFindings.some((finding) => finding.id === "dominant_strategy"));
    assert.ok(first.positionAuditFindings.some((finding) => finding.id === "award_rate_equity" || finding.id.startsWith("award_rate_")));
  });

  it("keeps grind as a trade-off and gives every position a valid award path", () => {
    const report = runCareerSimulation({ careersPerPosition: 40, strategyCareersPerPosition: 20, seed: 20_260_901 });
    const dominance = report.dominantStrategyFindings.find((finding) => finding.id === "dominant_strategy");

    assert.equal(dominance?.severity, "pass", dominance?.message);
    assert.equal(report.impossibleResultFindings.some((finding) => finding.severity !== "pass"), false);
    assert.ok(report.positions.every((summary) => summary.awards.proBowls + summary.awards.allPros + summary.awards.mvps > 0));
    assert.equal(report.positionAuditFindings.some((finding) => finding.severity === "failure"), false);
  }, 20_000);
});
