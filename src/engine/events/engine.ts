import type {
  Achievement,
  CareerStage,
  EventAwardKey,
  EventCondition,
  GameEventDefinition,
  Player,
  Position,
  Relationship,
  StatLine,
  StatMinimumKey,
} from "../types";
import { getAttributeByPath } from "../attributes";
import type { RNG } from "../rng";
import { getEventRequirements } from "./eligibilityPolicy";

// =============================================================================
// Central narrative eligibility engine
// =============================================================================

export type EligibilityReasonCode =
  | "retired" | "stage" | "age_min" | "age_max" | "year_min" | "year_max"
  | "week_min" | "week_max" | "career_week_min" | "career_seasons_min"
  | "position" | "personality_required" | "personality_forbidden"
  | "attribute_min" | "attribute_max" | "coach_relationship_min" | "coach_relationship_max"
  | "relationship_min" | "fame_min" | "fame_max" | "reputation_min" | "reputation_max"
  | "games_min" | "stat_min" | "award_min" | "achievement_required" | "milestone_required"
  | "tag_required" | "tag_forbidden" | "event_required" | "event_incompatible"
  | "cooldown" | "max_occurrences";

export interface EligibilityReason {
  code: EligibilityReasonCode;
  message: string;
  expected?: number | string | string[];
  actual?: number | string | string[];
}

export interface EligibilityResult {
  eligible: boolean;
  /** Empty when accepted; otherwise each deterministic reason for rejection. */
  reasons: EligibilityReason[];
  requirements: EventCondition;
  occurrenceCount: number;
  probability: number;
}

export interface EventMemoryState {
  firedAt: [string, number][];
  firedOnce: string[];
  /** Absent in older saves; those safely infer one resolved occurrence. */
  firedCount?: [string, number][];
}

/** Structural subset of CareerState. The real CareerState satisfies it
 * directly while the engine avoids a runtime import cycle with career.ts. */
export interface EventEligibilityState {
  player: Player;
  stage: CareerStage;
  year: number;
  weekInSeason: number;
  totalWeek: number;
  careerSeasonsPlayed: number;
  statHistory: StatLine[];
  currentSeasonGameStats: StatLine[];
  relationships: Relationship[];
  tags: string[];
  eventMemory: EventMemoryState;
  decisionHistory: { eventId: string }[];
  achievements: Achievement[];
  retired: boolean;
}

function addReason(reasons: EligibilityReason[], code: EligibilityReasonCode, message: string, expected?: EligibilityReason["expected"], actual?: EligibilityReason["actual"]) {
  reasons.push({ code, message, expected, actual });
}

function occurrenceCount(eventId: string, state: EventEligibilityState): number {
  const savedCount = new Map(state.eventMemory.firedCount ?? []).get(eventId);
  if (savedCount !== undefined) return savedCount;
  if (state.eventMemory.firedOnce.includes(eventId)) return 1;
  return state.decisionHistory.filter((decision) => decision.eventId === eventId).length;
}

function hasOccurred(eventId: string, state: EventEligibilityState): boolean {
  return occurrenceCount(eventId, state) > 0;
}

function statTotal(state: EventEligibilityState, key: StatMinimumKey): number {
  return [...state.statHistory, ...state.currentSeasonGameStats]
    .reduce((sum, line) => sum + (Number(line[key]) || 0), 0);
}

function awardTotal(state: EventEligibilityState, award: EventAwardKey): number {
  const lines = [...state.statHistory, ...state.currentSeasonGameStats];
  if (award === "proBowls") return lines.filter((line) => line.proBowl).length;
  if (award === "allPros") return lines.filter((line) => line.allPro).length;
  if (award === "mvps") return lines.filter((line) => line.mvp).length;
  return lines.filter((line) => line.championshipWon).length;
}

function relationshipValue(state: EventEligibilityState, type: string): number {
  return state.relationships.find((relationship) => relationship.type === type)?.value ?? 0;
}

/**
 * The sole source of truth for story eligibility. This function is pure,
 * deterministic and returns diagnostics instead of a bare boolean so tests,
 * simulations and future UI explanations agree on exactly why an event did
 * or did not appear.
 */
export function isEventEligible(event: GameEventDefinition, state: EventEligibilityState): EligibilityResult {
  const requirements = getEventRequirements(event);
  const reasons: EligibilityReason[] = [];
  const { player } = state;
  const fame = player.attributes.general.fame;
  const reputation = player.attributes.general.reputation;
  const count = occurrenceCount(event.id, state);

  if (state.retired || state.stage === "retired") addReason(reasons, "retired", "The career is retired.");
  if (requirements.stage && !requirements.stage.includes(state.stage)) addReason(reasons, "stage", `Requires ${requirements.stage.join(" or ")}.`, requirements.stage, state.stage);
  if (requirements.minAge !== undefined && player.bio.age < requirements.minAge) addReason(reasons, "age_min", `Requires age ${requirements.minAge}+.`, requirements.minAge, player.bio.age);
  if (requirements.maxAge !== undefined && player.bio.age > requirements.maxAge) addReason(reasons, "age_max", `Requires age ${requirements.maxAge} or younger.`, requirements.maxAge, player.bio.age);
  if (requirements.minYear !== undefined && state.year < requirements.minYear) addReason(reasons, "year_min", `Requires year ${requirements.minYear}+.`, requirements.minYear, state.year);
  if (requirements.maxYear !== undefined && state.year > requirements.maxYear) addReason(reasons, "year_max", `Requires year ${requirements.maxYear} or earlier.`, requirements.maxYear, state.year);
  if (requirements.minWeek !== undefined && state.weekInSeason < requirements.minWeek) addReason(reasons, "week_min", `Requires Week ${requirements.minWeek}+.`, requirements.minWeek, state.weekInSeason);
  if (requirements.maxWeek !== undefined && state.weekInSeason > requirements.maxWeek) addReason(reasons, "week_max", `Requires Week ${requirements.maxWeek} or earlier.`, requirements.maxWeek, state.weekInSeason);
  if (requirements.minCareerWeek !== undefined && state.totalWeek < requirements.minCareerWeek) addReason(reasons, "career_week_min", `Requires career week ${requirements.minCareerWeek}+.`, requirements.minCareerWeek, state.totalWeek);
  if (requirements.minCareerSeasons !== undefined && state.careerSeasonsPlayed < requirements.minCareerSeasons) addReason(reasons, "career_seasons_min", `Requires ${requirements.minCareerSeasons}+ completed career seasons.`, requirements.minCareerSeasons, state.careerSeasonsPlayed);
  if (requirements.positions && !requirements.positions.includes(player.position)) addReason(reasons, "position", `Requires ${requirements.positions.join(" or ")}.`, requirements.positions, player.position);
  if (requirements.personalityAny && !requirements.personalityAny.some((trait) => player.personality.includes(trait))) addReason(reasons, "personality_required", "Requires one of the listed personality traits.", requirements.personalityAny, player.personality);
  if (requirements.personalityAll && !requirements.personalityAll.every((trait) => player.personality.includes(trait))) addReason(reasons, "personality_required", "Requires all listed personality traits.", requirements.personalityAll, player.personality);
  if (requirements.personalityNone && requirements.personalityNone.some((trait) => player.personality.includes(trait))) addReason(reasons, "personality_forbidden", "Blocked by a personality trait.", requirements.personalityNone, player.personality);

  if (requirements.minAttribute) {
    const actual = getAttributeByPath(player.attributes, requirements.minAttribute.path);
    if (actual < requirements.minAttribute.value) addReason(reasons, "attribute_min", `${requirements.minAttribute.path} is too low.`, requirements.minAttribute.value, actual);
  }
  if (requirements.maxAttribute) {
    const actual = getAttributeByPath(player.attributes, requirements.maxAttribute.path);
    if (actual > requirements.maxAttribute.value) addReason(reasons, "attribute_max", `${requirements.maxAttribute.path} is too high.`, requirements.maxAttribute.value, actual);
  }

  const coach = relationshipValue(state, "coach");
  if (requirements.minCoachRelationship !== undefined && coach < requirements.minCoachRelationship) addReason(reasons, "coach_relationship_min", "Coach relationship is too low.", requirements.minCoachRelationship, coach);
  if (requirements.maxCoachRelationship !== undefined && coach > requirements.maxCoachRelationship) addReason(reasons, "coach_relationship_max", "Coach relationship is too high.", requirements.maxCoachRelationship, coach);
  for (const [type, minimum] of Object.entries(requirements.minRelationships ?? {})) {
    if (minimum === undefined) continue;
    const actual = relationshipValue(state, type);
    if (actual < minimum) addReason(reasons, "relationship_min", `${type} relationship is too low.`, minimum, actual);
  }

  if (requirements.minFame !== undefined && fame < requirements.minFame) addReason(reasons, "fame_min", "Fame is too low.", requirements.minFame, fame);
  if (requirements.maxFame !== undefined && fame > requirements.maxFame) addReason(reasons, "fame_max", "Fame is too high.", requirements.maxFame, fame);
  if (requirements.minReputation !== undefined && reputation < requirements.minReputation) addReason(reasons, "reputation_min", "Reputation is too low.", requirements.minReputation, reputation);
  if (requirements.maxReputation !== undefined && reputation > requirements.maxReputation) addReason(reasons, "reputation_max", "Reputation is too high.", requirements.maxReputation, reputation);

  const games = statTotal(state, "gamesPlayed");
  if (requirements.minGamesPlayed !== undefined && games < requirements.minGamesPlayed) addReason(reasons, "games_min", "Not enough completed games.", requirements.minGamesPlayed, games);
  for (const [stat, minimum] of Object.entries(requirements.minStats ?? {}) as [StatMinimumKey, number | undefined][]) {
    if (minimum === undefined) continue;
    const actual = statTotal(state, stat);
    if (actual < minimum) addReason(reasons, "stat_min", `${stat} is too low.`, minimum, actual);
  }
  for (const [award, minimum] of Object.entries(requirements.minAwards ?? {}) as [EventAwardKey, number | undefined][]) {
    if (minimum === undefined) continue;
    const actual = awardTotal(state, award);
    if (actual < minimum) addReason(reasons, "award_min", `${award} total is too low.`, minimum, actual);
  }

  const unlockedAchievements = new Set(state.achievements.filter((achievement) => achievement.unlockedWeek !== null).map((achievement) => achievement.id));
  for (const achievement of requirements.requiredAchievements ?? []) if (!unlockedAchievements.has(achievement)) addReason(reasons, "achievement_required", `Requires achievement ${achievement}.`, achievement);
  for (const milestone of requirements.requiredMilestones ?? []) if (!state.tags.includes(milestone)) addReason(reasons, "milestone_required", `Requires milestone ${milestone}.`, milestone);
  for (const tag of requirements.tagsPresent ?? []) if (!state.tags.includes(tag)) addReason(reasons, "tag_required", `Requires narrative flag ${tag}.`, tag);
  for (const tag of requirements.tagsAbsent ?? []) if (state.tags.includes(tag)) addReason(reasons, "tag_forbidden", `Blocked by narrative flag ${tag}.`, tag);
  for (const eventId of requirements.requiredEvents ?? []) if (!hasOccurred(eventId, state)) addReason(reasons, "event_required", `Requires prior event ${eventId}.`, eventId);
  for (const eventId of requirements.incompatibleEvents ?? []) if (hasOccurred(eventId, state)) addReason(reasons, "event_incompatible", `Conflicts with prior event ${eventId}.`, eventId);

  const lastFired = new Map(state.eventMemory.firedAt).get(event.id);
  if (lastFired !== undefined && state.totalWeek - lastFired < event.cooldownWeeks) addReason(reasons, "cooldown", `On cooldown for ${event.cooldownWeeks - (state.totalWeek - lastFired)} more week(s).`, event.cooldownWeeks, state.totalWeek - lastFired);
  if (requirements.maxOccurrences !== undefined && count >= requirements.maxOccurrences) addReason(reasons, "max_occurrences", `Reached the ${requirements.maxOccurrences}-occurrence limit.`, requirements.maxOccurrences, count);

  return { eligible: reasons.length === 0, reasons, requirements, occurrenceCount: count, probability: requirements.probability ?? 0.35 };
}

/** Repeated stories remain possible when justified, but steadily lose weight. */
export function eventSelectionWeight(event: GameEventDefinition, state: EventEligibilityState, result = isEventEligible(event, state)): number {
  if (!result.eligible) return 0;
  const lastFired = new Map(state.eventMemory.firedAt).get(event.id);
  const weeksSince = lastFired === undefined ? Number.POSITIVE_INFINITY : state.totalWeek - lastFired;
  const recencyPenalty = Number.isFinite(weeksSince) && weeksSince < event.cooldownWeeks * 2 ? 0.45 : 1;
  const repetitionPenalty = 1 / (1 + result.occurrenceCount * 0.65);
  return Math.max(0.01, recencyPenalty * repetitionPenalty);
}

/** A deterministic weighted selection. `null` is intentional: an empty
 * narrative week is safer than showing an impossible story. */
export function selectWeightedEligibleEvent(events: GameEventDefinition[], state: EventEligibilityState, rng: RNG): GameEventDefinition | null {
  const weighted = events
    .map((event) => ({ event, result: isEventEligible(event, state) }))
    .filter((candidate) => candidate.result.eligible)
    .map((candidate) => ({ ...candidate, weight: eventSelectionWeight(candidate.event, state, candidate.result) }))
    .filter((candidate) => candidate.weight > 0);
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const candidate of weighted) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.event;
  }
  return weighted[weighted.length - 1]?.event ?? null;
}

// -----------------------------------------------------------------------------
// Backwards-compatible helpers. Existing integrations can keep passing a
// compact context; the real weekly game flow uses isEventEligible above.
// -----------------------------------------------------------------------------

export interface EventEngineContext {
  player: Player;
  stage: CareerStage;
  week: number;
  coachRelationship: number;
  fame: number;
  tags: Set<string>;
  firedAt: Map<string, number>;
  firedOnce: Set<string>;
  firedCount?: Map<string, number>;
}

function legacyState(ctx: EventEngineContext): EventEligibilityState {
  return {
    player: { ...ctx.player, attributes: { ...ctx.player.attributes, general: { ...ctx.player.attributes.general, fame: ctx.fame } } },
    stage: ctx.stage,
    year: 0,
    weekInSeason: ctx.week,
    totalWeek: ctx.week,
    careerSeasonsPlayed: 0,
    statHistory: [],
    currentSeasonGameStats: [],
    relationships: [{ id: "legacy_coach", name: "Coach", type: "coach", value: ctx.coachRelationship, tags: [], history: [] }],
    tags: [...ctx.tags],
    eventMemory: { firedAt: [...ctx.firedAt.entries()], firedOnce: [...ctx.firedOnce], firedCount: [...(ctx.firedCount ?? new Map()).entries()] },
    decisionHistory: [],
    achievements: [],
    retired: false,
  };
}

export function isEligible(def: GameEventDefinition, ctx: EventEngineContext): boolean {
  return isEventEligible(def, legacyState(ctx)).eligible;
}

export function rollEligibleEvents(allEvents: GameEventDefinition[], ctx: EventEngineContext, rng: RNG, category?: GameEventDefinition["category"]): GameEventDefinition[] {
  const state = legacyState(ctx);
  return (category ? allEvents.filter((event) => event.category === category) : allEvents)
    .filter((event) => {
      const result = isEventEligible(event, state);
      return result.eligible && rng.chance(result.probability);
    });
}

export function selectWeeklyEvents(candidates: GameEventDefinition[], rng: RNG, max = 1): GameEventDefinition[] {
  return candidates.length <= max ? candidates : rng.shuffle(candidates).slice(0, max);
}

export function markFired(ctx: Pick<EventEngineContext, "firedAt" | "firedOnce" | "firedCount" | "week">, def: GameEventDefinition): void {
  ctx.firedAt.set(def.id, ctx.week);
  ctx.firedOnce.add(def.id);
  if (ctx.firedCount) ctx.firedCount.set(def.id, (ctx.firedCount.get(def.id) ?? 0) + 1);
}

export function createEmptyEventMemory(): { firedAt: Map<string, number>; firedOnce: Set<string>; firedCount: Map<string, number> } {
  return { firedAt: new Map(), firedOnce: new Set(), firedCount: new Map() };
}

export function positionMatches(positions: Position[] | undefined, position: Position): boolean {
  return !positions || positions.includes(position);
}
