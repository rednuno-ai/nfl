import type { Injury, InjurySeverity } from "./types";
import { RNG, clamp } from "./rng";

// =============================================================================
// Injury system: probability, severity, recovery, and reinjury risk.
// =============================================================================

interface InjuryTemplate {
  type: string;
  severity: InjurySeverity;
  weightedChance: number; // relative weight among injuries once one occurs
  recoveryWeeksRange: [number, number];
  performancePenaltyRange: [number, number];
  reinjuryRiskRange: [number, number];
}

const INJURY_TEMPLATES: InjuryTemplate[] = [
  { type: "Ankle sprain", severity: "minor", weightedChance: 30, recoveryWeeksRange: [1, 2], performancePenaltyRange: [0.05, 0.15], reinjuryRiskRange: [0.05, 0.1] },
  { type: "Bruised shoulder", severity: "minor", weightedChance: 20, recoveryWeeksRange: [1, 2], performancePenaltyRange: [0.05, 0.1], reinjuryRiskRange: [0.03, 0.08] },
  { type: "Hamstring strain", severity: "moderate", weightedChance: 18, recoveryWeeksRange: [2, 5], performancePenaltyRange: [0.15, 0.3], reinjuryRiskRange: [0.1, 0.2] },
  { type: "High ankle sprain", severity: "moderate", weightedChance: 12, recoveryWeeksRange: [3, 6], performancePenaltyRange: [0.15, 0.3], reinjuryRiskRange: [0.1, 0.18] },
  { type: "Fractured hand", severity: "moderate", weightedChance: 8, recoveryWeeksRange: [3, 6], performancePenaltyRange: [0.1, 0.25], reinjuryRiskRange: [0.05, 0.1] },
  { type: "Broken collarbone", severity: "severe", weightedChance: 6, recoveryWeeksRange: [6, 10], performancePenaltyRange: [0.3, 0.45], reinjuryRiskRange: [0.12, 0.2] },
  { type: "Torn MCL", severity: "severe", weightedChance: 4, recoveryWeeksRange: [8, 14], performancePenaltyRange: [0.3, 0.5], reinjuryRiskRange: [0.15, 0.25] },
  { type: "Torn ACL", severity: "career_threatening", weightedChance: 1.5, recoveryWeeksRange: [40, 52], performancePenaltyRange: [0.4, 0.6], reinjuryRiskRange: [0.2, 0.35] },
  { type: "Achilles rupture", severity: "career_threatening", weightedChance: 0.5, recoveryWeeksRange: [45, 60], performancePenaltyRange: [0.45, 0.65], reinjuryRiskRange: [0.25, 0.4] },
];

/** Base weekly injury probability given durability (0-100) and a context
 *  multiplier (e.g., higher during physical training, playoffs, playing hurt). */
export function baseInjuryProbability(durability: number, discipline: number, contextMultiplier = 1): number {
  const durabilityFactor = 1 - durability / 140; // higher durability = lower risk
  const disciplineFactor = 1 - discipline / 400; // small effect: undisciplined players take more risks
  // This is a per-game/week *incident* chance, not the chance that an
  // athlete ever carries a knock in a whole career. The previous 2% base
  // compounded into a near-certain injury for every generated career and
  // made recovery choices feel cosmetic. Durability and discipline still
  // meaningfully differentiate the rate through the two factors below.
  const base = 0.0035 * (0.6 + durabilityFactor) * (0.85 + disciplineFactor);
  return clamp(base * contextMultiplier, 0.002, 0.5);
}

export function rollForInjury(week: number, durability: number, discipline: number, rng: RNG, contextMultiplier = 1): Injury | null {
  const prob = baseInjuryProbability(durability, discipline, contextMultiplier);
  if (!rng.chance(prob)) return null;

  const template = rng.weighted(INJURY_TEMPLATES.map((t) => ({ item: t, weight: t.weightedChance })));
  const recoveryWeeks = rng.int(template.recoveryWeeksRange[0], template.recoveryWeeksRange[1]);
  const performancePenalty = template.performancePenaltyRange[0] + rng.next() * (template.performancePenaltyRange[1] - template.performancePenaltyRange[0]);
  const reinjuryRisk = template.reinjuryRiskRange[0] + rng.next() * (template.reinjuryRiskRange[1] - template.reinjuryRiskRange[0]);

  return {
    id: `injury_${week}_${Math.round(rng.next() * 1e6)}`,
    type: template.type,
    severity: template.severity,
    weekOccurred: week,
    recoveryWeeks,
    weeksRemaining: recoveryWeeks,
    performancePenalty,
    reinjuryRisk,
    playedThrough: false,
  };
}

export function tickInjuryRecovery(injury: Injury, playedThroughThisWeek: boolean, rng: RNG): { injury: Injury | null; setback: boolean } {
  let weeksRemaining = injury.weeksRemaining - 1;
  let setback = false;

  if (playedThroughThisWeek && rng.chance(injury.reinjuryRisk)) {
    weeksRemaining += Math.round(injury.recoveryWeeks * 0.5);
    setback = true;
  }

  if (weeksRemaining <= 0) {
    return { injury: null, setback };
  }

  return { injury: { ...injury, weeksRemaining, playedThrough: injury.playedThrough || playedThroughThisWeek }, setback };
}

export function injuryTagFor(severity: InjurySeverity): string {
  return `has_active_injury_${severity}`;
}
