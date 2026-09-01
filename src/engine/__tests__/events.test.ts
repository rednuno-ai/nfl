import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createPlayer } from "../player";
import { RNG } from "../rng";
import { isEligible, createEmptyEventMemory, rollEligibleEvents, markFired } from "../events/engine";
import type { GameEventDefinition } from "../types";
import { CONTINUITY_EVENTS, POSITION_EVENTS } from "../events/data";

function testPlayer() {
  return createPlayer(
    { firstName: "A", lastName: "B", position: "QB", hometownCity: "X", hometownState: "TX", hand: "right", heightInches: 74, weightLbs: 220, personality: [], currentYear: 2026 },
    new RNG(11)
  );
}

const sampleEvent: GameEventDefinition = {
  id: "test_event",
  category: "high_school",
  title: "Test Event",
  description: "A test event",
  conditions: { stage: ["high_school"], minAge: 15, probability: 1 },
  cooldownWeeks: 5,
  tags: [],
  choices: [
    { id: "choice_a", label: "A", consequences: { attributeDeltas: [{ path: "general.confidence", delta: 5 }] } },
    { id: "choice_b", label: "B", consequences: { cash: 100 } },
  ],
};

describe("event engine", () => {
  it("is eligible when conditions match", () => {
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const eligible = isEligible(sampleEvent, {
      player,
      stage: "high_school",
      week: 1,
      coachRelationship: 50,
      fame: 5,
      tags: new Set(),
      firedAt,
      firedOnce,
    });
    assert.equal(eligible, true);
  });

  it("is ineligible outside the required stage", () => {
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const eligible = isEligible(sampleEvent, {
      player,
      stage: "college",
      week: 1,
      coachRelationship: 50,
      fame: 5,
      tags: new Set(),
      firedAt,
      firedOnce,
    });
    assert.equal(eligible, false);
  });

  it("respects cooldown after firing", () => {
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const ctx = { player, stage: "high_school" as const, week: 1, coachRelationship: 50, fame: 5, tags: new Set<string>(), firedAt, firedOnce };
    markFired(ctx, sampleEvent);
    const eligibleImmediately = isEligible(sampleEvent, { ...ctx, week: 2 });
    assert.equal(eligibleImmediately, false);
    const eligibleAfterCooldown = isEligible(sampleEvent, { ...ctx, week: 10 });
    assert.equal(eligibleAfterCooldown, true);
  });

  it("respects the `once` flag", () => {
    const onceEvent: GameEventDefinition = { ...sampleEvent, id: "once_event", once: true, cooldownWeeks: 0 };
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const ctx = { player, stage: "high_school" as const, week: 1, coachRelationship: 50, fame: 5, tags: new Set<string>(), firedAt, firedOnce };
    assert.equal(isEligible(onceEvent, ctx), true);
    markFired(ctx, onceEvent);
    assert.equal(isEligible(onceEvent, { ...ctx, week: 500 }), false);
  });

  it("can gate a story opportunity on the player's personality", () => {
    const event = {
      id: "personality_gate",
      category: "personal" as const,
      title: "Personality Gate",
      description: "test",
      conditions: { personalityAny: ["charismatic" as const], probability: 1 },
      choices: [],
      cooldownWeeks: 0,
      tags: [],
    };
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const context = { player, stage: "high_school" as const, week: 1, coachRelationship: 50, fame: 5, tags: new Set<string>(), firedAt, firedOnce };
    assert.equal(isEligible(event, context), false);
    context.player = { ...context.player, personality: ["charismatic"] };
    assert.equal(isEligible(event, context), true);
  });

  it("rollEligibleEvents only returns events passing their probability roll", () => {
    const player = testPlayer();
    const { firedAt, firedOnce } = createEmptyEventMemory();
    const guaranteedEvent = { ...sampleEvent, conditions: { ...sampleEvent.conditions, probability: 1 } };
    const impossibleEvent = { ...sampleEvent, id: "impossible", conditions: { ...sampleEvent.conditions, probability: 0 } };
    const ctx = { player, stage: "high_school" as const, week: 1, coachRelationship: 50, fame: 5, tags: new Set<string>(), firedAt, firedOnce };
    const result = rollEligibleEvents([guaranteedEvent, impossibleEvent], ctx, new RNG(1));
    assert.ok(result.some((e) => e.id === "test_event"));
    assert.ok(!result.some((e) => e.id === "impossible"));
  });

  it("ships a narrative event for each MVP-depth position and keeps it position-gated", () => {
    const positions = ["QB", "RB", "WR", "TE", "LB", "CB"] as const;
    for (const position of positions) {
      const event = POSITION_EVENTS.find((candidate) => candidate.conditions.positions?.includes(position));
      assert.ok(event, `expected a position narrative for ${position}`);
      assert.equal(event!.choices.length >= 2, true, `${position} story should preserve player agency`);
      assert.ok(event!.choices.every((choice) => choice.description), `${position} choices should explain the trade-off`);
    }
  });

  it("ships connected narrative arcs with delayed consequences and mixed outcomes", () => {
    const promise = CONTINUITY_EVENTS.find((event) => event.id === "continuity_coach_promise");
    const due = CONTINUITY_EVENTS.find((event) => event.id === "continuity_coach_promise_due");
    const rivalry = CONTINUITY_EVENTS.find((event) => event.id === "continuity_rival_rematch");
    assert.ok(promise?.tags.includes("arc:coach-promise"));
    assert.ok(due?.conditions.tagsPresent?.includes("promise:coach:film"));
    assert.ok(due?.choices.some((choice) => choice.consequences.addTags?.includes("promise:coach:broken")));
    assert.ok(rivalry?.choices.some((choice) => (choice.consequences.injuryChance ?? 0) > 0));
  });
});
