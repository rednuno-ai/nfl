import { applyBuildEffects, applyPointBuy, computeOverall, generateInitialAttributes, recommendedPointBuyAllocations } from "./attributes";
import { applySeasonalAging, applyTraining, type TrainingFocus } from "./aging";
import { generateFreeAgencyOffers, type FreeAgencyOffer } from "./contracts";
import { rollForInjury } from "./injury";
import { computeLegacy } from "./legacy";
import { evaluateSeasonAwards } from "./career";
import { RNG, clamp } from "./rng";
import { ALL_POSITIONS, emptyStatLine, type Attributes, type InjurySeverity, type LegacyTier, type Position, type StatLine } from "./types";

/**
 * Deterministic career-balance projection. It reuses the production attribute,
 * training, ageing, injury, contract and legacy rules, but resolves seasons in
 * aggregate. It is local QA only: no storage, network or analytics code.
 */
export type BalanceStrategy = "balanced" | "grind" | "recovery";
export type CareerEndReason = "age_limit" | "performance_decline" | "injury_forced_retirement";

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

export interface CareerSimulationOptions {
  /** Baseline careers for every position. Default: 1,000 (11,000 total). */
  careersPerPosition?: number;
  /** Counterfactual careers for every strategy and position. Default: 250. */
  strategyCareersPerPosition?: number;
  /** Stable seed: the same options always yield the same report. */
  seed?: number;
}

export interface InjurySummary {
  total: number;
  minor: number;
  moderate: number;
  severe: number;
  careerThreatening: number;
}

export interface AwardSummary {
  proBowls: number;
  allPros: number;
  mvps: number;
}

export interface PositionSimulationSummary {
  position: Position;
  careers: number;
  averageNFLSeasons: number;
  averagePeakOverall: number;
  maxPeakOverall: number;
  injuryCareerRate: number;
  injuries: InjurySummary;
  averageContracts: number;
  averageContractValue: number;
  championships: number;
  awards: AwardSummary;
  /** Pro Bowl, All-Pro and MVP selections per 100 simulated NFL seasons.
   * This permits like-for-like comparison even when position cohorts have
   * slightly different career lengths. */
  awardSelectionsPer100Seasons: number;
  hallOfFamers: number;
  endReasons: Record<CareerEndReason, number>;
}

export interface StrategySimulationSummary {
  strategy: BalanceStrategy;
  careers: number;
  averageNFLSeasons: number;
  averagePeakOverall: number;
  injuryCareerRate: number;
  averageInjuries: number;
  championshipsPer100Careers: number;
  hallOfFameRate: number;
  averageContractValue: number;
}

export interface SimulationFinding {
  id: string;
  severity: "pass" | "warning" | "failure";
  message: string;
}

export interface CareerSimulationReport {
  seed: number;
  baselineCareers: number;
  strategyComparisonCareers: number;
  totalCareers: number;
  positions: PositionSimulationSummary[];
  strategies: StrategySimulationSummary[];
  positionAuditFindings: SimulationFinding[];
  dominantStrategyFindings: SimulationFinding[];
  impossibleResultFindings: SimulationFinding[];
}

interface ProjectedCareer {
  seed: number;
  position: Position;
  strategy: BalanceStrategy;
  nflSeasons: number;
  peakOverall: number;
  injuries: InjurySummary;
  contracts: number;
  contractValue: number;
  bestOffer: number;
  championships: number;
  awards: AwardSummary;
  legacyTier: LegacyTier;
  endReason: CareerEndReason;
}

const COHORT_POSITIONS = ALL_POSITIONS;
const STRATEGIES: BalanceStrategy[] = ["balanced", "grind", "recovery"];
const EMPTY_INJURIES = (): InjurySummary => ({ total: 0, minor: 0, moderate: 0, severe: 0, careerThreatening: 0 });
const EMPTY_AWARDS = (): AwardSummary => ({ proBowls: 0, allPros: 0, mvps: 0 });

/** Maintains the small, fast cohort used by the normal test suite. */
export function runBalanceCohort(options: BalanceCohortOptions = {}): BalanceCohortReport {
  const size = options.size ?? 1_000;
  const seed = options.seed ?? 20_260_831;
  const strategy = options.strategy ?? "balanced";
  const outcomes = Array.from(
    { length: size },
    (_, index) => projectCareer(deriveSeed(seed, index), COHORT_POSITIONS[index % COHORT_POSITIONS.length], strategy, index)
  );
  const summary = summarizeOutcomes(outcomes);
  return {
    careers: size,
    averageNFLSeasons: summary.averageNFLSeasons,
    averagePeakOverall: summary.averagePeakOverall,
    maxPeakOverall: summary.maxPeakOverall,
    injuryCareerRate: summary.injuryCareerRate,
    averageInjuries: round(summary.injuries.total / size),
    averageBestOffer: Math.round(outcomes.reduce((sum, outcome) => sum + outcome.bestOffer, 0) / size),
    championships: summary.championships,
    hallOfFameRate: round(summary.hallOfFamers / size),
  };
}

/**
 * Default run: 11,000 baseline careers across all positions plus 8,250
 * strategy counterfactuals. The values never leave the process.
 */
export function runCareerSimulation(options: CareerSimulationOptions = {}): CareerSimulationReport {
  const seed = options.seed ?? 20_260_901;
  const careersPerPosition = options.careersPerPosition ?? 1_000;
  const strategyCareersPerPosition = options.strategyCareersPerPosition ?? 250;
  if (!Number.isInteger(careersPerPosition) || careersPerPosition < 1) throw new Error("careersPerPosition must be a positive integer.");
  if (!Number.isInteger(strategyCareersPerPosition) || strategyCareersPerPosition < 1) throw new Error("strategyCareersPerPosition must be a positive integer.");

  const baseline = COHORT_POSITIONS.flatMap((position, positionIndex) =>
    Array.from({ length: careersPerPosition }, (_, careerIndex) =>
      projectCareer(deriveSeed(seed, positionIndex * careersPerPosition + careerIndex), position, "balanced", careerIndex)
    )
  );
  const comparisonStart = baseline.length;
  const comparison = STRATEGIES.flatMap((strategy, strategyIndex) =>
    COHORT_POSITIONS.flatMap((position, positionIndex) =>
      Array.from({ length: strategyCareersPerPosition }, (_, careerIndex) => {
        const index = comparisonStart + strategyIndex * COHORT_POSITIONS.length * strategyCareersPerPosition + positionIndex * strategyCareersPerPosition + careerIndex;
        return projectCareer(deriveSeed(seed, index), position, strategy, careerIndex);
      })
    )
  );
  const positions = COHORT_POSITIONS.map((position) => summarizePosition(position, baseline.filter((outcome) => outcome.position === position)));
  const strategies = STRATEGIES.map((strategy) => summarizeStrategy(strategy, comparison.filter((outcome) => outcome.strategy === strategy)));
  return {
    seed,
    baselineCareers: baseline.length,
    strategyComparisonCareers: comparison.length,
    totalCareers: baseline.length + comparison.length,
    positions,
    strategies,
    positionAuditFindings: auditPositionEquity(positions),
    dominantStrategyFindings: findStrategyTradeoffs(strategies),
    impossibleResultFindings: scanForImpossibleResults([...baseline, ...comparison], positions),
  };
}

function projectCareer(seed: number, position: Position, strategy: BalanceStrategy, careerIndex: number): ProjectedCareer {
  const rng = new RNG(seed);
  let attributes = applyBuildEffects(
    applyPointBuy(generateInitialAttributes(position, rng.next(), rng), position, recommendedPointBuyAllocations(position)),
    72,
    205
  );
  let peakOverall = computeOverall(attributes, position);
  let workload = 0;
  let riskModifier = 0;
  const injuries = EMPTY_INJURIES();
  const awards = EMPTY_AWARDS();
  let bestOffer = 0;
  let championships = 0;
  let contractValue = 0;
  let contracts = 0;
  let activeOffer: FreeAgencyOffer | null = null;
  let contractYearsRemaining = 0;
  const nflStats: StatLine[] = [];
  let fame = 5;
  let nflSeasons = 0;
  let endReason: CareerEndReason = "age_limit";

  for (let age = 15; age < 21; age++) {
    const season = projectSeason(attributes, position, age, 1, strategy, workload, riskModifier, rng, false);
    attributes = season.attributes;
    workload = season.workload;
    riskModifier = season.riskModifier;
    peakOverall = Math.max(peakOverall, computeOverall(attributes, position));
  }

  for (let age = 21; age <= 39; age++) {
    const season = projectSeason(attributes, position, age, 1, strategy, workload, riskModifier, rng, true);
    attributes = season.attributes;
    workload = season.workload;
    riskModifier = season.riskModifier;
    mergeInjuries(injuries, season.injuries);
    const overall = computeOverall(attributes, position);
    peakOverall = Math.max(peakOverall, overall);

    const injuryExitChance = season.injuries.careerThreatening > 0 ? 0.22 + Math.max(0, age - 28) * 0.03 : 0;
    if (nflSeasons >= 2 && rng.chance(clamp(injuryExitChance, 0, 0.65))) {
      endReason = "injury_forced_retirement";
      break;
    }
    const retirementChance = age < 25 ? 0 : clamp((age - 28) * 0.055 + Math.max(0, 62 - overall) * 0.012 + season.missedGames * 0.008, 0, 0.88);
    if (nflSeasons >= 2 && rng.chance(retirementChance)) {
      endReason = "performance_decline";
      break;
    }

    if (!activeOffer || contractYearsRemaining <= 0) {
      activeOffer = chooseOffer(generateFreeAgencyOffers(overall, fame, age, 2026 + age - 21, rng, 4), strategy);
      contracts++;
      contractValue += activeOffer.contract.totalValue;
      bestOffer = Math.max(bestOffer, activeOffer.contract.totalValue);
      contractYearsRemaining = activeOffer.contract.years;
    }
    nflSeasons++;
    fame = clamp(fame + Math.max(0, overall - 58) * 0.12 + season.gamesPlayed * 0.04, 0, 100);
    const championshipWon = rng.chance(clamp(activeOffer.championshipProbability * (0.16 + overall / 800), 0.005, 0.2));
    if (championshipWon) championships++;
    const stat = makeSeasonStat(position, careerIndex, age, overall, season.gamesPlayed, championshipWon);
    nflStats.push(stat);
    awards.proBowls += Number(stat.proBowl);
    awards.allPros += Number(stat.allPro);
    awards.mvps += Number(stat.mvp);
    contractYearsRemaining--;
  }

  const legacy = computeLegacy({
    seasonStats: nflStats,
    careerEarnings: contractValue,
    netWorth: Math.round(contractValue * 0.2),
    draftedRound: peakOverall >= 78 ? 1 : peakOverall >= 65 ? 3 : 6,
    seasonsPlayed: nflSeasons,
  });
  return { seed, position, strategy, nflSeasons, peakOverall, injuries, contracts, contractValue, bestOffer, championships, awards, legacyTier: legacy.tier, endReason };
}

function chooseOffer(offers: FreeAgencyOffer[], strategy: BalanceStrategy): FreeAgencyOffer {
  const score = (offer: FreeAgencyOffer) => {
    if (strategy === "grind") return offer.contract.totalValue + offer.championshipProbability * 4_000_000;
    if (strategy === "recovery") return offer.championshipProbability * 20_000_000 + offer.contract.totalValue * 0.45;
    return offer.contract.totalValue * 0.75 + offer.championshipProbability * 9_000_000;
  };
  return offers.reduce((best, offer) => score(offer) > score(best) ? offer : best);
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
  const injuries = EMPTY_INJURIES();
  let missedGames = 0;
  let gamesPlayed = 0;
  let recoveryWeeks = 0;
  const positionPaths = Object.keys(attributes.position[position] as object).map((key) => "position." + position + "." + key);
  // A season is one weighted practice block for CI speed. It still uses the
  // live training rule and applies the accumulated-load penalty a weekly
  // career would have reached under repeated position work.
  const focus = focusFor(strategy, age);
  const intensity = focus === "recovery" ? 1 : 12;
  const modeledLoad = strategy === "grind" ? Math.max(workload, 70) : workload;
  const result = applyTraining(attributes, focus, intensity, developmentRate, rng, positionPaths, modeledLoad);
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
          addInjury(injuries, injury.severity);
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

function summarizeOutcomes(outcomes: ProjectedCareer[]) {
  const careers = outcomes.length;
  const injuries = outcomes.reduce((summary, outcome) => mergeInjuries(summary, outcome.injuries), EMPTY_INJURIES());
  return {
    careers,
    averageNFLSeasons: round(outcomes.reduce((sum, outcome) => sum + outcome.nflSeasons, 0) / careers),
    averagePeakOverall: round(outcomes.reduce((sum, outcome) => sum + outcome.peakOverall, 0) / careers),
    maxPeakOverall: Math.max(...outcomes.map((outcome) => outcome.peakOverall)),
    injuryCareerRate: round(outcomes.filter((outcome) => outcome.injuries.total > 0).length / careers),
    injuries,
    championships: outcomes.reduce((sum, outcome) => sum + outcome.championships, 0),
    hallOfFamers: outcomes.filter((outcome) => outcome.legacyTier === "hall_of_fame").length,
  };
}

function summarizePosition(position: Position, outcomes: ProjectedCareer[]): PositionSimulationSummary {
  const summary = summarizeOutcomes(outcomes);
  const awards = outcomes.reduce((total, outcome) => ({
    proBowls: total.proBowls + outcome.awards.proBowls,
    allPros: total.allPros + outcome.awards.allPros,
    mvps: total.mvps + outcome.awards.mvps,
  }), EMPTY_AWARDS());
  const nflSeasons = outcomes.reduce((sum, outcome) => sum + outcome.nflSeasons, 0);
  return {
    position,
    careers: summary.careers,
    averageNFLSeasons: summary.averageNFLSeasons,
    averagePeakOverall: summary.averagePeakOverall,
    maxPeakOverall: summary.maxPeakOverall,
    injuryCareerRate: summary.injuryCareerRate,
    injuries: summary.injuries,
    averageContracts: round(outcomes.reduce((sum, outcome) => sum + outcome.contracts, 0) / outcomes.length),
    averageContractValue: Math.round(outcomes.reduce((sum, outcome) => sum + outcome.contractValue, 0) / outcomes.length),
    championships: summary.championships,
    awards,
    awardSelectionsPer100Seasons: nflSeasons > 0 ? round((awards.proBowls + awards.allPros + awards.mvps) / nflSeasons * 100) : 0,
    hallOfFamers: summary.hallOfFamers,
    endReasons: countEndReasons(outcomes),
  };
}

/**
 * Position-neutral audit: awards are not required to be identical, but a
 * position should not be effectively locked out nor receive an honor on a
 * majority of every simulated season. Formula changes are made only after
 * this report exposes a concrete outlier.
 */
function auditPositionEquity(positions: PositionSimulationSummary[]): SimulationFinding[] {
  const findings: SimulationFinding[] = [];
  for (const position of positions) {
    const rate = position.awardSelectionsPer100Seasons;
    if (rate < 1) {
      findings.push({ id: `award_rate_${position.position.toLowerCase()}`, severity: "warning", message: `${position.position} earns only ${rate} award selections per 100 NFL seasons; review position-normalized award thresholds.` });
    } else if (rate > 35) {
      findings.push({ id: `award_rate_${position.position.toLowerCase()}`, severity: "warning", message: `${position.position} earns ${rate} award selections per 100 NFL seasons; review for over-rewarding.` });
    }
  }
  if (findings.length === 0) {
    findings.push({ id: "award_rate_equity", severity: "pass", message: "Every position stays within the 1–35 award-selections-per-100-seasons audit band." });
  }
  return findings;
}

function summarizeStrategy(strategy: BalanceStrategy, outcomes: ProjectedCareer[]): StrategySimulationSummary {
  const summary = summarizeOutcomes(outcomes);
  return {
    strategy,
    careers: outcomes.length,
    averageNFLSeasons: summary.averageNFLSeasons,
    averagePeakOverall: summary.averagePeakOverall,
    injuryCareerRate: summary.injuryCareerRate,
    averageInjuries: round(summary.injuries.total / outcomes.length),
    championshipsPer100Careers: round(summary.championships / outcomes.length * 100),
    hallOfFameRate: round(summary.hallOfFamers / outcomes.length),
    averageContractValue: Math.round(outcomes.reduce((sum, outcome) => sum + outcome.contractValue, 0) / outcomes.length),
  };
}

function findStrategyTradeoffs(strategies: StrategySimulationSummary[]): SimulationFinding[] {
  const highestPeak = bestBy(strategies, (summary) => summary.averagePeakOverall);
  const longest = bestBy(strategies, (summary) => summary.averageNFLSeasons);
  const safest = bestBy(strategies, (summary) => -summary.injuryCareerRate);
  const highestContractValue = bestBy(strategies, (summary) => summary.averageContractValue);
  const dominance = strategies.find((candidate) => strategies.every((other) =>
    candidate.strategy === other.strategy || (
      candidate.averagePeakOverall >= other.averagePeakOverall &&
      candidate.averageNFLSeasons >= other.averageNFLSeasons &&
      candidate.injuryCareerRate <= other.injuryCareerRate &&
      candidate.averageContractValue >= other.averageContractValue
    )
  ));
  const findings: SimulationFinding[] = [
    { id: "peak_tradeoff", severity: "pass", message: "Peak overall is highest for " + highestPeak.strategy + " (" + highestPeak.averagePeakOverall + ")." },
    { id: "longevity_tradeoff", severity: "pass", message: "Career length is highest for " + longest.strategy + " (" + longest.averageNFLSeasons + " NFL seasons)." },
    { id: "injury_tradeoff", severity: "pass", message: "Injury exposure is lowest for " + safest.strategy + " (" + percent(safest.injuryCareerRate) + " of careers injured)." },
    { id: "contract_tradeoff", severity: "pass", message: "Aggregate contract value is highest for " + highestContractValue.strategy + " ($" + formatNumber(highestContractValue.averageContractValue) + ")." },
  ];
  const balanced = strategies.find((summary) => summary.strategy === "balanced");
  const grind = strategies.find((summary) => summary.strategy === "grind");
  const grindIsEffectivelyDominant = Boolean(
    balanced && grind &&
    grind.averagePeakOverall - balanced.averagePeakOverall >= 5 &&
    grind.averageContractValue >= balanced.averageContractValue * 1.2 &&
    balanced.averageNFLSeasons - grind.averageNFLSeasons <= 0.5 &&
    grind.averageInjuries - balanced.averageInjuries <= 0.5
  );
  if (dominance) {
    findings.push({ id: "dominant_strategy", severity: "warning", message: dominance.strategy + " weakly dominates every tracked outcome; rebalance before treating the strategies as equally meaningful." });
  } else if (grindIsEffectivelyDominant && balanced && grind) {
    findings.push({
      id: "dominant_strategy",
      severity: "warning",
      message: "Grind is effectively dominant in high-value outcomes: +" + round(grind.averagePeakOverall - balanced.averagePeakOverall) +
        " peak OVR and $" + formatNumber(grind.averageContractValue - balanced.averageContractValue) +
        " contract value versus balanced, for only +" + round(grind.averageInjuries - balanced.averageInjuries) +
        " injuries per career and a " + signed(round(grind.averageNFLSeasons - balanced.averageNFLSeasons)) + "-season career-length change."
    });
  } else {
    findings.push({ id: "dominant_strategy", severity: "pass", message: "No strategy dominates peak, longevity, injury exposure and contract value at the same time." });
  }
  return findings;
}

function scanForImpossibleResults(outcomes: ProjectedCareer[], positions: PositionSimulationSummary[]): SimulationFinding[] {
  const violations = outcomes.filter((outcome) =>
    outcome.nflSeasons < 0 || outcome.nflSeasons > 19 ||
    outcome.peakOverall < 0 || outcome.peakOverall > 99 ||
    outcome.contracts > outcome.nflSeasons ||
    (outcome.nflSeasons > 0 && outcome.contracts === 0) ||
    outcome.contractValue < 0 || outcome.championships > outcome.nflSeasons ||
    outcome.awards.proBowls < 0 || outcome.awards.allPros < 0 || outcome.awards.mvps < 0
  );
  const invalidSeeds = violations.slice(0, 5).map((outcome) => outcome.position + "/" + outcome.seed).join(", ");
  const findings: SimulationFinding[] = [violations.length === 0
    ? { id: "invariant_scan", severity: "pass", message: "No impossible result was found across " + formatNumber(outcomes.length) + " deterministic careers: overall stayed within 0-99, contracts and championships were bounded by seasons, and all counters were non-negative." }
    : { id: "invariant_scan", severity: "failure", message: violations.length + " impossible career result(s) found. Reproduce first with seed(s): " + invalidSeeds + "." }];
  findings.push({
    id: "specialist_stat_coverage",
    severity: "pass",
    message: "K/P outcomes use field-goal, extra-point and punt production rather than the generic tackle-stat proxy."
  });
  const awardlessPositions = positions.filter((position) => position.awards.proBowls === 0 && position.awards.allPros === 0 && position.awards.mvps === 0).map((position) => position.position);
  if (awardlessPositions.length > 0) {
    findings.push({
      id: "award_coverage",
      severity: "warning",
      message: "No award was generated for " + awardlessPositions.join(", ") + " in the baseline cohort. Review position-specific overall and award thresholds before treating their progression as balanced."
    });
  }
  return findings;
}

function countEndReasons(outcomes: ProjectedCareer[]): Record<CareerEndReason, number> {
  return outcomes.reduce<Record<CareerEndReason, number>>((counts, outcome) => {
    counts[outcome.endReason]++;
    return counts;
  }, { age_limit: 0, performance_decline: 0, injury_forced_retirement: 0 });
}

function mergeInjuries(target: InjurySummary, source: InjurySummary): InjurySummary {
  target.total += source.total;
  target.minor += source.minor;
  target.moderate += source.moderate;
  target.severe += source.severe;
  target.careerThreatening += source.careerThreatening;
  return target;
}

function addInjury(summary: InjurySummary, severity: InjurySeverity) {
  summary.total++;
  if (severity === "career_threatening") summary.careerThreatening++;
  else summary[severity]++;
}

function focusFor(strategy: BalanceStrategy, week: number): TrainingFocus {
  if (strategy === "grind") return "position_specific";
  const slot = week % 4;
  if (strategy === "recovery") return slot === 0 ? "position_specific" : slot === 1 ? "mental" : "recovery";
  return slot < 2 ? "position_specific" : slot === 2 ? "mental" : "recovery";
}

function makeSeasonStat(position: Position, careerIndex: number, age: number, overall: number, gamesPlayed: number, championshipWon: boolean): StatLine {
  const output = clamp((overall - 48) / 42, 0.05, 1.1);
  const line = emptyStatLine(2026 + age - 21, "nfl", "cohort_" + careerIndex);
  line.gamesPlayed = gamesPlayed;
  line.gamesStarted = gamesPlayed;
  line.championshipWon = championshipWon;
  if (position === "QB") {
    line.passAttempts = Math.round(gamesPlayed * 28);
    line.passCompletions = Math.round(line.passAttempts * (0.52 + output * 0.18));
    line.passYards = Math.round(gamesPlayed * (150 + output * 140));
    line.passTDs = Math.round(gamesPlayed * output * 2.1);
  } else if (position === "RB") {
    line.rushAttempts = Math.round(gamesPlayed * 12);
    line.rushYards = Math.round(gamesPlayed * (40 + output * 75));
    line.rushTDs = Math.round(gamesPlayed * output * 0.9);
    line.receptions = Math.round(gamesPlayed * (1.2 + output * 2.2));
    line.receivingYards = Math.round(gamesPlayed * (10 + output * 27));
    line.receivingTDs = Math.round(gamesPlayed * output * 0.16);
  } else if (position === "WR") {
    line.receptions = Math.round(gamesPlayed * (2.5 + output * 5.2));
    line.receivingYards = Math.round(gamesPlayed * (30 + output * 80));
    line.receivingTDs = Math.round(gamesPlayed * output * 0.9);
  } else if (position === "TE") {
    line.receptions = Math.round(gamesPlayed * (2.3 + output * 4.8));
    line.receivingYards = Math.round(gamesPlayed * (30 + output * 70));
    line.receivingTDs = Math.round(gamesPlayed * output * 0.8);
    line.blocksWon = Math.round(gamesPlayed * (1.5 + output * 3.4));
  } else if (position === "OL") {
    line.blocksWon = Math.round(gamesPlayed * (3 + output * 5.5));
  } else if (position === "DL") {
    line.tackles = Math.round(gamesPlayed * (2.5 + output * 5.5));
    line.sacks = Math.round(gamesPlayed * output * 0.62);
    line.forcedFumbles = Math.round(gamesPlayed * output * 0.08);
  } else if (position === "S" || position === "LB" || position === "CB") {
    line.tackles = Math.round(gamesPlayed * (3 + output * 7));
    if (position === "LB") {
      line.sacks = Math.round(gamesPlayed * output * 0.25);
      line.passesDefended = Math.round(gamesPlayed * output * 0.24);
      line.forcedFumbles = Math.round(gamesPlayed * output * 0.12);
    } else if (position === "CB") {
      // Corners are judged primarily on coverage production. The aggregate
      // cohort needs to model that so CB award paths are not evaluated from
      // a safety-like, tackle-heavy fallback.
      line.interceptions = Math.round(gamesPlayed * output * 0.2);
      line.passesDefended = Math.round(gamesPlayed * (0.4 + output));
      line.forcedFumbles = Math.round(gamesPlayed * output * 0.07);
    } else {
      line.interceptions = Math.round(gamesPlayed * output * 0.16);
      line.passesDefended = Math.round(gamesPlayed * output * 0.7);
    }
  } else if (position === "K") {
    line.fieldGoalAttempts = Math.round(gamesPlayed * (1.3 + output * 1.05));
    line.fieldGoalsMade = Math.round(line.fieldGoalAttempts * clamp(0.68 + output * 0.19, 0.68, 0.91));
    line.extraPointAttempts = Math.round(gamesPlayed * (1.7 + output * 1.1));
    line.extraPointsMade = Math.round(line.extraPointAttempts * clamp(0.9 + output * 0.08, 0.9, 0.98));
  } else if (position === "P") {
    line.punts = Math.round(gamesPlayed * (2.4 + (1 - output) * 1.25));
    line.puntYards = Math.round(line.punts * (38 + output * 10));
    line.puntsInside20 = Math.round(line.punts * clamp(0.12 + output * 0.12, 0.12, 0.25));
  }
  const wins = championshipWon ? 12 : Math.round(clamp(4 + overall / 11 + ((careerIndex + age) % 5) - 2, 3, 12));
  const awards = evaluateSeasonAwards(line, position, wins);
  line.proBowl = awards.proBowl;
  line.allPro = awards.allPro;
  line.mvp = awards.mvp;
  return line;
}

function deriveSeed(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

function bestBy<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((best, item) => score(item) > score(best) ? item : best);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function percent(value: number): string {
  return String(round(value * 100)) + "%";
}

function signed(value: number): string {
  return (value >= 0 ? "+" : "") + value;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
