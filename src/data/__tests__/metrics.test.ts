import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  __metricsTestOnly,
  abandonOnboarding,
  completeOnboarding,
  readInternalMetrics,
  recordDailyReturn,
  recordFirstGameCompleted,
  recordFirstGameStarted,
  recordGameDecision,
  recordInternalMetric,
  recordWeeklyPriority,
  setOnboardingStage,
  startOnboarding,
} from "../metrics";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

describe("internal metrics", () => {
  it("records onboarding milestones by stage without account data", () => {
    installStorage();
    startOnboarding();
    setOnboardingStage("attributes");
    abandonOnboarding();
    const metrics = readInternalMetrics();
    assert.equal(metrics.counts["onboarding_started:bio"], 1);
    assert.equal(metrics.counts["onboarding_abandoned:attributes"], 1);
    assert.equal(metrics.pendingOnboardingStage, undefined);
    assert.equal(JSON.stringify(metrics).includes("username"), false);
    assert.equal(JSON.stringify(metrics).includes(__metricsTestOnly.METRICS_KEY), false);
  });

  it("counts a completed onboarding and each first-game milestone once", () => {
    installStorage();
    startOnboarding();
    completeOnboarding();
    recordFirstGameStarted();
    recordFirstGameStarted();
    recordFirstGameCompleted();
    recordFirstGameCompleted();
    const metrics = readInternalMetrics();
    assert.equal(metrics.counts.onboarding_completed, 1);
    assert.equal(metrics.counts.first_game_started, 1);
    assert.equal(metrics.counts.first_game_completed, 1);
  });

  it("records next-day return and the unfinished stage", () => {
    installStorage();
    startOnboarding();
    setOnboardingStage("attributes");
    recordDailyReturn(new Date("2026-08-29T10:00:00.000Z"));
    recordDailyReturn(new Date("2026-08-30T10:00:00.000Z"));
    const metrics = readInternalMetrics();
    assert.equal(metrics.counts.returned_next_day, 1);
    assert.equal(metrics.counts["onboarding_abandoned:attributes"], 1);
  });

  it("keeps decision, season and recovery telemetry coarse and local", () => {
    installStorage();
    recordWeeklyPriority("recovery");
    recordGameDecision("deep_pass");
    recordInternalMetric("season_completed");
    recordInternalMetric("save_failed");
    recordGameDecision("not allowed spaces");
    const metrics = readInternalMetrics();
    assert.equal(metrics.counts["weekly_priority:recovery"], 1);
    assert.equal(metrics.counts["game_decision:deep_pass"], 1);
    assert.equal(metrics.counts.season_completed, 1);
    assert.equal(metrics.counts.save_failed, 1);
    assert.equal(metrics.counts["game_decision:not allowed spaces"], undefined);
    assert.equal(JSON.stringify(metrics).includes("player-one"), false);
  });
});
