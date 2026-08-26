import type { Contract, Team } from "./types";
import { TEAMS } from "./teams";
import { RNG, clamp } from "./rng";

// =============================================================================
// Contracts & Free Agency
// =============================================================================

export interface FreeAgencyOffer {
  teamId: string;
  contract: Contract;
  role: "starter" | "backup" | "competition";
  championshipProbability: number; // 0-1, illustrative, shown to help the player decide
}

export function buildContract(teamId: string, years: number, totalValue: number, signingBonus: number, startYear: number, rookieDeal: boolean): Contract {
  const guaranteedMoney = Math.round(signingBonus + totalValue * 0.15);
  const remaining = totalValue - signingBonus;
  const annualSalary: number[] = [];
  for (let i = 0; i < years; i++) {
    // Back-loaded slightly, typical of real deals.
    const share = (i + 1) / ((years * (years + 1)) / 2);
    annualSalary.push(Math.round(remaining * share));
  }
  return { teamId, years, totalValue, signingBonus, guaranteedMoney, annualSalary, startYear, currentYear: 0, rookieDeal };
}

export function generateFreeAgencyOffers(
  overall: number,
  fame: number,
  age: number,
  startYear: number,
  rng: RNG,
  count = 4
): FreeAgencyOffer[] {
  const candidateTeams = rng.shuffle(TEAMS).slice(0, count);
  return candidateTeams.map((team) => buildOfferForTeam(team, overall, fame, age, startYear, rng));
}

function buildOfferForTeam(team: Team, overall: number, fame: number, age: number, startYear: number, rng: RNG): FreeAgencyOffer {
  const ageFactor = age < 27 ? 1 : age < 30 ? 0.9 : age < 33 ? 0.7 : 0.45;
  const marketFactor = 0.7 + (team.marketSize / 100) * 0.6;
  const perYear = Math.round(600_000 + Math.pow(overall / 99, 2.4) * 34_000_000 * ageFactor * marketFactor * (0.85 + rng.next() * 0.3));
  const years = overall > 85 && age < 30 ? 4 : overall > 70 ? 3 : 2;
  const totalValue = perYear * years;
  const signingBonus = Math.round(totalValue * (0.25 + rng.next() * 0.25));

  const contract = buildContract(team.id, years, totalValue, signingBonus, startYear, false);
  const role = overall > 80 ? "starter" : overall > 60 ? (rng.chance(0.5) ? "starter" : "competition") : "backup";
  const championshipProbability = clamp((team.prestige * 0.5 + team.rosterStrength * 0.5) / 100, 0.02, 0.6);

  return { teamId: team.id, contract, role, championshipProbability };
}

/** Weekly salary paid out during the season (annualSalary spread over ~18 weeks). */
export function weeklySalary(contract: Contract, weeksInSeason = 18): number {
  const yearIndex = Math.min(contract.currentYear, contract.annualSalary.length - 1);
  return Math.round(contract.annualSalary[yearIndex] / weeksInSeason);
}

export function advanceContractYear(contract: Contract): Contract {
  return { ...contract, currentYear: contract.currentYear + 1 };
}

export function isContractExpired(contract: Contract): boolean {
  return contract.currentYear >= contract.years;
}

/** Rare mid-contract release risk: a genuinely bad season can end a deal
 *  early instead of waiting out its full term, so a contract carries real
 *  pressure rather than just being a countdown timer. Never triggers in the
 *  first season on a deal (rookies and new signings get a grace year), and
 *  never on a deal that's about to expire naturally anyway. Bigger, pricier
 *  deals draw more scrutiny — the "big free-agent bust" story. */
export function checkPerformanceRelease(contract: Contract, wins: number, losses: number, rng: RNG): boolean {
  if (contract.currentYear < 1) return false;
  if (isContractExpired(contract)) return false;
  const games = wins + losses;
  if (games === 0) return false;
  const winPct = wins / games;
  if (winPct >= 0.35) return false; // mediocre is safe; only a rough season draws heat
  const pressure = clamp(contract.totalValue / 40_000_000, 0.2, 1.2);
  const badness = (0.35 - winPct) / 0.35;
  const chance = clamp(badness * pressure * 0.5, 0, 0.6);
  return rng.chance(chance);
}
