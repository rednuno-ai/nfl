import type { CareerStage, EventCondition, GameEventDefinition, Player, Position } from "../types";
import { getAttributeByPath } from "../attributes";
import type { RNG } from "../rng";

// =============================================================================
// Data-driven Event Engine
// -----------------------------------------------------------------------------
// Events are DATA (see events/data/*.ts), not hardcoded UI flows. This module
// only knows how to evaluate `EventCondition`s against a context and select
// eligible events. Adding new story content never requires touching this file.
// =============================================================================

export interface EventEngineContext {
  player: Player;
  stage: CareerStage;
  week: number;
  coachRelationship: number; // 0-100
  fame: number; // mirrors player.attributes.general.fame, kept explicit for readability
  tags: Set<string>; // accumulated narrative/world tags (relationship tags, past choices, injuries, etc.)
  firedAt: Map<string, number>; // eventId -> last week fired
  firedOnce: Set<string>; // eventId set that have fired at least once
}

export function isEligible(def: GameEventDefinition, ctx: EventEngineContext): boolean {
  const c: EventCondition = def.conditions;

  if (def.once && ctx.firedOnce.has(def.id)) return false;

  const lastFired = ctx.firedAt.get(def.id);
  if (lastFired !== undefined && ctx.week - lastFired < def.cooldownWeeks) return false;

  if (c.stage && !c.stage.includes(ctx.stage)) return false;
  if (c.minAge !== undefined && ctx.player.bio.age < c.minAge) return false;
  if (c.maxAge !== undefined && ctx.player.bio.age > c.maxAge) return false;
  if (c.positions && !c.positions.includes(ctx.player.position)) return false;
  if (c.personalityAny && !c.personalityAny.some((trait) => ctx.player.personality.includes(trait))) return false;
  if (c.personalityAll && !c.personalityAll.every((trait) => ctx.player.personality.includes(trait))) return false;

  if (c.minAttribute) {
    const val = getAttributeByPath(ctx.player.attributes, c.minAttribute.path);
    if (val < c.minAttribute.value) return false;
  }
  if (c.maxAttribute) {
    const val = getAttributeByPath(ctx.player.attributes, c.maxAttribute.path);
    if (val > c.maxAttribute.value) return false;
  }

  if (c.minCoachRelationship !== undefined && ctx.coachRelationship < c.minCoachRelationship) return false;
  if (c.maxCoachRelationship !== undefined && ctx.coachRelationship > c.maxCoachRelationship) return false;
  if (c.minFame !== undefined && ctx.fame < c.minFame) return false;
  if (c.maxFame !== undefined && ctx.fame > c.maxFame) return false;

  if (c.tagsPresent && !c.tagsPresent.every((t) => ctx.tags.has(t))) return false;
  if (c.tagsAbsent && c.tagsAbsent.some((t) => ctx.tags.has(t))) return false;

  return true;
}

/** Returns eligible events with their base probability roll already applied
 *  (an event with probability 0.3 has a 30% chance to be *considered* this
 *  call; conditions still gate eligibility separately). */
export function rollEligibleEvents(
  allEvents: GameEventDefinition[],
  ctx: EventEngineContext,
  rng: RNG,
  category?: GameEventDefinition["category"]
): GameEventDefinition[] {
  const pool = category ? allEvents.filter((e) => e.category === category) : allEvents;
  const eligible = pool.filter((e) => isEligible(e, ctx));
  return eligible.filter((e) => rng.chance(e.conditions.probability ?? 0.35));
}

/** Picks at most `max` events from the eligible pool for a single week, to
 *  avoid overwhelming the player with simultaneous decisions. */
export function selectWeeklyEvents(candidates: GameEventDefinition[], rng: RNG, max = 1): GameEventDefinition[] {
  if (candidates.length <= max) return candidates;
  const shuffled = rng.shuffle(candidates);
  return shuffled.slice(0, max);
}

export function markFired(ctx: EventEngineContext, def: GameEventDefinition): void {
  ctx.firedAt.set(def.id, ctx.week);
  ctx.firedOnce.add(def.id);
}

/** Convenience: build a fresh, empty engine context bucket for a new career. */
export function createEmptyEventMemory(): { firedAt: Map<string, number>; firedOnce: Set<string> } {
  return { firedAt: new Map(), firedOnce: new Set() };
}

export function positionMatches(positions: Position[] | undefined, position: Position): boolean {
  return !positions || positions.includes(position);
}
