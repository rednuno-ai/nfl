import type { CombineScores, DraftProjection, DraftResult, Player } from "./types";
import { computeOverall } from "./attributes";
import { TEAMS } from "./teams";
import { RNG, clamp } from "./rng";

// =============================================================================
// NFL Draft system: projection, combine, and the draft-night resolution.
// No real team names are used — see teams.ts for the fictional league.
// =============================================================================

export function generateCombineScores(player: Player, rng: RNG): CombineScores {
  const { physical } = player.attributes;
  const speedFactor = physical.speed / 100;
  const strengthFactor = physical.strength / 100;

  return {
    fortyYardDash: Math.round((5.2 - speedFactor * 1.3 + rng.gaussian() * 0.05) * 100) / 100,
    verticalJump: Math.round(24 + physical.acceleration / 100 * 20 + rng.gaussian() * 1.5),
    broadJump: Math.round(96 + physical.acceleration / 100 * 30 + rng.gaussian() * 2),
    benchPressReps: Math.round(12 + strengthFactor * 22 + rng.gaussian() * 2),
    threeCone: Math.round((7.6 - physical.agility / 100 * 1.2 + rng.gaussian() * 0.05) * 100) / 100,
    interviewScore: Math.round(clamp(50 + player.attributes.mental.decisionMaking / 2 + rng.gaussian() * 8, 20, 99)),
  };
}

export function generateDraftProjection(player: Player, rng: RNG, combine?: CombineScores): DraftProjection {
  const overall = computeOverall(player.attributes, player.position);
  const potential = player.attributes.general.potential;
  const composite = overall * 0.65 + potential * 0.25 + player.attributes.general.fame * 0.1;

  // Map composite score (roughly 20-99) onto round projections 1-7.
  const roundCenter = clamp(7.5 - (composite - 20) / 12, 1, 7.5);
  const projectedRoundLow = Math.max(1, Math.floor(roundCenter - 1));
  const projectedRoundHigh = Math.min(7, Math.ceil(roundCenter + 1));

  const stock = clamp(composite + (combine ? (combine.interviewScore - 50) / 10 : 0) + rng.gaussian() * 4, 5, 99);

  const interestedTeamIds = rng
    .shuffle(TEAMS)
    .slice(0, 3 + Math.floor(rng.next() * 5))
    .map((t) => t.id);

  return {
    projectedRoundLow,
    projectedRoundHigh,
    stock: Math.round(stock),
    interestedTeamIds,
    combineScores: combine,
  };
}

/** Resolves the actual draft outcome. Higher stock = earlier/likelier pick;
 *  there's always a chance of falling (or going undrafted) to keep drama. */
export function resolveDraft(projection: DraftProjection, year: number, rng: RNG): DraftResult {
  const stockRoll = clamp(projection.stock + rng.gaussian() * 12, 0, 100);

  if (stockRoll < 12) {
    return { year, round: 0, pick: 0, teamId: null };
  }

  // Map stock roll (12-100) onto overall pick 1-224 (32 teams x 7 rounds).
  // Keep this in sync with the /32 below — a wider pick range with the round
  // still clamped to 7 used to let picks past 224 report a round number that
  // didn't actually match their own pick number (e.g. "Round 7, Pick 231").
  const overallPick = Math.max(1, Math.round(224 - (stockRoll / 100) * 224));
  const round = Math.min(7, Math.max(1, Math.ceil(overallPick / 32)));
  const teamPool = projection.interestedTeamIds.length > 0 ? projection.interestedTeamIds : TEAMS.map((t) => t.id);
  const teamId = rng.pick(teamPool);

  return { year, round, pick: overallPick, teamId };
}

export function rookieContractValue(round: number, pick: number): { years: number; totalValue: number; signingBonus: number } {
  if (round === 0) {
    return { years: 1, totalValue: 750_000, signingBonus: 5_000 }; // undrafted free agent deal
  }
  const overallPick = pick || round * 32;
  const scale = clamp(1 - overallPick / 300, 0.05, 1);
  const totalValue = Math.round(900_000 + scale * 39_000_000);
  const years = round <= 3 ? 4 : 3;
  const signingBonus = Math.round(totalValue * (0.3 + scale * 0.4));
  return { years, totalValue, signingBonus };
}
