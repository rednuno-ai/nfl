import { describe, it, expect } from "vitest";
import { createCareer, advanceWeek, resolveDecision, chooseTrainingFocus, simulateActiveGame, acknowledgeFinishedGame, commitToCollege, type CareerState } from "../career";
import { restoreCareer } from "../../data/restoreCareer";
import { SaveQueue } from "../../data/saveQueue";
import { ALL_EVENTS } from "../events/data";
import { isEventEligible } from "../events/engine";
import { characterRequirements, hasMetCharacter } from "../characters";
import { generatePerformanceNews, generateSocialPost } from "../news";
import { RNG } from "../rng";
import { POINT_BUY_SLOTS } from "../attributes";
import type { Position } from "../types";

function fresh(position: Position = "QB") {
  return createCareer({ firstName: "Test", lastName: "Journey", position, hometownCity: "Austin", hometownState: "TX", hand: "right", heightInches: 74, weightLbs: 210, personality: ["competitive"], currentYear: 2026, attributeAllocations: { [POINT_BUY_SLOTS[position]![0]!.path]: 24 } });
}
function step(state: CareerState): CareerState {
  if (state.interaction?.type === "training") return chooseTrainingFocus(state, "recovery");
  if (state.interaction?.type === "decision") return resolveDecision(state, state.interaction.decision.choices[0].id);
  if (state.interaction?.type === "game") return state.interaction.game.finished ? acknowledgeFinishedGame(state) : simulateActiveGame(state);
  if (state.recruitingReady) return commitToCollege(state, state.recruitingOffers[0].collegeId);
  return advanceWeek(state);
}

describe("career recovery and narrative continuity", () => {
  it("restores optional legacy fields without modifying the saved source", () => {
    const saved = fresh();
    const old = JSON.parse(JSON.stringify(saved));
    delete old.trainingLoad; delete old.eventMemory; delete old.socialFeed;
    const restored = restoreCareer(old);
    expect(restored.trainingLoad).toBe(0);
    expect(restored.eventMemory.firedAt).toEqual([]);
    expect(old.eventMemory).toBeUndefined();
    expect(() => step(restored)).not.toThrow();
  });
  it("rejects damaged core data rather than silently overwriting it", () => {
    expect(() => restoreCareer({ id: "broken" })).toThrow(/preserved/);
  });
  it("round-trips pending training, decisions and games", () => {
    let state = fresh();
    const seen = new Set<string>();
    for (let index = 0; index < 20; index++) {
      state = step(state);
      if (state.interaction) seen.add(state.interaction.type);
      const restored = restoreCareer(JSON.parse(JSON.stringify(state)));
      expect(restored).toEqual(state);
      // RNG and interaction are preserved, so next moves agree (news ids excluded).
      expect(step(restored).rngState).toEqual(step(state).rngState);
    }
    expect([...seen].sort()).toEqual(["decision", "game", "training"]);
  });
  it("orders saves and recovers after a failed write", async () => {
    const queue = new SaveQueue(); const writes: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = queue.enqueue("career", async () => { await gate; writes.push(1); });
    const second = queue.enqueue("career", async () => { writes.push(2); });
    await Promise.resolve(); expect(writes).toEqual([]);
    release(); await Promise.all([first, second]); expect(writes).toEqual([1, 2]);
    await expect(queue.enqueue("career", async () => { throw new Error("offline"); })).rejects.toThrow();
    await queue.enqueue("career", async () => { writes.push(3); });
    expect(writes).toEqual([1, 2, 3]);
  });
  it("keeps unknown characters hidden and blocks their dependent stories", () => {
    const state = fresh();
    expect(state.relationships.some(person => hasMetCharacter(state, person))).toBe(false);
    for (const event of ALL_EVENTS.filter(event => characterRequirements(event).length)) expect(isEventEligible(event, state).eligible).toBe(false);
  });
  it("limits school news and social attention to a local audience", () => {
    const audience = { stage: "high_school" as const, age: 15, fame: 4 };
    for (let seed = 0; seed < 100; seed++) {
      const news = generatePerformanceNews(1, "Young", "Central High", 0.9, new RNG(seed), audience)!;
      expect(news.source).toBe("School Sports Bulletin"); expect(news.requiresResponse).toBe(false);
      const social = generateSocialPost(1, "positive", new RNG(seed), audience);
      expect(social.likes).toBeLessThan(40); expect(social.handle).toBe("@SchoolSideline");
    }
  });
  it.each<Position>(["QB", "RB", "WR", "TE", "LB", "CB"])("continues %s from age 15 to the professional stage through repeated save/reopen cycles", position => {
    let state = fresh(position);
    state.rngState = new RNG(9122026).getState();
    let iterations = 0;
    while (!state.stage.startsWith("nfl") && state.stage !== "free_agency" && !state.retired && iterations++ < 1800) {
      if (state.interaction?.type === "decision") {
        const eventId = state.interaction.decision.eventId;
        const event = ALL_EVENTS.find(event => event.id === eventId);
        if (event) expect(isEventEligible(event, state).eligible, event.id).toBe(true);
      }
      if (state.contract) expect(state.player.bio.age).toBeGreaterThanOrEqual(20);
      if (state.tags.includes("met:agent")) expect(state.player.bio.age).toBeGreaterThanOrEqual(20);
      state = restoreCareer(JSON.parse(JSON.stringify(step(state))));
    }
    expect(iterations).toBeLessThan(1800);
    expect(state.stage.startsWith("nfl") || state.stage === "free_agency").toBe(true);
  }, 30000);
});
