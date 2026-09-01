// =============================================================================
// Career Simulation Engine — the orchestrator that ties every subsystem
// (attributes, aging, events, game sim, finance, news, draft, contracts,
// injuries, achievements, legacy) into one coherent state machine.
// -----------------------------------------------------------------------------
// This is the single import surface the UI/store needs. Everything here is a
// pure function of (state, ...args) => state (occasionally => {state, ...}),
// so it is fully unit-testable without React, Vite, or a network.
// =============================================================================

import type {
  Achievement,
  Attributes,
  CareerStage,
  College,
  CollegeRecord,
  Contract,
  DraftProjection,
  DraftResult,
  FinanceState,
  GameEventDefinition,
  HighSchoolRecord,
  Injury,
  NewsItem,
  Player,
  PendingDecision,
  Relationship,
  RelationshipType,
  ResolvedDecision,
  SocialPost,
  StatLine,
  Team,
} from "./types";
import { emptyStatLine } from "./types";
import { RNG, type RNGState, createSeed, clamp } from "./rng";
import { createPlayer, type CreatePlayerInput } from "./player";
import { applyAttributeDelta, applyAttributeDeltas, computeOverall, pointBuyPointsLeft, POINT_BUY_BASELINE, POINT_BUY_MAX, POINT_BUY_SLOTS } from "./attributes";
import { applySeasonalAging, applyTraining, type TrainingFocus } from "./aging";
import { ALL_EVENTS } from "./events/data";
import { createEmptyEventMemory, isEligible, markFired, rollEligibleEvents, selectWeeklyEvents, type EventEngineContext } from "./events/engine";
import { COLLEGES, getCollege } from "./colleges";
import { TEAMS, getTeam } from "./teams";
import {
  generateCollegeSchedule,
  generateHighSchoolSchedule,
  generateNFLSchedule,
  emptyRecord,
  recordResult,
  qualifiesForPlayoffs,
  simulatePlayoffRun,
  type ScheduleEntry,
  type SeasonRecord,
} from "./simulation/season";
import { beginGame, advanceGame, simulateGameToCompletion, type BeginGameInput, type GameSimState } from "./simulation/gameSim";
import { getGameDayObjective, isGameDayObjectiveComplete } from "./gameObjectives";
import { generateCombineScores, generateDraftProjection, resolveDraft, rookieContractValue } from "./draft";
import { advanceContractYear, buildContract, checkPerformanceRelease, generateFreeAgencyOffers, isContractExpired, weeklySalary, type FreeAgencyOffer } from "./contracts";
import { emptyFinanceState, applyIncome, weeklyFinanceTick, purchaseAsset, addSponsorship, generateSponsorshipOffer, MAX_ACTIVE_SPONSORSHIPS } from "./finance";
import { generatePerformanceNews, generateSocialPost } from "./news";
import { rollForInjury, tickInjuryRecovery, injuryTagFor } from "./injury";
import { addStatLine, sumStatLines } from "./stats";
import { ACHIEVEMENT_DEFINITIONS, initialAchievements, unlock, checkGameAchievements, checkCareerEarningsAchievement, checkSeasonsAchievement, checkTeamHistoryAchievements } from "./achievements";
import { computeLegacy, type LegacyInput } from "./legacy";
import type { LegacyResult } from "./types";

export const HS_SEASON_WEEKS = 10;
export const COLLEGE_SEASON_WEEKS = 12;
export const NFL_SEASON_WEEKS = 17;
export const NFL_OFFSEASON_WEEKS = 6;

export interface TrainingFocusChoice {
  id: TrainingSelection;
  label: string;
  description: string;
}

/** Training is always a player choice. "skip" means no attribute gain this
 * week, preserving the trade-off instead of forcing a workout every turn. */
/** One weekly priority only: field work, recovery, or an intentional life
 * investment. The life priorities are real trade-offs, not navigation links. */
export type TrainingSelection = TrainingFocus | "relationships" | "social" | "skip";

// Every trainable week the player picks how to spend their practice time
// before the rest of the week (narrative event / game / offseason work)
// resolves. This is a real, consequential choice (see aging.ts's
// TRAINING_TARGETS) — not a cosmetic gate — and it's what item 24 of the
// requested training with a player-selected focus.
export const TRAINING_FOCUS_CHOICES: TrainingFocusChoice[] = [
  { id: "strength", label: "Weight Room", description: "Focuses on strength and physical durability." },
  { id: "speed", label: "Speed Work", description: "Focuses on speed and acceleration." },
  { id: "technique", label: "Technique & Fundamentals", description: "Focuses on agility and reading the game." },
  { id: "mental", label: "Film Room", description: "Focuses on decision-making, composure, and handling pressure." },
  { id: "position_specific", label: "Position-Specific Work", description: "Focuses on your position's key attributes." },
  { id: "recovery", label: "Active Recovery", description: "Reduces fatigue and injury risk; slower attribute gains." },
  { id: "relationships", label: "Team & Family Time", description: "Builds coach, teammate and family trust; no training gain this week." },
  { id: "social", label: "Community & Media", description: "Builds reputation and media access; no training or recovery gain this week." },
  { id: "skip", label: "Skip Training", description: "Take the week for life off the field. No attribute gain this week." },
];

export type Interaction =
  | { type: "decision"; decision: PendingDecision }
  | { type: "game"; game: GameSimState }
  | { type: "training"; week: number; options: TrainingFocusChoice[] }
  | null;

export interface CareerState {
  id: string;
  seed: number;
  rngState: RNGState;
  createdAtWeek: number;
  totalWeek: number; // absolute weeks elapsed since career start
  year: number;
  stage: CareerStage;
  player: Player;

  highSchool: HighSchoolRecord;
  recruitingOffers: RecruitingOfferView[];
  recruitingReady: boolean;

  college: CollegeRecord | null;

  draftProjection: DraftProjection | null;
  draftResult: DraftResult | null;
  draftWeekInProcess: number;

  team: Team | null;
  contract: Contract | null;
  freeAgencyOffers: FreeAgencyOffer[] | null;

  schedule: ScheduleEntry[];
  weekInSeason: number;
  seasonRecord: SeasonRecord;
  seasonYear: number;
  careerSeasonsPlayed: number;
  teamsPlayedFor: string[];
  playoffResult: ReturnType<typeof simulatePlayoffRun> | null;

  statHistory: StatLine[]; // one per completed level-season
  currentSeasonGameStats: StatLine[]; // accumulates during the active season

  finance: FinanceState;
  relationships: Relationship[];
  news: NewsItem[];
  socialFeed: SocialPost[];
  injuries: Injury[];
  tags: string[];

  eventMemory: { firedAt: [string, number][]; firedOnce: string[] };
  narrativeRolledForWeek: number;
  trainingFocusChosenForWeek: number;
  pendingTrainingFocus: TrainingSelection | null;
  /** Persistent condition between games. Older saves safely default to 0. */
  trainingLoad: number; // 0 = fresh, 100 = overworked
  injuryRiskModifier: number; // accumulated weekly training risk, -0.15..0.35
  interaction: Interaction;
  decisionHistory: ResolvedDecision[];
  achievements: Achievement[];

  retired: boolean;
  legacy: LegacyResult | null;
  log: string[];
}

export interface RecruitingOfferView {
  collegeId: string;
  collegeName: string;
  interestLevel: number;
  scholarship: boolean;
}

// -----------------------------------------------------------------------------
// RNG helpers — every mutation that needs randomness pulls an RNG instance
// from state.rngState and writes the advanced state back, so saves are
// reproducible and step-by-step deterministic.
// -----------------------------------------------------------------------------

function withRng<T>(state: CareerState, fn: (rng: RNG) => T): { result: T; rngState: RNGState } {
  const rng = RNG.fromState(state.rngState);
  const result = fn(rng);
  return { result, rngState: rng.getState() };
}

function log(state: CareerState, entry: string): CareerState {
  return { ...state, log: [entry, ...state.log].slice(0, 200) };
}

// -----------------------------------------------------------------------------
// Career creation
// -----------------------------------------------------------------------------

const HS_NAMES = ["Riverdale High", "Central High", "Lincoln High", "Jefferson High", "Kennedy High", "Franklin High"];
const HS_COACHES = ["Coach Reilly", "Coach Bannister", "Coach Delgado", "Coach Whitmore", "Coach Alvarez"];

/** These are people, not disposable flavour text.  Each starts with a
 * relationship record so choices can leave a visible, durable history from
 * the first week of a career. */
function startingRelationships(coachName: string): Relationship[] {
  return [
    { id: "rel_coach", name: coachName, type: "coach", value: 55, tags: ["high_school_coach"], history: [] },
    { id: "rel_teammate", name: "Jordan Reed", type: "teammate", value: 50, tags: ["locker_room"], history: [] },
    { id: "rel_family", name: "Family", type: "family", value: 75, tags: ["home"], history: [] },
    { id: "rel_agent", name: "Morgan Hale", type: "agent", value: 50, tags: ["representation"], history: [] },
    { id: "rel_rival", name: "Dante Cole", type: "rival", value: 48, tags: ["competitive_rival"], history: [] },
  ];
}

/** Older saves predate the persistent-circle model.  Add only the missing
 * records, preserving every existing person and their accumulated history. */
function ensureContinuityRelationships(state: CareerState): CareerState {
  const present = new Set(state.relationships.map((relationship) => relationship.type));
  const coachName = state.relationships.find((relationship) => relationship.type === "coach")?.name ?? state.highSchool.coachName ?? "Coach";
  const missing = startingRelationships(coachName).filter((relationship) => !present.has(relationship.type));
  return missing.length ? { ...state, relationships: [...state.relationships, ...missing] } : state;
}

export function createCareer(input: CreatePlayerInput): CareerState {
  validatePointBuy(input);
  const seed = createSeed();
  let rng = new RNG(seed);
  const player = createPlayer(input, rng);

  const schoolName = HS_NAMES[Math.floor(rng.next() * HS_NAMES.length)];
  const coachName = HS_COACHES[Math.floor(rng.next() * HS_COACHES.length)];

  const highSchool: HighSchoolRecord = {
    schoolName,
    coachName,
    city: input.hometownCity,
    state: input.hometownState,
    classYear: 9,
    starRating: 1,
    stats: [],
  };

  const schedule = generateHighSchoolSchedule(rng, HS_SEASON_WEEKS);

  const state: CareerState = {
    id: `career_${Date.now().toString(36)}_${Math.floor(rng.next() * 1e6).toString(36)}`,
    seed,
    rngState: rng.getState(),
    createdAtWeek: 0,
    totalWeek: 0,
    year: input.currentYear,
    stage: "high_school",
    player,
    highSchool,
    recruitingOffers: [],
    recruitingReady: false,
    college: null,
    draftProjection: null,
    draftResult: null,
    draftWeekInProcess: 0,
    team: null,
    contract: null,
    freeAgencyOffers: null,
    schedule,
    weekInSeason: 1,
    seasonRecord: emptyRecord(),
    seasonYear: input.currentYear,
    careerSeasonsPlayed: 0,
    teamsPlayedFor: [],
    playoffResult: null,
    statHistory: [],
    currentSeasonGameStats: [],
    finance: emptyFinanceState(),
    relationships: startingRelationships(coachName),
    news: [],
    socialFeed: [],
    injuries: [],
    tags: [],
    eventMemory: { firedAt: [], firedOnce: [] },
    narrativeRolledForWeek: -1,
    trainingFocusChosenForWeek: -1,
    pendingTrainingFocus: null,
    trainingLoad: 0,
    injuryRiskModifier: 0,
    interaction: null,
    decisionHistory: [],
    achievements: initialAchievements(),
    retired: false,
    legacy: null,
    log: [`${player.bio.firstName} ${player.bio.lastName} begins their journey as a freshman at ${schoolName}.`],
  };

  return state;
}

/** The creator is not the only caller of the engine (tests and future API
 * clients can call it too), so enforce the complete point-buy contract at the
 * state-machine boundary as well as disabling the UI button. */
function validatePointBuy(input: CreatePlayerInput): void {
  const slots = POINT_BUY_SLOTS[input.position] ?? [];
  const allowed = new Set(slots.map((slot) => slot.path));
  const allocations = input.attributeAllocations ?? {};
  for (const [path, points] of Object.entries(allocations)) {
    if (!allowed.has(path) || !Number.isInteger(points) || points < 0 || points > POINT_BUY_MAX - POINT_BUY_BASELINE) {
      throw new Error("Invalid attribute allocation.");
    }
  }
  const pointsLeft = pointBuyPointsLeft(input.position, allocations);
  if (pointsLeft !== 0) throw new Error(`Spend all ${Math.abs(pointsLeft)} attribute points before starting a career.`);
}

// -----------------------------------------------------------------------------
// Shared lookups
// -----------------------------------------------------------------------------

function coachRelationship(state: CareerState): number {
  const coach = state.relationships.find((r) => r.type === "coach");
  return coach?.value ?? 50;
}

function tagSet(state: CareerState): Set<string> {
  return new Set(state.tags);
}

function eventMemoryMaps(state: CareerState) {
  return { firedAt: new Map(state.eventMemory.firedAt), firedOnce: new Set(state.eventMemory.firedOnce) };
}

function serializeEventMemory(firedAt: Map<string, number>, firedOnce: Set<string>) {
  return { firedAt: Array.from(firedAt.entries()), firedOnce: Array.from(firedOnce) };
}

function overall(player: Player): number {
  return computeOverall(player.attributes, player.position);
}

function categoriesForStage(stage: CareerStage): GameEventDefinition["category"][] {
  switch (stage) {
    case "high_school":
      return ["high_school", "personal", "media", "injury"];
    case "recruiting":
      return ["high_school", "personal"];
    case "college":
      return ["college", "personal", "media", "injury"];
    case "draft":
      return ["draft", "personal", "media"];
    case "nfl_offseason":
    case "nfl_season":
    case "free_agency":
      return ["nfl", "personal", "media", "injury"];
    default:
      return [];
  }
}

// -----------------------------------------------------------------------------
// Relationship helper
// -----------------------------------------------------------------------------

function bumpRelationship(state: CareerState, targetTag: string, delta: number, note?: string): Relationship[] {
  const typeMap: Record<string, RelationshipType> = {
    coach: "coach",
    team: "teammate",
    media: "media",
    fans: "media",
    family: "family",
    partner: "partner",
    friend: "friend",
    agent: "agent",
    rival: "rival",
    booster: "booster",
  };
  const type = typeMap[targetTag];
  if (!type) return state.relationships;
  const existing = state.relationships.find((r) => r.type === type);
  if (!existing) {
    return [
      ...state.relationships,
      {
        id: `rel_${type}_${state.totalWeek}`,
        name: type === "coach" ? "Coach" : type,
        type,
        value: clamp(50 + delta),
        tags: [],
        history: note ? [{ week: state.totalWeek, note }] : [],
      },
    ];
  }
  return state.relationships.map((r) => (
    r.id === existing.id
      ? {
        ...r,
        value: clamp(r.value + delta),
        history: note ? [{ week: state.totalWeek, note }, ...(r.history ?? [])].slice(0, 16) : r.history ?? [],
      }
      : r
  ));
}

function isTrainingFocus(selection: TrainingSelection): selection is TrainingFocus {
  return selection === "strength" || selection === "speed" || selection === "technique" || selection === "recovery" || selection === "mental" || selection === "position_specific";
}

/** Applies non-training weekly priorities at the moment the player chooses
 * them, so their consequence is visible before game day. They are excluded
 * from the later practice tick — one week deliberately has one priority. */
function applyLifePriority(state: CareerState, selection: Extract<TrainingSelection, "relationships" | "social">): CareerState {
  if (selection === "relationships") {
    let relationships = bumpRelationship(state, "coach", 3);
    relationships = bumpRelationship({ ...state, relationships }, "team", 2);
    relationships = bumpRelationship({ ...state, relationships }, "family", 3);
    const player: Player = {
      ...state.player,
      attributes: applyAttributeDeltas(state.player.attributes, [{ path: "general.morale", delta: 3 }, { path: "general.leadership", delta: 1 }]),
    };
    return log({ ...state, player, relationships }, "Weekly priority: invested time in coach, teammates and family (+trust, +morale; no practice gain). ");
  }

  const relationships = bumpRelationship(state, "media", 3);
  const player: Player = {
    ...state.player,
    attributes: applyAttributeDeltas(state.player.attributes, [{ path: "general.reputation", delta: 2 }, { path: "general.fame", delta: 1 }, { path: "general.morale", delta: -1 }]),
  };
  return log({ ...state, player, relationships }, "Weekly priority: invested in community and media (+reputation, +fame; less recovery this week). ");
}

// -----------------------------------------------------------------------------
// Narrative decision resolution
// -----------------------------------------------------------------------------

export function resolveDecision(state: CareerState, choiceId: string): CareerState {
  if (!state.interaction || state.interaction.type !== "decision") return state;
  const decision = state.interaction.decision;
  const choice = decision.choices.find((c) => c.id === choiceId) ?? decision.choices[0];
  const c = choice.consequences;

  let player = state.player;
  if (c.attributeDeltas?.length) {
    player = { ...player, attributes: applyAttributeDeltas(player.attributes, c.attributeDeltas) };
  }

  let finance = state.finance;
  if (c.cash) {
    const applied = c.cash > 0 ? applyIncome(finance, c.cash, decision.title).state : { ...finance, cash: finance.cash + c.cash };
    finance = applied;
  }

  let relationships = state.relationships;
  for (const rd of c.relationshipDeltas ?? []) {
    relationships = bumpRelationship({ ...state, relationships }, rd.targetTag, rd.delta, `${decision.title}: ${choice.label}`);
  }

  let tags = state.tags;
  if (c.addTags?.length) tags = Array.from(new Set([...tags, ...c.addTags]));
  if (c.removeTags?.length) tags = tags.filter((t) => !c.removeTags!.includes(t));
  // Narrative memory is a durable, queryable consequence rather than text
  // that disappears into a log. Future data-driven events can gate on this
  // tag to call back a previous choice without hard-coding a story branch.
  if (c.narrativeMemory) tags = Array.from(new Set([...tags, `memory:${decision.eventId}:${choice.id}`]));

  let news = state.news;
  if (c.news) {
    news = [
      { id: `news_${state.totalWeek}_${decision.eventId}`, week: state.totalWeek, headline: c.news.headline, body: c.news.body, tone: c.news.tone, source: "The Gridiron Report", requiresResponse: false, responded: false, tags: [decision.eventId] },
      ...news,
    ].slice(0, 100);
  }

  let injuries = state.injuries;
  if (c.injuryChance) {
    const { result: injuryRoll, rngState } = withRng(state, (rng) => rollForInjury(state.totalWeek, player.attributes.physical.durability, player.attributes.general.discipline, rng, c.injuryChance! * 20));
    if (injuryRoll) {
      injuries = [...injuries, injuryRoll];
      tags = Array.from(new Set([...tags, injuryTagFor(injuryRoll.severity)]));
    }
    state = { ...state, rngState };
  }

  const { firedAt, firedOnce } = eventMemoryMaps(state);
  const eventDef = ALL_EVENTS.find((e) => e.id === decision.eventId);
  if (eventDef) markFired({ firedAt, firedOnce, player, stage: state.stage, week: state.totalWeek, coachRelationship: 0, fame: 0, tags: new Set(tags) }, eventDef);

  const resolved: ResolvedDecision = { eventId: decision.eventId, title: decision.title, choiceId: choice.id, choiceLabel: choice.label, week: state.totalWeek };

  return log(
    {
      ...state,
      player,
      finance,
      relationships,
      tags,
      news,
      injuries,
      eventMemory: serializeEventMemory(firedAt, firedOnce),
      interaction: null,
      decisionHistory: [resolved, ...state.decisionHistory].slice(0, 300),
    },
    `Week ${state.totalWeek}: "${decision.title}" -> ${choice.label}`
  );
}

// -----------------------------------------------------------------------------
// Weekly tick
// -----------------------------------------------------------------------------

export interface AdvanceWeekOptions {
  trainingFocus?: TrainingSelection;
}

const TRAINABLE_STAGES: CareerStage[] = ["high_school", "college", "nfl_season", "nfl_offseason"];

export function advanceWeek(state: CareerState, options: AdvanceWeekOptions = {}): CareerState {
  state = ensureContinuityRelationships(state);
  if (state.retired) return state;
  if (state.interaction) return state; // must resolve the pending decision/game first
  if (state.recruitingReady) return state; // must commit to a college first
  if (state.freeAgencyOffers) return state; // must sign a contract first

  // 0) Every trainable week starts with a real choice: how do you spend
  // practice time this week? (spec item 24 — training with focus choice).
  // This pauses the week exactly like a narrative decision or a game does.
  if (TRAINABLE_STAGES.includes(state.stage) && state.trainingFocusChosenForWeek !== state.totalWeek && !options.trainingFocus) {
    return { ...state, interaction: { type: "training", week: state.totalWeek, options: TRAINING_FOCUS_CHOICES } };
  }
  if (options.trainingFocus) {
    state = { ...state, trainingFocusChosenForWeek: state.totalWeek, pendingTrainingFocus: options.trainingFocus };
    if (isTrainingFocus(options.trainingFocus)) {
      state = applyTrainingCondition(state, options.trainingFocus);
    } else if (options.trainingFocus === "relationships" || options.trainingFocus === "social") {
      state = applyLifePriority(state, options.trainingFocus);
    }
  }

  // 1) Roll a narrative event at most once per week.
  if (state.narrativeRolledForWeek !== state.totalWeek) {
    const rolled = rollNarrativeEvent(state);
    state = { ...rolled.state, narrativeRolledForWeek: rolled.state.totalWeek };
    if (rolled.decision) {
      return { ...state, interaction: { type: "decision", decision: rolled.decision } };
    }
  }

  // 2) Is there a game this week?
  const isGameStage = state.stage === "high_school" || state.stage === "college" || state.stage === "nfl_season";
  const scheduleEntry = state.schedule.find((s) => s.week === state.weekInSeason && !s.played);

  if (isGameStage && scheduleEntry) {
    return beginGameWeek(state, scheduleEntry);
  }

  // 3) Off week: apply training, then finish the week.
  let next = state;
  if (state.stage !== "draft" && state.stage !== "recruiting") {
    const selection = options.trainingFocus ?? state.pendingTrainingFocus ?? "recovery";
    if (isTrainingFocus(selection)) next = applyTrainingTick(next, selection);
    else if (selection === "skip") next = log(next, "Skipped training this week to focus on life off the field.");
  }
  return finishWeekProcessing(next, isGameStage && !!scheduleEntry === false);
}

/** Resolves the weekly "training" interaction, then immediately continues
 *  the rest of that week's processing (narrative roll / game / off week)
 *  with the chosen focus in effect. */
export function chooseTrainingFocus(state: CareerState, focus: TrainingSelection): CareerState {
  if (!state.interaction || state.interaction.type !== "training") return state;
  const next: CareerState = {
    ...state,
    interaction: null,
    trainingFocusChosenForWeek: state.totalWeek,
    pendingTrainingFocus: focus,
  };
  return advanceWeek(next, { trainingFocus: focus });
}

/** Prevent a recent story arc from taking every decision slot.  Direct event
 * cooldowns still apply in the event engine; this is deliberately broader so
 * e.g. two rival scenes do not play back-to-back under different IDs. */
export function hasRecentNarrativeArc(state: CareerState, candidate: GameEventDefinition, recentDecisions = 3): boolean {
  const candidateArc = candidate.tags.find((tag) => tag.startsWith("arc:"));
  if (!candidateArc) return false;
  return state.decisionHistory.slice(0, recentDecisions).some((decision) =>
    ALL_EVENTS.find((event) => event.id === decision.eventId)?.tags.includes(candidateArc)
  );
}

function rollNarrativeEvent(state: CareerState): { state: CareerState; decision: PendingDecision | null } {
  const { firedAt, firedOnce } = eventMemoryMaps(state);
  const ctx: EventEngineContext = {
    player: state.player,
    stage: state.stage,
    week: state.totalWeek,
    coachRelationship: coachRelationship(state),
    fame: state.player.attributes.general.fame,
    tags: tagSet(state),
    firedAt,
    firedOnce,
  };

  const categories = categoriesForStage(state.stage);
  const candidates = ALL_EVENTS.filter((e) => categories.includes(e.category));
  const { result: eligible, rngState } = withRng(state, (rng) => {
    const pool = candidates.filter((e) => isEligible(e, ctx) && !hasRecentNarrativeArc(state, e));
    // Global frequency boost over each event's own base probability so a
    // typical week is meaningfully more likely to bring a real decision,
    // not just an "Advance Week" click.
    return pool.filter((e) => rng.chance(Math.min(0.92, (e.conditions.probability ?? 0.35) * 1.6)));
  });

  state = { ...state, rngState };

  if (eligible.length === 0) return { state, decision: null };

  const { result: chosen, rngState: rngState2 } = withRng(state, (rng) => selectWeeklyEvents(eligible, rng, 1));
  state = { ...state, rngState: rngState2 };
  const def = chosen[0];
  if (!def) return { state, decision: null };

  return {
    state,
    decision: { eventId: def.id, title: def.title, description: def.description, choices: def.choices, week: state.totalWeek },
  };
}

function applyTrainingTick(state: CareerState, focus: TrainingFocus): CareerState {
  const college = state.college ? getCollege(state.college.collegeId) : null;
  const devRate = college ? college.developmentRate : 1;
  const { result, rngState } = withRng(state, (rng) =>
    applyTraining(state.player.attributes, focus, 1, devRate, rng, positionSpecificPaths(state.player), state.trainingLoad ?? 0)
  );
  // The workload trade-off was applied when the weekly focus was selected,
  // before a narrative event or Game Day can occur. This tick only applies the
  // attribute/morale result, so a single session is never counted twice.
  const attributes = applyAttributeDelta(result.attributes, "general.morale", result.moraleDelta);
  const player: Player = { ...state.player, attributes };
  return { ...state, player, rngState };
}

function applyTrainingCondition(state: CareerState, focus: TrainingFocus): CareerState {
  const isRecovery = focus === "recovery";
  const isHardPositionWork = focus === "position_specific";
  // Repeating the most productive focus must be a meaningful choice. General
  // work remains sustainable, recovery clears pressure, and position-specific
  // work now accumulates enough load/risk that it cannot be a free meta pick.
  const fatigueDelta = isRecovery ? -18 : isHardPositionWork ? 16 : 8;
  const injuryRiskDelta = isRecovery ? -0.025 : isHardPositionWork ? 0.04 : 0.01;
  return {
    ...state,
    trainingLoad: nextTrainingLoad(state.trainingLoad, fatigueDelta),
    injuryRiskModifier: nextInjuryRiskModifier(state.injuryRiskModifier, injuryRiskDelta),
  };
}

function nextTrainingLoad(current: number | undefined, delta: number): number {
  return clamp((current ?? 0) + delta, 0, 100);
}

function nextInjuryRiskModifier(current: number | undefined, delta: number): number {
  return clamp((current ?? 0) + delta, -0.15, 0.35);
}

/** The multiplier passed to the injury model. Kept exported so the UI and
 * balance tests can describe the same condition that the engine uses. */
export function injuryContextMultiplier(trainingLoad: number | undefined, injuryRiskModifier: number | undefined): number {
  return clamp(1 + clamp(trainingLoad ?? 0, 0, 100) * 0.005 + (injuryRiskModifier ?? 0), 0.7, 1.85);
}

function positionSpecificPaths(player: Player): string[] {
  const p = player.position;
  const key = `position.${p}`;
  const block = (player.attributes.position as unknown as Record<string, Record<string, number>>)[p];
  return Object.keys(block).map((k) => `${key}.${k}`);
}

// -----------------------------------------------------------------------------
// Game week flow
// -----------------------------------------------------------------------------

// Deterministic FNV-1a-style string hash. Used so a given opponent's stub
// ratings stay fixed for the whole game (beginGameWeek, every in-game
// resolveGameDecision call, and the final acknowledgeFinishedGame fold all
// call opponentTeamStub independently) instead of re-rolling on every call,
// which used to let the same defense swing from a 47 to a 75 rating between
// two decisions in the same drive.
function hashOpponentSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function opponentTeamStub(label: string, week: number): Team {
  const seed = hashOpponentSeed(`${label}#${week}`);
  const pick = (salt: number) => 45 + (((seed ^ Math.imul(salt, 2654435761)) >>> 0) % 31);
  return {
    id: `stub_${label}`,
    city: label,
    name: "",
    abbreviation: "OPP",
    conference: "National",
    division: "",
    prestige: pick(1),
    marketSize: 50,
    coachingQuality: pick(2),
    rosterStrength: pick(3),
    headCoachName: "Opposing Coach",
  };
}

function buildOwnTeamForGame(state: CareerState): Team {
  if (state.stage === "nfl_season" && state.team) return state.team;
  const collegeName = state.college ? getCollege(state.college.collegeId)?.name ?? "College" : "College";
  return {
    id: "own",
    city: state.stage === "college" ? collegeName : state.highSchool.schoolName,
    name: "",
    abbreviation: "OWN",
    conference: "National",
    division: "",
    prestige: 50,
    marketSize: 50,
    coachingQuality: 55,
    rosterStrength: 50,
    headCoachName: state.stage === "college" ? "College Coach" : state.highSchool.coachName,
  };
}

function beginGameWeek(state: CareerState, entry: ScheduleEntry): CareerState {
  const ownTeam = buildOwnTeamForGame(state);
  const opponentTeam = (state.stage === "nfl_season" && getTeam(entry.opponentId)) || opponentTeamStub(entry.opponentLabel, entry.week);

  const input: BeginGameInput = {
    player: state.player,
    overall: overall(state.player),
    team: ownTeam,
    opponent: opponentTeam,
    week: entry.week,
    season: state.seasonYear,
    homeAdvantage: entry.isHome,
  };

  const { result: game, rngState } = withRng(state, (rng) => beginGame(input, rng));
  state = { ...state, rngState };

  // Always hand the game state to the UI, even once `game.finished` — the
  // GameDayView plays the final plays out in real time before calling
  // `acknowledgeFinishedGame` to fold the result into the career. Folding
  // immediately here would unmount the game view mid-animation.
  return { ...state, interaction: { type: "game", game } };
}

export function resolveGameDecision(state: CareerState, optionId: string): CareerState {
  if (!state.interaction || state.interaction.type !== "game") return state;
  const priorGame = state.interaction.game;

  const entry = state.schedule.find((s) => s.week === state.weekInSeason)!;
  const ownTeam = buildOwnTeamForGame(state);
  const opponentTeam = (state.stage === "nfl_season" && getTeam(entry.opponentId)) || opponentTeamStub(entry.opponentLabel, entry.week);

  const input: BeginGameInput = {
    player: state.player,
    overall: overall(state.player),
    team: ownTeam,
    opponent: opponentTeam,
    week: entry.week,
    season: state.seasonYear,
    homeAdvantage: entry.isHome,
  };

  const { result: game, rngState } = withRng(state, (rng) => advanceGame(priorGame, input, rng, optionId));
  state = { ...state, rngState };

  // See the comment in beginGameWeek: folding the result into the career
  // happens later, via acknowledgeFinishedGame, once the UI has finished
  // playing out the last plays.
  return { ...state, interaction: { type: "game", game } };
}

/** Simulates the current saved game with the same engine used for manual
 * Game Day. Unlike advancing a week, this is an explicit player choice to
 * skip the interactive cards and accept the coordinator's calls. */
export function simulateActiveGame(state: CareerState): CareerState {
  if (!state.interaction || state.interaction.type !== "game") return state;
  const priorGame = state.interaction.game;

  const entry = state.schedule.find((s) => s.week === state.weekInSeason)!;
  const ownTeam = buildOwnTeamForGame(state);
  const opponentTeam = (state.stage === "nfl_season" && getTeam(entry.opponentId)) || opponentTeamStub(entry.opponentLabel, entry.week);
  const input: BeginGameInput = {
    player: state.player,
    overall: overall(state.player),
    team: ownTeam,
    opponent: opponentTeam,
    week: entry.week,
    season: state.seasonYear,
    homeAdvantage: entry.isHome,
  };

  const { result: game, rngState } = withRng(state, (rng) => simulateGameToCompletion(priorGame, input, rng));
  return acknowledgeFinishedGame({ ...state, rngState, interaction: { type: "game", game } });
}

/** Called by the UI once it has finished visually playing out a completed
 *  game (see GameDayView's real-time playback pacing) — folds the final
 *  result into the career and clears the interaction. A no-op if the current
 *  interaction isn't a finished game, so it's safe to call defensively. */
export function acknowledgeFinishedGame(state: CareerState): CareerState {
  if (!state.interaction || state.interaction.type !== "game" || !state.interaction.game.finished) return state;
  const game = state.interaction.game;
  const entry = state.schedule.find((s) => s.week === state.weekInSeason)!;
  const ownTeam = buildOwnTeamForGame(state);
  const opponentTeam = (state.stage === "nfl_season" && getTeam(entry.opponentId)) || opponentTeamStub(entry.opponentLabel, entry.week);
  return foldGameResult({ ...state, interaction: null }, game, ownTeam, opponentTeam);
}

function foldGameResult(state: CareerState, game: GameSimState, ownTeam: Team, opponentTeam: Team): CareerState {
  const schedule = state.schedule.map((s) => (s.week === state.weekInSeason ? { ...s, played: true } : s));
  const seasonRecord = recordResult(state.seasonRecord, game.result ?? "loss");
  const currentSeasonGameStats = [...state.currentSeasonGameStats, game.stat];

  const isFirstCareerGame = state.stage === "nfl_season" && state.currentSeasonGameStats.length === 0 && state.careerSeasonsPlayed === 0;
  let achievements = checkGameAchievements(state.achievements, state.totalWeek, true, game.stat, isFirstCareerGame);

  const performanceScore = scoreGamePerformance(game.stat, state.player.position);
  const { result: newsItem, rngState: rngState1 } = withRng(state, (rng) =>
    generatePerformanceNews(state.totalWeek, state.player.bio.lastName, `${ownTeam.city} ${ownTeam.name}`.trim(), performanceScore, rng)
  );
  let news = state.news;
  if (newsItem) news = [newsItem, ...news].slice(0, 100);

  const { result: social, rngState: rngState2 } = withRng({ ...state, rngState: rngState1 }, (rng) =>
    rng.chance(0.4) ? generateSocialPost(state.totalWeek, performanceScore >= 0 ? "positive" : "negative", rng) : null
  );
  let socialFeed = state.socialFeed;
  if (social) socialFeed = [social, ...socialFeed].slice(0, 100);

  const confidenceDelta = performanceScore >= 0.35 ? 4 : performanceScore <= -0.35 ? -4 : 0;
  const gameDayObjective = getGameDayObjective(state.player.position, state.totalWeek);
  const objectiveCompleted = isGameDayObjectiveComplete(gameDayObjective, game.stat, game.result);
  let player: Player = {
    ...state.player,
    attributes: applyAttributeDeltas(state.player.attributes, [
      { path: "general.confidence", delta: confidenceDelta + (objectiveCompleted ? 3 : 0) },
      ...(objectiveCompleted ? [{ path: "general.fame" as const, delta: 1 }] : []),
    ]),
  };

  // Weekly practice: every scheduled week is a game day at every level (HS,
  // college, and the 17-week NFL slate all fill every week — see
  // GAME_DESIGN.md §7 roadmap), so a light passive practice gain — using
  // whatever focus the player picked for this week (see chooseTrainingFocus)
  // — is folded into every game week. This is intentionally smaller than a
  // dedicated off-week training tick (see applyTrainingTick) and keeps
  // attributes moving through a season instead of only changing at
  // season-end aging.
  let finalRngState = rngState2;
  let trainingLoad = state.trainingLoad ?? 0;
  let injuryRiskModifier = state.injuryRiskModifier ?? 0;
  if (state.stage === "high_school" || state.stage === "college" || state.stage === "nfl_season") {
    const college = state.stage === "college" && state.college ? getCollege(state.college.collegeId) : null;
    const devRate = college ? college.developmentRate : 1;
    const focus = state.pendingTrainingFocus ?? "position_specific";
    if (isTrainingFocus(focus)) {
      const { result: practiceResult, rngState: rngState3 } = withRng({ ...state, rngState: rngState2 }, (rng) =>
        applyTraining(player.attributes, focus, 0.5, devRate, rng, positionSpecificPaths(player), trainingLoad)
      );
      const attributes = applyAttributeDelta(practiceResult.attributes, "general.morale", practiceResult.moraleDelta * 0.5);
      player = { ...player, attributes };
      finalRngState = rngState3;
    }
  }

  // A real game also leaves a small, durable workload mark. It is intentionally
  // smaller than a hard practice so the player can recover between games.
  trainingLoad = nextTrainingLoad(trainingLoad, game.fatigue * 0.1);

  // In-game injury risk. Narrative-event injuryChance consequences (see
  // resolveDecision) only fire from specific story beats and mostly target
  // players who are already hurt, so without this roll the injury system
  // (recovery timelines, reinjury risk, playing-hurt tags) was practically
  // unreachable through ordinary play. One roll per game, skipped while
  // already carrying an injury so severities don't stack.
  let injuries = state.injuries;
  let tags = state.tags;
  if (injuries.length === 0) {
    const { result: injuryRoll, rngState: rngState4 } = withRng({ ...state, rngState: finalRngState }, (rng) =>
      rollForInjury(
        state.totalWeek,
        player.attributes.physical.durability,
        player.attributes.general.discipline,
        rng,
        injuryContextMultiplier(trainingLoad, injuryRiskModifier)
      )
    );
    finalRngState = rngState4;
    if (injuryRoll) {
      injuries = [...injuries, injuryRoll];
      tags = Array.from(new Set([...tags, injuryTagFor(injuryRoll.severity)]));
    }
  }

  const logMsg =
    game.result === "win"
      ? `Week ${state.weekInSeason}: beat ${game.opponentName} ${game.scorePlayer}-${game.scoreOpponent}.`
      : game.result === "loss"
      ? `Week ${state.weekInSeason}: fell to ${game.opponentName} ${game.scoreOpponent}-${game.scorePlayer}.`
      : `Week ${state.weekInSeason}: tied ${game.opponentName} ${game.scorePlayer}-${game.scoreOpponent}.`;

  let next: CareerState = log(
    {
      ...state,
      rngState: finalRngState,
      schedule,
      seasonRecord,
      currentSeasonGameStats,
      achievements,
      news,
      socialFeed,
      player,
      injuries,
      tags,
      trainingLoad,
      injuryRiskModifier,
    },
    logMsg
  );

  if (objectiveCompleted) {
    next = log(next, `Game Day Mission complete: ${gameDayObjective.title} (${gameDayObjective.rewardLabel}).`);
  }

  if (injuries.length > state.injuries.length) {
    next = log(next, `Injury: ${injuries[injuries.length - 1].type} (out an estimated ${injuries[injuries.length - 1].recoveryWeeks} week(s)).`);
  }

  return finishWeekProcessing(next, true);
}

function scoreGamePerformance(stat: StatLine, position: string): number {
  // Rough per-position "how good was this game" heuristic in [-1, 1].
  if (position === "QB") {
    const eff = stat.passAttempts > 0 ? stat.passCompletions / stat.passAttempts : 0.5;
    return clampScore((eff - 0.6) * 2 + stat.passTDs * 0.25 - stat.interceptionsThrown * 0.3);
  }
  if (position === "RB") return clampScore((stat.rushYards + stat.receivingYards * 0.45) / 100 - 0.4 + (stat.rushTDs + stat.receivingTDs) * 0.3 - stat.fumbles * 0.4);
  if (position === "WR") return clampScore(stat.receivingYards / 90 - 0.4 + stat.receptions / 8 + stat.receivingTDs * 0.3 - stat.fumbles * 0.35);
  if (position === "TE") return clampScore(stat.receivingYards / 75 - 0.38 + stat.receivingTDs * 0.38 + stat.blocksWon / 5 - stat.fumbles * 0.35);
  if (position === "OL") return clampScore(stat.blocksWon / 5 - 0.35);
  if (position === "LB") return clampScore(stat.tackles / 7 - 0.35 + stat.sacks * 0.36 + stat.interceptions * 0.5 + stat.passesDefended * 0.12 + stat.forcedFumbles * 0.22);
  if (position === "CB") return clampScore(stat.passesDefended / 2 - 0.3 + stat.interceptions * 0.55 + stat.tackles / 12 + stat.forcedFumbles * 0.16);
  if (position === "DL" || position === "S") return clampScore(stat.tackles / 8 - 0.3 + stat.sacks * 0.3 + stat.interceptions * 0.5);
  if (position === "K") {
    const accuracy = stat.fieldGoalAttempts > 0 ? stat.fieldGoalsMade / stat.fieldGoalAttempts : 0;
    return clampScore((accuracy - 0.72) * 2.2 + stat.fieldGoalsMade * 0.18 + stat.extraPointsMade * 0.03);
  }
  if (position === "P") {
    const average = stat.punts > 0 ? stat.puntYards / stat.punts : 0;
    return clampScore((average - 39) / 10 + stat.puntsInside20 * 0.15);
  }
  return 0;
}

function clampScore(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

// Season-level version of scoreGamePerformance: same per-position shape, but
// driven off full-season totals normalized by games played, so a great
// four-game stretch doesn't read the same as a great full season.
function seasonPerformanceScore(stat: StatLine, position: string): number {
  const games = Math.max(1, stat.gamesPlayed);
  if (position === "QB") {
    const eff = stat.passAttempts > 0 ? stat.passCompletions / stat.passAttempts : 0.5;
    return clampScore((eff - 0.59) * 1.6 + ((stat.passTDs / games) - 1.25) * 0.35 - (stat.interceptionsThrown / games) * 0.3 + ((stat.passYards / games) - 210) / 100 * 0.3);
  }
  if (position === "RB") return clampScore((((stat.rushYards + stat.receivingYards * 0.45) / games) - 70) / 55 * 0.45 + (((stat.rushTDs + stat.receivingTDs) / games) - 0.35) * 0.45 - (stat.fumbles / games) * 0.4);
  if (position === "WR") return clampScore(((stat.receivingYards / games) - 60) / 55 * 0.42 + ((stat.receptions / games) - 4) * 0.05 + ((stat.receivingTDs / games) - 0.35) * 0.46 - (stat.fumbles / games) * 0.3);
  // Tight ends need both receiving and blocking routes to elite recognition,
  // but routine blocking cannot make every above-average season an award.
  if (position === "TE") return clampScore(((stat.receivingYards / games) - 65) / 50 * 0.2 + ((stat.receivingTDs / games) - 0.3) * 0.4 + Math.max(0, (stat.blocksWon / games) - 4) * 1.05 + ((stat.receptions / games) - 4) * 0.04 - (stat.fumbles / games) * 0.3);
  if (position === "OL") return clampScore(((stat.blocksWon / games) - 4) / 3 * 0.4);
  if (position === "LB") return clampScore(((stat.tackles / games) - 5) / 4 * 0.38 + (stat.sacks / games) * 0.5 + (stat.interceptions / games) * 0.55 + (stat.passesDefended / games) * 0.14 + (stat.forcedFumbles / games) * 0.18);
  if (position === "CB") return clampScore(((stat.passesDefended / games) - 0.6) * 0.5 + (stat.interceptions / games) * 0.75 + ((stat.tackles / games) - 3) / 7 * 0.14 + (stat.forcedFumbles / games) * 0.15);
  if (position === "DL" || position === "S") return clampScore(((stat.tackles / games) - 4) / 5 * 0.35 + (stat.sacks / games) * 0.45 + (stat.interceptions / games) * 0.6 + (stat.passesDefended / games) * 0.15);
  if (position === "K") {
    const accuracy = stat.fieldGoalAttempts > 0 ? stat.fieldGoalsMade / stat.fieldGoalAttempts : 0;
    return clampScore((accuracy - 0.78) * 1.2 + ((stat.fieldGoalsMade / games) - 0.7) * 0.35 + ((stat.extraPointsMade / games) - 1.5) * 0.08);
  }
  if (position === "P") {
    const average = stat.punts > 0 ? stat.puntYards / stat.punts : 0;
    return clampScore((average - 42) / 6 * 0.45 + ((stat.puntsInside20 / games) - 0.4) * 0.65);
  }
  return 0;
}

// Determines end-of-season honors (Pro Bowl / All-Pro / MVP) from the
// season's aggregate stat line. Thresholds are deliberately steep — these
// are supposed to be rare, career-defining honors, not annual formalities.
export function evaluateSeasonAwards(stat: StatLine, position: string, teamWins: number): { proBowl: boolean; allPro: boolean; mvp: boolean } {
  if (stat.gamesPlayed < 6) return { proBowl: false, allPro: false, mvp: false };
  const score = seasonPerformanceScore(stat, position);
  // A personal career is not a league-wide simulation. A deterministic,
  // stat-derived selection roll models the scarcity of each honour without
  // making saves non-reproducible or turning every solid year into an award.
  const proBowl = score >= 0.55 || (score >= 0.28 && awardRoll(stat, position, teamWins, "pro") < clamp((score - 0.2) * 0.28, 0.02, 0.22));
  const allPro = score >= 0.6 || (score >= 0.52 && awardRoll(stat, position, teamWins, "all") < clamp((score - 0.48) * 0.12, 0.01, 0.07));
  // MVP is still deliberately rare outside QB, but the six MVP-depth roles
  // can now earn it from truly exceptional, position-appropriate seasons.
  const mvpThreshold = position === "QB" ? 0.6 : 0.92;
  const mvp = ["QB", "RB", "WR", "TE", "LB", "CB"].includes(position) && score >= mvpThreshold && teamWins >= 11 && (score >= mvpThreshold || awardRoll(stat, position, teamWins, "mvp") < 0.01);
  return { proBowl, allPro, mvp };
}

function awardRoll(stat: StatLine, position: string, teamWins: number, award: string): number {
  const value = [
    award,
    position,
    stat.season,
    stat.teamOrSchoolId,
    teamWins,
    stat.gamesPlayed,
    stat.passYards,
    stat.passTDs,
    stat.rushYards,
    stat.rushTDs,
    stat.receivingYards,
    stat.receivingTDs,
    stat.tackles,
    stat.sacks,
    stat.interceptions,
    stat.blocksWon,
    stat.fieldGoalsMade,
    stat.puntYards,
    stat.puntsInside20,
  ].join(":");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

// -----------------------------------------------------------------------------
// End-of-week / end-of-season processing
// -----------------------------------------------------------------------------

function finishWeekProcessing(state: CareerState, wasGameOrOffWeek: boolean): CareerState {
  const { state: financeState, log: financeLog } = weeklyFinanceTick(state.finance);
  // Every week includes some passive recovery. Deliberate recovery clears
  // considerably more through applyTrainingTick; a grind can therefore stack
  // pressure while a balanced plan steadily returns the player to baseline.
  let next: CareerState = {
    ...state,
    finance: financeState,
    trainingLoad: clamp((state.trainingLoad ?? 0) - 8, 0, 100),
    injuryRiskModifier: clamp((state.injuryRiskModifier ?? 0) * 0.7, -0.15, 0.35),
  };

  // Pay NFL salary. Contracts specify an annual amount spread across the
  // season, so this only fires while under contract during the nfl_season
  // stage — signing bonuses and dead money are paid separately at signing
  // time / release time (see contracts.ts / handleNFLSeasonEnd).
  if (next.stage === "nfl_season" && next.contract) {
    const pay = weeklySalary(next.contract, next.schedule.length || 18);
    if (pay > 0) {
      const { state: paidFinance } = applyIncome(next.finance, pay, "salary");
      next = log(next, `Paycheck: $${pay.toLocaleString()} (gross) from ${next.team ? `${next.team.city} ${next.team.name}` : "your team"}.`);
      next = { ...next, finance: paidFinance };
    }
  }

  // Injury recovery tick.
  const injuries: Injury[] = [];
  let tags = next.tags;
  for (const injury of next.injuries) {
    const { result: tickResult, rngState } = withRng(next, (rng) => tickInjuryRecovery(injury, false, rng));
    next = { ...next, rngState };
    if (tickResult.injury) {
      injuries.push(tickResult.injury);
    } else {
      tags = tags.filter((t) => t !== injuryTagFor(injury.severity));
    }
  }
  next = { ...next, injuries, tags };

  next = { ...next, totalWeek: next.totalWeek + 1, weekInSeason: next.weekInSeason + 1 };

  const seasonScheduleLength = next.schedule.length;
  const seasonOver = (next.stage === "high_school" || next.stage === "college" || next.stage === "nfl_season") && next.weekInSeason > seasonScheduleLength;

  if (seasonOver) {
    next = handleSeasonEnd(next);
  } else if (next.stage === "draft") {
    next = advanceDraftProcess(next);
  } else if (next.stage === "nfl_offseason") {
    next = advanceOffseason(next);
  }

  return next;
}

// -----------------------------------------------------------------------------
// Season-end handling per stage
// -----------------------------------------------------------------------------

function handleSeasonEnd(state: CareerState): CareerState {
  switch (state.stage) {
    case "high_school":
      return handleHighSchoolSeasonEnd(state);
    case "college":
      return handleCollegeSeasonEnd(state);
    case "nfl_season":
      return handleNFLSeasonEnd(state);
    default:
      return state;
  }
}

function seasonStatSummary(state: CareerState, level: StatLine["level"], teamOrSchoolId: string): StatLine {
  return sumStatLines(state.currentSeasonGameStats, state.seasonYear, level, teamOrSchoolId);
}

function handleHighSchoolSeasonEnd(state: CareerState): CareerState {
  const seasonStat = seasonStatSummary(state, "high_school", state.highSchool.schoolName);
  const statHistory = [...state.statHistory, seasonStat];
  const { attributes, notes } = applySeasonalAging(state.player.attributes, state.player.bio.age, 0);
  const player: Player = { ...state.player, attributes, bio: { ...state.player.bio, age: state.player.bio.age + 1 } };

  const nextClassYear = (state.highSchool.classYear + 1) as HighSchoolRecord["classYear"];
  const starRating = clamp(Math.round(overall(player) / 20), 0, 5);

  let next: CareerState = {
    ...state,
    player,
    statHistory,
    currentSeasonGameStats: [],
    highSchool: { ...state.highSchool, classYear: nextClassYear > 12 ? 12 : nextClassYear, starRating, stats: statHistory },
  };
  for (const note of notes) next = log(next, note);

  if (nextClassYear > 12 || state.highSchool.classYear === 12) {
    // Move to recruiting.
    const offers = generateRecruitingOffers(next);
    next = { ...next, stage: "recruiting", recruitingOffers: offers, recruitingReady: true };
    return log(next, `Senior season complete. ${offers.length} college(s) have offered you a scholarship.`);
  }

  // Otherwise start next HS season.
  const { result: schedule, rngState } = withRng(next, (rng) => generateHighSchoolSchedule(rng, HS_SEASON_WEEKS));
  next = { ...next, rngState, schedule, weekInSeason: 1, seasonYear: next.seasonYear + 1, seasonRecord: emptyRecord() };

  // Mid-career recruiting buzz for juniors/seniors.
  if (next.highSchool.classYear >= 11) {
    const offers = generateRecruitingOffers(next);
    next = { ...next, recruitingOffers: mergeOffers(next.recruitingOffers, offers) };
  }

  return log(next, `Advancing to ${gradeLabel(next.highSchool.classYear)} year at ${next.highSchool.schoolName}.`);
}

function gradeLabel(year: number): string {
  return { 9: "freshman", 10: "sophomore", 11: "junior", 12: "senior" }[year] ?? "next";
}

function generateRecruitingOffers(state: CareerState): RecruitingOfferView[] {
  const power = overall(state.player) * 0.6 + state.player.attributes.general.fame * 0.4;
  // Recruiting must be reproducible from CareerState. Do not use Math.random
  // here: it made a save produce different offers after a reload.
  const roll = (key: string) => (hashOpponentSeed(`recruiting:${state.seed}:${state.totalWeek}:${state.highSchool.classYear}:${key}`) / 0xffffffff);
  const eligible = COLLEGES.filter((college) => college.prestige <= power + 15 + roll(`${college.id}:eligible`) * 15);
  const result = [...eligible]
    .sort((a, b) => roll(`${a.id}:order`) - roll(`${b.id}:order`))
    .slice(0, 3 + Math.floor(roll("offer-count") * 4));
  return result.map((college: College) => ({
    collegeId: college.id,
    collegeName: `${college.name} ${college.mascot}`,
    interestLevel: clamp(60 + Math.round(roll(`${college.id}:interest`) * 30)),
    scholarship: true,
  }));
}

function mergeOffers(existing: RecruitingOfferView[], fresh: RecruitingOfferView[]): RecruitingOfferView[] {
  const seen = new Set(existing.map((o) => o.collegeId));
  return [...existing, ...fresh.filter((o) => !seen.has(o.collegeId))];
}

export function commitToCollege(state: CareerState, collegeId: string): CareerState {
  if (state.stage !== "recruiting") return state;
  const college = getCollege(collegeId);
  if (!college) return state;

  const { result: schedule, rngState } = withRng(state, (rng) => generateCollegeSchedule(collegeId, rng, COLLEGE_SEASON_WEEKS));

  const collegeRecord: CollegeRecord = {
    collegeId,
    yearsPlayed: 0,
    redshirted: false,
    transferred: false,
    major: "Undeclared",
    gpa: 3.0,
    nilEarnings: 0,
    stats: [],
    declaredForDraft: false,
  };

  return log(
    {
      ...state,
      rngState,
      stage: "college",
      college: collegeRecord,
      recruitingReady: false,
      schedule,
      weekInSeason: 1,
      seasonRecord: emptyRecord(),
      relationships: [...state.relationships.filter((r) => r.type !== "coach"), { id: `rel_coach_college`, name: `${college.name} Coaching Staff`, type: "coach", value: 55, tags: [], history: [] }],
    },
    `Committed to ${college.name} ${college.mascot}!`
  );
}

function handleCollegeSeasonEnd(state: CareerState): CareerState {
  if (!state.college) return state;
  const seasonStat = seasonStatSummary(state, "college", state.college.collegeId);
  const statHistory = [...state.statHistory, seasonStat];
  const { attributes, notes } = applySeasonalAging(state.player.attributes, state.player.bio.age, state.college.yearsPlayed);
  const player: Player = { ...state.player, attributes, bio: { ...state.player.bio, age: state.player.bio.age + 1 } };

  const yearsPlayed = state.college.yearsPlayed + 1;
  const college: CollegeRecord = { ...state.college, yearsPlayed, stats: statHistory };

  let next: CareerState = { ...state, player, statHistory, currentSeasonGameStats: [], college };
  for (const note of notes) next = log(next, note);

  const declaredEarly = next.tags.includes("declared_early");
  const readyForDraft = yearsPlayed >= 3 || declaredEarly;

  if (readyForDraft) {
    const combine = undefined;
    const { result: projection, rngState } = withRng(next, (rng) => generateDraftProjection(next.player, rng, combine));
    next = { ...next, rngState, stage: "draft", draftProjection: projection, draftWeekInProcess: 0, college: { ...college, declaredForDraft: true } };
    return log(next, `Declared for the NFL Draft after ${yearsPlayed} college season(s).`);
  }

  const { result: schedule, rngState } = withRng(next, (rng) => generateCollegeSchedule(college.collegeId, rng, COLLEGE_SEASON_WEEKS));
  next = { ...next, rngState, schedule, weekInSeason: 1, seasonYear: next.seasonYear + 1, seasonRecord: emptyRecord() };
  return log(next, `Entering year ${yearsPlayed + 1} at ${getCollege(college.collegeId)?.name}.`);
}

// -----------------------------------------------------------------------------
// Draft process (a handful of weeks of events, then resolution)
// -----------------------------------------------------------------------------

const DRAFT_PROCESS_WEEKS = 6;

function advanceDraftProcess(state: CareerState): CareerState {
  let next = state;
  next = { ...next, draftWeekInProcess: next.draftWeekInProcess + 1 };

  if (next.draftWeekInProcess === 2 && next.draftProjection) {
    const { result: combine, rngState } = withRng(next, (rng) => generateCombineScores(next.player, rng));
    const { result: projection, rngState: rngState2 } = withRng({ ...next, rngState }, (rng) => generateDraftProjection(next.player, rng, combine));
    next = { ...next, rngState: rngState2, draftProjection: projection };
    next = log(next, `Combine complete. Projected: Round ${projection.projectedRoundLow}-${projection.projectedRoundHigh}.`);
  }

  if (next.draftWeekInProcess >= DRAFT_PROCESS_WEEKS) {
    next = resolveDraftNight(next);
  }

  return next;
}

function resolveDraftNight(state: CareerState): CareerState {
  if (!state.draftProjection) return state;
  const { result: draftResult, rngState } = withRng(state, (rng) => resolveDraft(state.draftProjection!, state.seasonYear, rng));
  let next: CareerState = { ...state, rngState, draftResult };

  const team = draftResult.teamId ? getTeam(draftResult.teamId) : null;
  const { years, totalValue, signingBonus } = rookieContractValue(draftResult.round, draftResult.pick);
  const contract = buildContract(draftResult.teamId ?? "undrafted", years, totalValue, signingBonus, next.seasonYear, true);

  const { state: financeAfterBonus } = applyIncome(next.finance, signingBonus, "Signing bonus");

  const { result: schedule, rngState: rngState2 } = withRng(next, (rng) => generateNFLSchedule(draftResult.teamId ?? TEAMS[0].id, rng, NFL_SEASON_WEEKS));

  next = {
    ...next,
    rngState: rngState2,
    stage: "nfl_offseason",
    team: team ?? null,
    contract,
    finance: financeAfterBonus,
    schedule,
    weekInSeason: 1,
    seasonRecord: emptyRecord(),
    teamsPlayedFor: team ? Array.from(new Set([...next.teamsPlayedFor, team.id])) : next.teamsPlayedFor,
  };

  const headline = draftResult.round === 0 ? `Went undrafted, but signed a free agent deal with the ${team?.city ?? "league"} ${team?.name ?? ""}.` : `Drafted in round ${draftResult.round}, pick ${draftResult.pick} by the ${team?.city} ${team?.name}!`;
  return log(next, headline);
}

// -----------------------------------------------------------------------------
// NFL offseason -> season transition
// -----------------------------------------------------------------------------

function advanceOffseason(state: CareerState): CareerState {
  // Simple offseason clock: after NFL_OFFSEASON_WEEKS, kick off the season.
  const offseasonWeek = state.weekInSeason; // reused counter for offseason weeks
  if (offseasonWeek <= NFL_OFFSEASON_WEEKS) return state;

  if (!state.contract || !state.team) {
    // No contract: enter free agency.
    return enterFreeAgency(state);
  }

  const { result: schedule, rngState } = withRng(state, (rng) => generateNFLSchedule(state.team!.id, rng, NFL_SEASON_WEEKS));
  return log({ ...state, rngState, stage: "nfl_season", schedule, weekInSeason: 1, seasonRecord: emptyRecord() }, `Training camp is over. The ${state.team.city} ${state.team.name} season begins.`);
}

function enterFreeAgency(state: CareerState): CareerState {
  const { result: offers, rngState } = withRng(state, (rng) => generateFreeAgencyOffers(overall(state.player), state.player.attributes.general.fame, state.player.bio.age, state.seasonYear, rng));
  return log({ ...state, rngState, stage: "free_agency", freeAgencyOffers: offers }, `You're a free agent. ${offers.length} teams have made offers.`);
}

export function signWithTeam(state: CareerState, teamId: string): CareerState {
  if (!state.freeAgencyOffers) return state;
  const offer = state.freeAgencyOffers.find((o) => o.teamId === teamId);
  if (!offer) return state;
  const team = getTeam(teamId);

  const { state: financeAfterBonus } = applyIncome(state.finance, offer.contract.signingBonus, "Signing bonus");
  const { result: schedule, rngState } = withRng(state, (rng) => generateNFLSchedule(teamId, rng, NFL_SEASON_WEEKS));

  return log(
    {
      ...state,
      rngState,
      stage: "nfl_season",
      team: team ?? null,
      contract: offer.contract,
      finance: financeAfterBonus,
      freeAgencyOffers: null,
      schedule,
      weekInSeason: 1,
      seasonRecord: emptyRecord(),
      teamsPlayedFor: team ? Array.from(new Set([...state.teamsPlayedFor, team.id])) : state.teamsPlayedFor,
    },
    `Signed a ${offer.contract.years}-year, $${offer.contract.totalValue.toLocaleString()} deal with the ${team?.city} ${team?.name}.`
  );
}

function handleNFLSeasonEnd(state: CareerState): CareerState {
  let seasonStat = seasonStatSummary(state, "nfl", state.team?.id ?? "unknown");

  const awards = evaluateSeasonAwards(seasonStat, state.player.position, state.seasonRecord.wins);
  seasonStat = { ...seasonStat, proBowl: awards.proBowl, allPro: awards.allPro, mvp: awards.mvp };
  let statHistory = [...state.statHistory, seasonStat];

  const careerSeasonsPlayed = state.careerSeasonsPlayed + 1;
  let achievements = checkSeasonsAchievement(state.achievements, state.totalWeek, careerSeasonsPlayed);
  achievements = checkCareerEarningsAchievement(achievements, state.totalWeek, state.finance.totalCareerEarnings);
  achievements = checkTeamHistoryAchievements(achievements, state.totalWeek, new Set(state.teamsPlayedFor), false);
  if (awards.proBowl) achievements = unlock(achievements, "pro_bowl", state.totalWeek);
  if (awards.allPro) achievements = unlock(achievements, "all_pro", state.totalWeek);
  if (awards.mvp) achievements = unlock(achievements, "mvp", state.totalWeek);

  let next: CareerState = { ...state, statHistory, careerSeasonsPlayed, achievements, currentSeasonGameStats: [] };
  if (awards.mvp) next = log(next, "Named league MVP! A season for the ages.");
  else if (awards.allPro) next = log(next, "Named an All-Pro this season.");
  else if (awards.proBowl) next = log(next, "Pro Bowl selection this season.");

  // Playoffs.
  const teamOverall = state.team ? (state.team.prestige + state.team.rosterStrength) / 2 : 50;
  if (state.team && qualifiesForPlayoffsWrapper(next)) {
    const { result: playoff, rngState } = withRng(next, (rng) => simulatePlayoffRun(teamOverall, rng, overall(next.player)));
    next = { ...next, rngState, playoffResult: playoff };
    if (playoff.wonSuperBowl) {
      statHistory = statHistory.map((s, i) => (i === statHistory.length - 1 ? { ...s, championshipWon: true } : s));
      next = { ...next, statHistory };
      next = log(next, "SUPER BOWL CHAMPIONS! A career-defining moment.");
    } else {
      next = log(next, `Season ends in the ${playoff.rounds[playoff.rounds.length - 1]?.round ?? "playoffs"}.`);
    }
  } else {
    next = { ...next, playoffResult: null };
    next = log(next, "Missed the playoffs this season.");
  }

  // Aging.
  const { attributes, notes } = applySeasonalAging(next.player.attributes, next.player.bio.age, careerSeasonsPlayed);
  const player: Player = { ...next.player, attributes, bio: { ...next.player.bio, age: next.player.bio.age + 1 } };
  next = { ...next, player };
  for (const note of notes) next = log(next, note);

  // Sponsorship opportunity check.
  if (next.player.attributes.general.fame >= 20) {
    const { result: sponsorship, rngState } = withRng(next, (rng) =>
      generateSponsorshipOffer(next.player.attributes.general.fame, next.player.attributes.general.reputation, rng, next.finance.sponsorships.map((s) => s.brand))
    );
    next = { ...next, rngState };
    if (sponsorship && next.finance.sponsorships.length < MAX_ACTIVE_SPONSORSHIPS) {
      next = { ...next, finance: addSponsorship(next.finance, sponsorship, next.totalWeek) };
      next = log(next, `New sponsorship deal with ${sponsorship.brand}.`);
    }
  }

  // Contract year advance / expiration -> free agency. A genuinely bad season
  // can also end a deal early ("released") — real consequences beyond just
  // waiting out the contract's length; see checkPerformanceRelease.
  const currentContract = next.contract;
  if (currentContract) {
    const teamName = next.team ? `${next.team.city} ${next.team.name}` : "the team";
    const { result: released, rngState: releaseRng } = withRng(next, (rng) => checkPerformanceRelease(currentContract, next.seasonRecord.wins, next.seasonRecord.losses, rng));
    next = { ...next, rngState: releaseRng };
    if (released) {
      // Guaranteed money is still owed even after a release; approximate the
      // unpaid guaranteed portion still on the books as a lump-sum payout.
      const deadMoney = Math.round(currentContract.guaranteedMoney * 0.5);
      const { state: financeAfterPayout } = applyIncome(next.finance, deadMoney, "Guaranteed money (release)");
      next = { ...next, contract: null, team: null, finance: financeAfterPayout };
      next = log(next, `Released by the ${teamName} after a rough ${next.seasonRecord.wins}-${next.seasonRecord.losses} season. Remaining guaranteed money still pays out, but the rest of the deal is void.`);
      next = enterFreeAgency(next);
      return next;
    }

    const advanced = advanceContractYear(currentContract);
    if (isContractExpired(advanced)) {
      next = { ...next, contract: null };
      next = enterFreeAgency(next);
      return next;
    }
    next = { ...next, contract: advanced };
  }

  // Auto-retirement ceiling.
  if (next.player.bio.age >= 40) {
    return retireCareer(next);
  }

  next = { ...next, stage: "nfl_offseason", weekInSeason: 1 };
  return next;
}

function qualifiesForPlayoffsWrapper(state: CareerState): boolean {
  const { result } = withRng(state, (rng) => qualifiesForPlayoffs(state.seasonRecord, state.team?.prestige ?? 50, rng));
  return result;
}

// -----------------------------------------------------------------------------
// Retirement & legacy
// -----------------------------------------------------------------------------

export function canRetire(state: CareerState): boolean {
  return state.stage === "nfl_offseason" || state.stage === "free_agency" || state.stage === "nfl_season";
}

export function retireCareer(state: CareerState): CareerState {
  const nflSeasons = state.statHistory.filter((s) => s.level === "nfl");
  const legacyInput: LegacyInput = {
    seasonStats: nflSeasons,
    careerEarnings: state.finance.totalCareerEarnings,
    netWorth: state.finance.netWorth,
    draftedRound: state.draftResult?.round ?? 0,
    seasonsPlayed: state.careerSeasonsPlayed,
  };
  const legacy = computeLegacy(legacyInput);
  let achievements = state.achievements;
  if (legacy.tier === "hall_of_fame") achievements = unlock(achievements, "hall_of_famer", state.totalWeek);
  if (legacy.championships > 0) achievements = unlock(achievements, "super_bowl_champion", state.totalWeek);
  const wentUndrafted = (state.draftResult?.round ?? 0) === 0;
  const madeItBig = legacy.tier === "star" || legacy.tier === "superstar" || legacy.tier === "legend" || legacy.tier === "hall_of_fame";
  if (wentUndrafted && madeItBig) achievements = unlock(achievements, "undrafted_to_superstar", state.totalWeek);
  achievements = checkTeamHistoryAchievements(achievements, state.totalWeek, new Set(state.teamsPlayedFor), true);

  return log({ ...state, retired: true, stage: "retired", legacy, achievements, interaction: null }, `Career complete. Legacy: ${legacy.summary}`);
}

// -----------------------------------------------------------------------------
// Player-initiated finance actions (delegated to finance.ts, kept here so the
// UI only ever talks to career.ts)
// -----------------------------------------------------------------------------

export function buyAsset(state: CareerState, asset: Parameters<typeof purchaseAsset>[1]): CareerState {
  const { state: finance, ok } = purchaseAsset(state.finance, asset, state.totalWeek);
  if (!ok) return state;
  const tags = new Set(state.tags);
  if (asset.type === "car") tags.add(asset.value >= 85_000 ? "owns_luxury_car" : "owns_car");
  if (asset.type === "house") tags.add(asset.value >= 1_000_000 ? "owns_luxury_home" : "owns_house");
  if (asset.type === "investment") tags.add("has_investments");
  return log({ ...state, finance, tags: [...tags] }, `Purchased ${asset.name} for $${asset.value.toLocaleString()}.`);
}

const PARTNER_NAMES = ["Maya Brooks", "Avery Cole", "Jordan Ellis", "Riley Grant", "Morgan Hayes", "Taylor Monroe"];

/** Player-led relationship decisions: a career never creates or replaces a
 * partner automatically. The player explicitly starts, changes, or ends it. */
export function startOrChangePartner(state: CareerState): CareerState {
  if (state.player.bio.age < 17) return state;
  const name = PARTNER_NAMES[state.totalWeek % PARTNER_NAMES.length];
  const relationships = [
    ...state.relationships.filter((r) => r.type !== "partner"),
    { id: `rel_partner_${state.totalWeek}`, name, type: "partner" as const, value: 58, tags: ["player_choice"], history: [{ week: state.totalWeek, note: "You chose to begin a relationship." }] },
  ];
  const tags = Array.from(new Set([...state.tags.filter((t) => t !== "married"), "in_relationship"]));
  return log({ ...state, relationships, tags }, `You chose to start a relationship with ${name}.`);
}

export function endPartnerRelationship(state: CareerState): CareerState {
  const partner = state.relationships.find((r) => r.type === "partner");
  if (!partner) return state;
  return log(
    { ...state, relationships: state.relationships.filter((r) => r.type !== "partner"), tags: state.tags.filter((t) => t !== "in_relationship" && t !== "married") },
    `You chose to end your relationship with ${partner.name}.`
  );
}

export function handlePaparazzi(state: CareerState, approach: "private" | "embrace"): CareerState {
  const mediaDelta = approach === "private" ? -2 : 4;
  const relationships = bumpRelationship(state, "media", mediaDelta);
  const player = {
    ...state.player,
    attributes: applyAttributeDelta(state.player.attributes, "general.reputation", approach === "private" ? 1 : 3),
  };
  const item: NewsItem = {
    id: `news_press_${state.totalWeek}`,
    week: state.totalWeek,
    headline: approach === "private" ? "Player keeps private life out of the spotlight" : "Player embraces the spotlight after a night out",
    body: approach === "private" ? "A calm response cooled the story before it could grow." : "The appearance puts the player at the center of the week's conversation.",
    tone: approach === "private" ? "neutral" : "controversial",
    source: "Cityline Sports",
    requiresResponse: false,
    responded: false,
    tags: ["paparazzi"],
  };
  return log({ ...state, player, relationships, news: [item, ...state.news].slice(0, 100) }, `You chose how to handle the paparazzi.`);
}

export function respondToNews(state: CareerState, newsId: string): CareerState {
  const news = state.news.map((n) => (n.id === newsId ? { ...n, responded: true } : n));
  return { ...state, news };
}

export { ACHIEVEMENT_DEFINITIONS };
