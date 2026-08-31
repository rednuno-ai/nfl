import type { Attributes } from "./types";
import { applyAttributeDelta, applyAttributeDeltas } from "./attributes";
import { clamp, RNG } from "./rng";

// =============================================================================
// Aging & Training
// -----------------------------------------------------------------------------
// Applied once per in-game season (not per week) to keep the curve legible:
// physical attributes rise through the early 20s, plateau, then decline;
// mental attributes (football IQ, composure, decision making) keep climbing
// into the 30s from experience; durability erodes with accumulated wear.
// =============================================================================

export interface AgingResult {
  attributes: Attributes;
  notes: string[];
}

export function applySeasonalAging(attrs: Attributes, age: number, seasonsPlayed: number): AgingResult {
  const notes: string[] = [];
  let next = attrs;

  // Physical development curve: rises to peak ~26, plateaus to ~29, declines after.
  let physicalDelta = 0;
  if (age <= 21) physicalDelta = 1.5;
  else if (age <= 25) physicalDelta = 1.0;
  else if (age <= 28) physicalDelta = 0.1;
  else if (age <= 31) physicalDelta = -1.2;
  else if (age <= 34) physicalDelta = -2.4;
  else physicalDelta = -3.6;

  if (physicalDelta !== 0) {
    next = applyAttributeDeltas(next, [
      { path: "physical.speed", delta: physicalDelta },
      { path: "physical.acceleration", delta: physicalDelta * 0.9 },
      { path: "physical.agility", delta: physicalDelta * 0.8 },
      { path: "physical.strength", delta: physicalDelta * 0.6 },
      { path: "physical.stamina", delta: physicalDelta * 0.7 },
    ]);
    if (physicalDelta < -2) notes.push("Age is visibly catching up with your physical tools.");
    else if (physicalDelta > 1) notes.push("You're still developing physically — gains came easily this year.");
  }

  // Mental development: climbs steadily with experience, small ceiling near 33+.
  const mentalDelta = age <= 32 ? clamp(2.2 - seasonsPlayed * 0.05, 0.3, 2.2) : 0.2;
  next = applyAttributeDeltas(next, [
    { path: "mental.footballIQ", delta: mentalDelta },
    { path: "mental.decisionMaking", delta: mentalDelta * 0.8 },
    { path: "mental.composure", delta: mentalDelta * 0.7 },
  ]);

  // Durability erodes slowly with accumulated seasons (wear and tear).
  if (seasonsPlayed > 0) {
    next = applyAttributeDelta(next, "physical.durability", -0.6 - seasonsPlayed * 0.05);
  }

  return { attributes: next, notes };
}

export type TrainingFocus = "strength" | "speed" | "technique" | "recovery" | "mental" | "position_specific";

export interface TrainingResult {
  attributes: Attributes;
  fatigueDelta: number;
  injuryRiskDelta: number;
  moraleDelta: number;
}

/**
 * Training should remain useful throughout a career without becoming an
 * infinite, single-button progression loop. Potential is a soft ceiling, not
 * a hard cap: a player can still have a breakout, but a skill already well
 * ahead of their projected ceiling improves much more slowly.
 */
export function trainingGrowthMultiplier(potential: number, currentValue: number): number {
  const softCeiling = clamp(potential + 15, 45, 100);
  return clamp((softCeiling - currentValue + 12) / 42, 0.12, 1);
}

const TRAINING_TARGETS: Record<TrainingFocus, { path: string; weight: number }[]> = {
  strength: [
    { path: "physical.strength", weight: 1 },
    { path: "physical.durability", weight: 0.3 },
  ],
  speed: [
    { path: "physical.speed", weight: 1 },
    { path: "physical.acceleration", weight: 0.7 },
  ],
  technique: [
    { path: "mental.footballIQ", weight: 0.5 },
    { path: "physical.agility", weight: 0.5 },
  ],
  recovery: [{ path: "physical.stamina", weight: 0.6 }],
  mental: [
    { path: "mental.decisionMaking", weight: 0.7 },
    { path: "mental.composure", weight: 0.7 },
    { path: "mental.pressure", weight: 0.6 },
  ],
  position_specific: [], // resolved by caller with the player's position block
};

/** Trains one focus area for a week. `intensity` in [0.5, 1.5] lets coaching
 *  quality / player choice scale gains and risk. `positionPaths` supplies the
 *  position-specific attribute paths when focus === "position_specific". */
export function applyTraining(
  attrs: Attributes,
  focus: TrainingFocus,
  intensity: number,
  developmentRate: number,
  rng: RNG,
  positionPaths: string[] = []
): TrainingResult {
  const targets = focus === "position_specific" ? positionPaths.map((path) => ({ path, weight: 1 })) : TRAINING_TARGETS[focus];

  const baseGain = 0.6 * developmentRate * intensity;
  let next = attrs;
  for (const target of targets) {
    const currentValue = getAttributeValue(next, target.path);
    const gain = baseGain * target.weight * (0.7 + rng.next() * 0.6) * trainingGrowthMultiplier(attrs.general.potential, currentValue);
    next = applyAttributeDelta(next, target.path, gain);
  }

  const isRecovery = focus === "recovery";
  const fatigueDelta = isRecovery ? -18 : 10 * intensity;
  const injuryRiskDelta = isRecovery ? -0.02 : 0.015 * intensity;
  const moraleDelta = isRecovery ? 4 : focus === "mental" ? 1 : 0.5;

  return { attributes: next, fatigueDelta, injuryRiskDelta, moraleDelta };
}

function getAttributeValue(attrs: Attributes, path: string): number {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : 0), attrs) as number;
}
