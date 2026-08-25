import type { Asset, FinanceState, Sponsorship } from "./types";

// =============================================================================
// Finance system: cash, salary, taxes, expenses, assets, sponsorships, net worth.
// Deliberately simple and transparent — the player should always be able to
// see *why* their net worth moved.
// =============================================================================

export function emptyFinanceState(): FinanceState {
  return {
    cash: 500,
    netWorth: 500,
    weeklyExpenses: 50,
    totalCareerEarnings: 0,
    totalTaxesPaid: 0,
    debt: 0,
    assets: [],
    sponsorships: [],
  };
}

const TAX_RATE = 0.38; // flat effective rate approximation (federal + state + agent fees), documented & simple on purpose

export function applyIncome(state: FinanceState, grossAmount: number, label: string): { state: FinanceState; taxed: number; net: number } {
  const taxed = Math.round(grossAmount * TAX_RATE);
  const net = grossAmount - taxed;
  const next: FinanceState = {
    ...state,
    cash: state.cash + net,
    totalCareerEarnings: state.totalCareerEarnings + grossAmount,
    totalTaxesPaid: state.totalTaxesPaid + taxed,
  };
  return { state: recomputeNetWorth(next), taxed, net };
}

export function purchaseAsset(state: FinanceState, asset: Omit<Asset, "id" | "purchasedWeek">, week: number): { state: FinanceState; ok: boolean } {
  if (asset.value > state.cash) return { state, ok: false };
  const newAsset: Asset = { ...asset, id: `asset_${week}_${Math.round(Math.random() * 1e6)}`, purchasedWeek: week };
  const next: FinanceState = {
    ...state,
    cash: state.cash - asset.value,
    assets: [...state.assets, newAsset],
    weeklyExpenses: state.weeklyExpenses + newAsset.weeklyUpkeep,
  };
  return { state: recomputeNetWorth(next), ok: true };
}

export function addSponsorship(state: FinanceState, sponsorship: Omit<Sponsorship, "id">): FinanceState {
  const s: Sponsorship = { ...sponsorship, id: `sponsor_${Date.now()}_${Math.round(Math.random() * 1e6)}` };
  return { ...state, sponsorships: [...state.sponsorships, s] };
}

/** Weekly tick: collects investment returns, sponsorship income, pays upkeep/expenses. */
export function weeklyFinanceTick(state: FinanceState): { state: FinanceState; log: string[] } {
  const log: string[] = [];
  let cash = state.cash;

  const investmentReturn = state.assets.filter((a) => a.type === "investment").reduce((sum, a) => sum + a.weeklyReturn, 0);
  if (investmentReturn !== 0) {
    cash += investmentReturn;
    log.push(`Investments ${investmentReturn >= 0 ? "returned" : "lost"} $${Math.abs(Math.round(investmentReturn)).toLocaleString()}`);
  }

  const sponsorIncome = state.sponsorships.reduce((sum, s) => sum + s.weeklyValue, 0);
  if (sponsorIncome > 0) {
    cash += sponsorIncome;
    log.push(`Sponsorship income: $${Math.round(sponsorIncome).toLocaleString()}`);
  }

  const upkeep = state.assets.reduce((sum, a) => sum + a.weeklyUpkeep, 0) + state.weeklyExpenses;
  cash -= upkeep;

  const sponsorships = state.sponsorships
    .map((s) => ({ ...s, weeksRemaining: s.weeksRemaining - 1 }))
    .filter((s) => s.weeksRemaining > 0);

  const next: FinanceState = { ...state, cash, sponsorships };
  return { state: recomputeNetWorth(next), log };
}

export function recomputeNetWorth(state: FinanceState): FinanceState {
  const assetValue = state.assets.reduce((sum, a) => sum + a.value, 0);
  const netWorth = state.cash + assetValue - state.debt;
  return { ...state, netWorth };
}

/** Suggested sponsorship offers scale with fame/reputation/performance. */
export function generateSponsorshipOffer(fame: number, reputation: number, rng: { next: () => number }): Sponsorship | null {
  if (fame < 20) return null;
  const brands = ["Apex Gear", "Ridgeline Motors", "Northstar Bank", "Voltix Energy", "Summit Eyewear", "Cinderfalls Grill", "Blaze Sportswear"];
  const brand = brands[Math.floor(rng.next() * brands.length)];
  const scale = (fame * 0.7 + reputation * 0.3) / 100;
  const weeklyValue = Math.round(200 + scale * 4800 * (0.7 + rng.next() * 0.6));
  return {
    id: "",
    brand,
    weeklyValue,
    weeksRemaining: 12 + Math.floor(rng.next() * 20),
    requiresFame: 20,
  };
}
