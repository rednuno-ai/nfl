import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createCareer, type CareerState } from "../career";
import { POINT_BUY_POOL } from "../attributes";
import { emptyStatLine, type GameEventDefinition } from "../types";
import { ALL_EVENTS } from "../events/data";
import { isEventEligible, selectWeightedEligibleEvent } from "../events/engine";
import { RNG } from "../rng";

function freshCareer(): CareerState {
  return createCareer({
    firstName: "Audit",
    lastName: "Player",
    position: "QB",
    hometownCity: "Ironpoint",
    hometownState: "TX",
    hand: "right",
    heightInches: 74,
    weightLbs: 210,
    personality: ["competitive"],
    currentYear: 2026,
    attributeAllocations: { "position.QB.shortAccuracy": POINT_BUY_POOL },
  });
}

function event(id: string): GameEventDefinition {
  const found = ALL_EVENTS.find((candidate) => candidate.id === id);
  assert.ok(found, `Expected event ${id}`);
  return found;
}

function establishedProfessional(): CareerState {
  const state = freshCareer();
  const season = { ...emptyStatLine(2028, "nfl", "team_1"), gamesPlayed: 12, gamesStarted: 10 };
  return {
    ...state,
    stage: "nfl_season",
    weekInSeason: 10,
    totalWeek: 130,
    careerSeasonsPlayed: 2,
    statHistory: [season],
    player: {
      ...state.player,
      bio: { ...state.player.bio, age: 22 },
      stage: "nfl_season",
      attributes: {
        ...state.player.attributes,
        general: { ...state.player.attributes.general, fame: 58, reputation: 45 },
      },
    },
  };
}

describe("central narrative eligibility", () => {
  it("rejects Paparazzi Outside for a 15-year-old in High School Week 1 with Fame 4", () => {
    const state = freshCareer();
    state.player.attributes.general.fame = 4;
    const result = isEventEligible(event("media_paparazzi_outside"), state);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.code === "stage"));
    assert.ok(result.reasons.some((reason) => reason.code === "fame_min"));
    assert.ok(result.reasons.some((reason) => reason.code === "games_min"));
  });

  it("accepts Paparazzi Outside only after a credible professional profile exists", () => {
    const result = isEventEligible(event("media_paparazzi_outside"), establishedProfessional());
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
  });

  it("rejects an event during its cooldown", () => {
    const state = establishedProfessional();
    state.eventMemory = { firedAt: [["media_paparazzi_outside", state.totalWeek - 4]], firedOnce: ["media_paparazzi_outside"], firedCount: [["media_paparazzi_outside", 1]] };
    const result = isEventEligible(event("media_paparazzi_outside"), state);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.code === "cooldown"));
  });

  it("rejects an event after its maximum occurrences", () => {
    const state = establishedProfessional();
    state.eventMemory = { firedAt: [], firedOnce: ["media_paparazzi_outside"], firedCount: [["media_paparazzi_outside", 3]] };
    const result = isEventEligible(event("media_paparazzi_outside"), state);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.code === "max_occurrences"));
  });

  it("explains a missing prerequisite event", () => {
    const state = freshCareer();
    state.totalWeek = 12;
    state.weekInSeason = 4;
    state.tags = ["promise:coach:film"];
    const result = isEventEligible(event("continuity_coach_promise_due"), state);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.code === "event_required"));
  });

  it("prevents contradictory events from coexisting", () => {
    const state = freshCareer();
    const incompatible: GameEventDefinition = {
      id: "incompatible_follow_up",
      category: "high_school",
      title: "Incompatible follow-up",
      description: "test",
      conditions: { stage: ["high_school"], incompatibleEvents: ["first_choice"], probability: 1 },
      cooldownWeeks: 0,
      tags: [],
      choices: [],
    };
    state.eventMemory = { firedAt: [], firedOnce: ["first_choice"], firedCount: [["first_choice", 1]] };
    const result = isEventEligible(incompatible, state);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.code === "event_incompatible"));
  });

  it("selects the same eligible story from the same seed", () => {
    const state = establishedProfessional();
    const candidates = ALL_EVENTS.filter((candidate) => candidate.category === "media");
    const first = selectWeightedEligibleEvent(candidates, state, new RNG(501));
    const second = selectWeightedEligibleEvent(candidates, state, new RNG(501));
    assert.equal(first?.id, second?.id);
  });

  it("never selects an event that fails mandatory requirements across seeds", () => {
    const state = freshCareer();
    const candidates = ALL_EVENTS.filter((candidate) => candidate.category === "media");
    for (let seed = 1; seed <= 100; seed++) {
      const selected = selectWeightedEligibleEvent(candidates, state, new RNG(seed));
      if (selected) assert.equal(isEventEligible(selected, state).eligible, true, `seed ${seed} selected ${selected.id}`);
    }
  });
});
