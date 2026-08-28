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
  // Id is derived from week + current asset count rather than Math.random()
  // so this stays a pure function of its inputs, like the rest of the
  // engine — two purchases in the same week naturally get different ids
  // since the array has grown by the time the second call happens.
  const newAsset: Asset = { ...asset, id: `asset_${week}_${state.assets.length}`, purchasedWeek: week };
  const next: FinanceState = {
    ...state,
    cash: state.cash - asset.value,
    assets: [...state.assets, newAsset],
    weeklyExpenses: state.weeklyExpenses + newAsset.weeklyUpkeep,
  };
  return { state: recomputeNetWorth(next), ok: true };
}

export function addSponsorship(state: FinanceState, sponsorship: Omit<Sponsorship, "id">, week: number): FinanceState {
  // Same reasoning as purchaseAsset's id above: derive it from inputs
  // already at hand (week + how many sponsorships exist so far) instead of
  // Date.now()/Math.random(), so replaying the same seed + decisions
  // reproduces byte-identical ids too.
  const s: Sponsorship = { ...sponsorship, id: `sponsor_${week}_${state.sponsorships.length}` };
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

  // Cash can't go negative and just sit there quietly — a shortfall becomes
  // real debt instead, so it's visible and actually affects net worth
  // through recomputeNetWorth's "- state.debt" term (this is a pure
  // relabeling: cash going to -X and debt staying 0 nets out identically to
  // cash at 0 and debt at X, so this changes nothing about the math, only
  // whether the shortfall is legible to the player).
  let debt = state.debt;
  if (cash < 0) {
    const shortfall = -cash;
    debt += shortfall;
    cash = 0;
    log.push(`Couldn't cover $${Math.round(shortfall).toLocaleString()} in expenses — added to debt`);
  }

  const sponsorships = state.sponsorships
    .map((s) => ({ ...s, weeksRemaining: s.weeksRemaining - 1 }))
    .filter((s) => s.weeksRemaining > 0);

  const next: FinanceState = { ...state, cash, debt, sponsorships };
  return { state: recomputeNetWorth(next), log };
}

export function recomputeNetWorth(state: FinanceState): FinanceState {
  const assetValue = state.assets.reduce((sum, a) => sum + a.value, 0);
  const netWorth = state.cash + assetValue - state.debt;
  return { ...state, netWorth };
}

/** Suggested sponsorship offers scale with fame/reputation/performance. */
// Original fictional partners. The player can build a broad business portfolio
// without the game needing real-world trademarks, logos, or endorsement deals.
export const SPONSOR_BRANDS = [
  "Apex Gear", "Ridgeline Motors", "Northstar Bank", "Voltix Energy", "Summit Eyewear", "Cinderfalls Grill", "Blaze Sportswear", "Ironclad Watches", "Crestline Mobile", "Sunbeam Coffee",
  "Harbor & Pine", "Orbit Wireless", "Peak Protein", "Monarch Audio", "Rally Hydration", "Copperline Denim", "TrueNorth Travel", "Vanta Footwear", "Atlas Freight", "Brightline Insurance",
  "Granite Tools", "Silverwing Air", "Everlane Outdoors", "Pulse Recovery", "Cobalt Home", "Wildwood Foods", "NovaPay", "Slate Grooming", "Arcade Auto", "Redwood Realty",
  "Stadium Snacks", "Fable Media", "Momentum Fitness", "Lumen Skincare", "Crosswind Bikes", "Horizon Hotels", "Signal Sportsbook", "Fieldhouse Furniture", "Glacier Water", "Oxbow Workwear",
  "Rocket Meal Kits", "Foundry Tech", "Kinetic Gaming", "Anchor Security", "Drift Travel", "Highline Nutrition", "Keystone Credit", "OpenRoad Electric", "Golden Hour Films", "Canyon Outdoors",
] as const;

export const MAX_ACTIVE_SPONSORSHIPS = 50;

export function generateSponsorshipOffer(fame: number, reputation: number, rng: { next: () => number }, activeBrands: readonly string[] = []): Sponsorship | null {
  if (fame < 20) return null;
  const availableBrands = SPONSOR_BRANDS.filter((brand) => !activeBrands.includes(brand));
  if (availableBrands.length === 0) return null;
  const brand = availableBrands[Math.floor(rng.next() * availableBrands.length)];
  const scale = (fame * 0.7 + reputation * 0.3) / 100;
  const weeklyValue = Math.round(200 + scale * 4800 * (0.7 + rng.next() * 0.6));
  return {
    id: "",
    brand,
    weeklyValue,
    // A single partner can arrive per career week. A 52-week term makes the
    // 50-partner portfolio reachable instead of leaving the advertised cap
    // mathematically impossible with short-lived deals.
    weeksRemaining: 52,
    requiresFame: 20,
  };
}
