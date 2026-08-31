import { applyBuildEffects, applyPointBuy, computeOverall, generateInitialAttributes, recommendedPointBuyAllocations } from "./attributes";
import { applySeasonalAging, applyTraining, type TrainingFocus } from "./aging";
import { generateFreeAgencyOffers } from "./contracts";
import { rollForInjury } from "./injury";
import { computeLegacy } from "./legacy";
import { RNG, clamp } from "./rng";
import { emptyStatLine, type Attributes, type Position, type StatLine } from "./types";

/**
 * Fast deterministic balance projection. It deliberately uses the same
 * attribute, training, aging, injury, contract and legacy rules as a career,
 * while resolving a season in aggregate instead of rendering hundreds of game
 * cards. This keeps a 1,000-career regression test practical in CI.
 */
export type BalanceStrategy = "balanced" | "grind" | "recovery";

export interface BalanceCohortOptions {
  size?: number;
  seed?: number;
  strategy?: BalanceStrategy;
}

export interface BalanceCohortReport {
  careers: number;
  averageNFLSeasons: number;
  averagePeakOverall: number;
  maxPeakOverall: number;
  injuryCareerRate: number;
  averageInjuries: number;
  averageBestOffer: number;
  championships: number;
  hallOfFameRate: number;
}

const COHORT_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "LB", "CB"];

export function runBalanceCohort(options: BalanceCohortOptions = {}): BalanceCohortReport {
  const size = options.size ?? 1_000;
  const rng = new RNG(options.seed ?? 20_260_831);
  const strategy = options.strategy ?? "balanced";
  let nflSeasons = 0;
  let peakOverallSum = 0;
  let maxPeakOverall = 0;
  let injuryCareers = 0;
  let injuries = 0;
  let bestOfferSum = 0;
  let championships = 0;
  let hallOfFamers = 0;

  for (let i = 0; i < size; i++) {
    const outcome = projectCareer(rng, COHORT_POSITIONS[i % COHORT_POSITIONS.length], strategy, i);
    nflSeasons += outcome.nflSeasons;
    peakOverallSum += outcome.peakOverall;
    maxPeakOverall = Math.max(maxPeakOverall, outcome.peakOverall);
    injuries += outcome.injuries;
    if (outcome.injuries > 0) injuryCareers++;
    bestOfferSum += outcome.bestOffer;
    championships += outcome.championships;
    if (outcome.hallOfFame) hallOfFamers++;
  }

  return {
    careers: size,
    averageNFLSeasons: round(nflSeasons / size),
    averagePeakOverall: round(peakOverallSum / size),
    maxPeakOverall,
    injuryCareerRate: round(injuryCareers / size),
    averageInjuries: round(injuries / size),
    averageBestOffer: Math.round(bestOfferSum / size),
    championships,
    hallOfFameRate: round(hallOfFamers / size),
  };
}

function projectCareer(rng: RNG, position: Position, strategy: BalanceStrategy, careerIndex: number) {
  let attributes = applyBuildEffects(
    applyPointBuy(generateInitialAttributes(position, rng.next(), rng), position, recommendedPointBuyAllocations(position)),
    72,
    205
  );
  let peakOverall = computeOverall(attributes, position);
  let workload = 0;
  let riskModifier = 0;
  let injuries = 0;
  let bestOffer = 0;
  let championships = 0;
  const nflStats: StatLine[] = [];
  let fame = 5;
  let nflSeasons = 0;

  // Four development seasons before draft eligibility. Aggregate weeks retain
  // the same practice/aging curve without pretending to be a full play-by-play
  // career simulation.
  for (let age = 15; age < 21; age++) {
    ({ attributes, workload, riskModifier } = projectSeason(attributes, position, age, 1, strategy, workload, riskModifier, rng, false));
    peakOverall = Math.max(peakOverall, computeOverall(attributes, position));
  }

  for (let age = 21; age <= 39; age++) {
    const season = projectSeason(attributes, position, age, 1, strategy, workload, riskModifier, rng, true);
    attributes = season.attributes;
    workload = season.workload;
    riskModifier = season.riskModifier;
    injuries += season.injuries;
    const overall = computeOverall(attributes, position);
    peakOverall = Math.max(peakOverall, overall);

    // Below replacement level or after heavy late-career wear, retirement is
    // possible. Talent still matters: good players last longer, chance alone
    // cannot carry every career.
    const retirementChance = age < 25 ? 0 : clamp((age - 28) * 0.055 + Math.max(0, 62 - overall) * 0.012 + season.missedGames * 0.008, 0, 0.88);
    if (nflSeasons >= 2 && rng.chance(retirementChance)) break;

    nflSeasons++;
    fame = clamp(fame + Math.max(0, overall - 58) * 0.12 + season.gamesPlayed * 0.04, 0, 100);
    const offer = generateFreeAgencyOffers(overall, fame, age, 2026 + age - 21, rng, 1)[0];
    bestOffer = Math.max(bestOffer, offer.contract.totalValue);
    const championshipWon = rng.chance(clamp(offer.championshipProbability * (0.16 + overall / 800), 0.005, 0.2));
    if (championshipWon) championships++;
    nflStats.push(makeSeasonStat(position, careerIndex, age, overall, season.gamesPlayed, championshipWon));
  }

  const legacy = computeLegacy({
    seasonStats: nflStats,
    careerEarnings: bestOffer * Math.max(1, nflSeasons) * 0.55,
    netWorth: bestOffer * 0.2,
    draftedRound: peakOverall >= 78 ? 1 : peakOverall >= 65 ? 3 : 6,
    seasonsPlayed: nflSeasons,
  });

  return { nflSeasons, peakOverall, injuries, bestOffer, championships, hallOfFame: legacy.tier === "hall_of_fame" };
}

function projectSeason(
  start: Attributes,
  position: Position,
  age: number,
  developmentRate: number,
  strategy: BalanceStrategy,
  startWorkload: number,
  startRiskModifier: number,
  rng: RNG,
  isNFL: boolean
) {
  let attributes = start;
  let workload = startWorkload;
  let riskModifier = startRiskModifier;
  let injuries = 0;
  let missedGames = 0;
  let gamesPlayed = 0;
  let recoveryWeeks = 0;
  const positionPaths = Object.keys(attributes.position[position] as object).map((key) => `position.${position}.${key}`);

  // One twelve-week aggregate applies the exact training rule to a full
  // season's investment. The focus rotation changes from season to season,
  // which keeps the 1,000-career regression run practical in CI.
  const focus = focusFor(strategy, age);
  const intensity = focus === "recovery" ? 1 : 12;
  const result = applyTraining(attributes, focus, intensity, developmentRate, rng, positionPaths);
  attributes = result.attributes;
  workload = clamp(workload + result.fatigueDelta, 0, 100);
  riskModifier = clamp((riskModifier + result.injuryRiskDelta) * 0.7, -0.15, 0.35);

  if (isNFL) {
    for (let week = 0; week < 17; week++) {
      if (recoveryWeeks > 0) {
        recoveryWeeks--;
        missedGames++;
      } else {
        gamesPlayed++;
        const injury = rollForInjury(week, attributes.physical.durability, attributes.general.discipline, rng, clamp(1 + workload * 0.005 + riskModifier, 0.7, 1.85));
        if (injury) {
          injuries++;
          recoveryWeeks = Math.max(0, injury.recoveryWeeks - 1);
        }
      }
    }
    workload = clamp(workload - 17 * 2, 0, 100);
    riskModifier = clamp(riskModifier * 0.5, -0.15, 0.35);
  }

  const aged = applySeasonalAging(attributes, age, Math.max(0, age - 21));
  return { attributes: aged.attributes, workload: clamp(workload - (isNFL ? 0 : 24), 0, 100), riskModifier, injuries, missedGames, gamesPlayed };
}

function focusFor(strategy: BalanceStrategy, week: number): TrainingFocus {
  if (strategy === "grind") return "position_specific";
  if (strategy === "recovery") return week % 2 === 0 ? "recovery" : "mental";
  return week % 3 === 2 ? "recovery" : week % 3 === 1 ? "mental" : "position_specific";
}

function makeSeasonStat(position: Position, careerIndex: number, age: number, overall: number, gamesPlayed: number, championshipWon: boolean): StatLine {
  const output = clamp((overall - 48) / 42, 0.05, 1.1);
  const line = emptyStatLine(2026 + age - 21, "nfl", `cohort_${careerIndex}`);
  line.gamesPlayed = gamesPlayed;
  line.gamesStarted = gamesPlayed;
  line.championshipWon = championshipWon;
  // A cohort uses stricter honor thresholds than a raw per-game projection so
  // excellent careers are possible without every solid starter becoming a
  // Hall-of-Famer by volume alone.
  line.proBowl = overall >= 86 && gamesPlayed >= 13 && ((careerIndex + age) % 3 === 0);
  line.allPro = overall >= 92 && gamesPlayed >= 14 && ((careerIndex + age) % 5 === 0);
  line.mvp = position === "QB" && overall >= 96 && gamesPlayed >= 15 && ((careerIndex + age) % 7 === 0);
  if (position === "QB") {
    line.passAttempts = Math.round(gamesPlayed * 28);
    line.passCompletions = Math.round(line.passAttempts * (0.52 + output * 0.18));
    line.passYards = Math.round(gamesPlayed * (150 + output * 140));
    line.passTDs = Math.round(gamesPlayed * output * 2.1);
  } else if (position === "RB") {
    line.rushAttempts = Math.round(gamesPlayed * 12);
    line.rushYards = Math.round(gamesPlayed * (35 + output * 65));
    line.rushTDs = Math.round(gamesPlayed * output * 0.75);
  } else if (position === "WR" || position === "TE") {
    line.receptions = Math.round(gamesPlayed * (2 + output * 4.5));
    line.receivingYards = Math.round(gamesPlayed * (25 + output * 58));
    line.receivingTDs = Math.round(gamesPlayed * output * 0.65);
  } else {
    line.tackles = Math.round(gamesPlayed * (2 + output * 6));
  }
  return line;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
