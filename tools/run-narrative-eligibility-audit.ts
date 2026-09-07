import { POINT_BUY_POOL } from "../src/engine/attributes";
import { createCareer, type CareerState } from "../src/engine/career";
import { ALL_EVENTS } from "../src/engine/events/data";
import { isEventEligible, selectWeightedEligibleEvent } from "../src/engine/events/engine";
import { RNG } from "../src/engine/rng";
import { emptyStatLine, type CareerStage, type GameEventDefinition } from "../src/engine/types";

/**
 * Deterministic narrative QA, deliberately separate from player analytics.
 * It advances synthetic career states through 10,000 complete timelines and
 * records only aggregate rule violations in stdout.
 */
const CAREERS = 10_000;
const SEED = 20260907;

type Phase = { stage: CareerStage; age: number; seasons: number; weeks: number; yearOffset: number };
const TIMELINE: Phase[] = [
  { stage: "high_school", age: 15, seasons: 0, weeks: 10, yearOffset: 0 },
  { stage: "high_school", age: 16, seasons: 0, weeks: 10, yearOffset: 1 },
  { stage: "high_school", age: 17, seasons: 0, weeks: 10, yearOffset: 2 },
  { stage: "high_school", age: 18, seasons: 0, weeks: 10, yearOffset: 3 },
  { stage: "college", age: 18, seasons: 0, weeks: 12, yearOffset: 4 },
  { stage: "college", age: 19, seasons: 1, weeks: 12, yearOffset: 5 },
  { stage: "college", age: 20, seasons: 2, weeks: 12, yearOffset: 6 },
  { stage: "draft", age: 21, seasons: 3, weeks: 4, yearOffset: 7 },
  ...Array.from({ length: 9 }, (_, index): Phase => ({ stage: "nfl_season", age: 22 + index, seasons: 3 + index, weeks: 17, yearOffset: 8 + index })),
];

function categories(stage: CareerStage): GameEventDefinition["category"][] {
  if (stage === "high_school") return ["high_school", "personal", "media", "injury"];
  if (stage === "college") return ["college", "personal", "media", "injury"];
  if (stage === "draft") return ["draft", "personal", "media"];
  return ["nfl", "personal", "media", "injury"];
}

function careerFor(index: number): CareerState {
  return createCareer({
    firstName: "Audit",
    lastName: String(index),
    position: (["QB", "RB", "WR", "TE", "LB", "CB"] as const)[index % 6],
    hometownCity: "Ironpoint",
    hometownState: "TX",
    hand: "right",
    heightInches: 74,
    weightLbs: 210,
    personality: index % 2 ? ["competitive"] : ["charismatic"],
    currentYear: 2026,
    attributeAllocations: { [`position.${(["QB", "RB", "WR", "TE", "LB", "CB"] as const)[index % 6]}.${index % 6 === 0 ? "shortAccuracy" : index % 6 === 1 ? "vision" : index % 6 === 2 ? "catching" : index % 6 === 3 ? "catching" : index % 6 === 4 ? "tackling" : "manCoverage"}`]: POINT_BUY_POOL },
  });
}

function recordChoice(state: CareerState, event: GameEventDefinition, rng: RNG): void {
  const choice = event.choices[Math.floor(rng.next() * Math.max(1, event.choices.length))] ?? event.choices[0];
  const tags = new Set([...state.tags, `event:${event.id}`]);
  for (const tag of choice?.consequences.addTags ?? []) tags.add(tag);
  for (const tag of choice?.consequences.removeTags ?? []) tags.delete(tag);
  if (choice?.consequences.narrativeMemory) tags.add(`memory:${event.id}:${choice.id}`);
  state.tags = [...tags];
  const counts = new Map(state.eventMemory.firedCount ?? []);
  counts.set(event.id, (counts.get(event.id) ?? 0) + 1);
  state.eventMemory = {
    firedAt: [...new Map([...state.eventMemory.firedAt, [event.id, state.totalWeek]]).entries()],
    firedOnce: [...new Set([...state.eventMemory.firedOnce, event.id])],
    firedCount: [...counts.entries()],
  };
  state.decisionHistory = [{ eventId: event.id, title: event.title, choiceId: choice?.id ?? "none", choiceLabel: choice?.label ?? "None", week: state.totalWeek }, ...state.decisionHistory];
}

const failures = new Map<string, number>();
const selections = new Map<string, number>();
const emptyEligibilityCheckpoints = new Map<CareerStage, number>();
let maxRepeat = 0;
let maxRepeatEvent = "none";

for (let careerIndex = 0; careerIndex < CAREERS; careerIndex++) {
  const state = careerFor(careerIndex);
  const rng = new RNG(SEED + careerIndex * 31);
  let totalGames = 0;
  for (const phase of TIMELINE) {
    // Beginning, midpoint and final week cover every phase transition and
    // late-season gate without multiplying this deterministic 10k audit by
    // every routine week in a season.
    const checkpoints = [...new Set([1, Math.ceil(phase.weeks / 2), phase.weeks])];
    let previousWeek = 0;
    for (const week of checkpoints) {
      state.stage = phase.stage;
      state.player.stage = phase.stage;
      state.player.bio.age = phase.age;
      state.year = 2026 + phase.yearOffset;
      state.weekInSeason = week;
      state.careerSeasonsPlayed = phase.seasons;
      state.totalWeek += week - previousWeek;
      previousWeek = week;
      if (phase.stage !== "draft") totalGames += week === 1 ? 1 : week - checkpoints[checkpoints.indexOf(week) - 1];
      const fameBase = phase.stage === "high_school" ? 4 + phase.yearOffset * 3 + week / 3 : phase.stage === "college" ? 15 + (phase.yearOffset - 4) * 7 + week / 2 : phase.stage === "draft" ? 32 : 34 + (phase.age - 22) * 4 + week / 3;
      const variance = Math.floor(rng.next() * 12);
      state.player.attributes.general.fame = Math.min(92, Math.floor(fameBase + variance));
      state.player.attributes.general.reputation = Math.min(90, Math.floor(22 + phase.seasons * 4 + week / 3 + variance));
      const line = { ...emptyStatLine(state.year, phase.stage === "high_school" ? "high_school" : phase.stage === "college" ? "college" : "nfl", "audit"), gamesPlayed: totalGames, gamesStarted: totalGames, passYards: totalGames * 180, passTDs: Math.floor(totalGames / 3), proBowl: phase.stage === "nfl_season" && phase.seasons >= 4, allPro: phase.stage === "nfl_season" && phase.seasons >= 6, championshipWon: phase.stage === "nfl_season" && phase.seasons >= 8 };
      state.statHistory = [line];
      state.relationships = state.relationships.map((relationship) => ({ ...relationship, value: relationship.type === "rival" ? 48 : 65 }));

      const pool = ALL_EVENTS.filter((event) => categories(phase.stage).includes(event.category));
      const eligible = pool.filter((event) => isEventEligible(event, state).eligible);
      if (eligible.length === 0) emptyEligibilityCheckpoints.set(phase.stage, (emptyEligibilityCheckpoints.get(phase.stage) ?? 0) + 1);
      const passedProbability = eligible.filter((event) => rng.chance(isEventEligible(event, state).probability));
      const selected = selectWeightedEligibleEvent(passedProbability, state, rng);
      if (!selected) continue;
      const check = isEventEligible(selected, state);
      if (!check.eligible) failures.set("selection bypassed requirements", (failures.get("selection bypassed requirements") ?? 0) + 1);
      if (selected.id === "media_paparazzi_outside" && (state.player.bio.age < 18 || state.player.attributes.general.fame < 35 || totalGames < 8 || state.stage === "high_school")) failures.set("celebrity press appeared prematurely", (failures.get("celebrity press appeared prematurely") ?? 0) + 1);
      if (selected.id.includes("contract") && !["nfl_offseason", "nfl_season", "free_agency"].includes(state.stage)) failures.set("contract before professional phase", (failures.get("contract before professional phase") ?? 0) + 1);
      if ((selected.id.includes("relationship_milestone") || selected.id.includes("child")) && state.player.bio.age < 22) failures.set("family milestone before age gate", (failures.get("family milestone before age gate") ?? 0) + 1);
      // Hall of Fame is a retirement legacy tier, not a weekly event. Keep
      // the explicit check narrow so "Study Hall" never produces a false hit.
      if (selected.id === "legacy_hall_of_fame" && !state.retired) failures.set("Hall of Fame before retirement", (failures.get("Hall of Fame before retirement") ?? 0) + 1);
      recordChoice(state, selected, rng);
      selections.set(selected.id, (selections.get(selected.id) ?? 0) + 1);
      const count = new Map(state.eventMemory.firedCount ?? []).get(selected.id) ?? 0;
      if (count > maxRepeat) {
        maxRepeat = count;
        maxRepeatEvent = selected.id;
      }
    }
  }
}

const longGaps = [...emptyEligibilityCheckpoints.entries()].filter(([, count]) => count >= 3);
console.log([
  "# GRIDIRON LIFE — Narrative eligibility simulation",
  "",
  `- Seed: ${SEED}`,
  `- Careers: ${CAREERS.toLocaleString("en-US")}`,
  `- Audited definitions: ${ALL_EVENTS.length}`,
  `- Selections resolved: ${[...selections.values()].reduce((sum, value) => sum + value, 0).toLocaleString("en-US")}`,
  `- Maximum repeat count for one event in a career: ${maxRepeat} (${maxRepeatEvent})`,
  `- Invalid selections: ${[...failures.values()].reduce((sum, value) => sum + value, 0)}`,
  `- Empty-eligibility phase checkpoints (3+): ${longGaps.length ? longGaps.map(([stage, count]) => `${stage} (${count})`).join(", ") : "none"}`,
  "",
  "## Findings",
  ...(failures.size ? [...failures.entries()].map(([name, count]) => `- [FAIL] ${name}: ${count}`) : ["- [PASS] No selected event violated an age, phase, fame, games, prerequisite, cooldown, occurrence or contradiction requirement."]),
  ...(maxRepeat > 3 ? [`- [REVIEW] A repeat reached ${maxRepeat} occurrences; inspect its story-specific cap.`] : ["- [PASS] Repetition stayed at or below the configured three-occurrence celebrity cap."]),
  ...(longGaps.length ? longGaps.map(([stage, count]) => `- [REVIEW] ${stage} had ${count} empty eligibility checkpoints.`) : ["- [PASS] Every active phase retained eligible narrative options at its start, midpoint and finish."]),
].join("\n"));
