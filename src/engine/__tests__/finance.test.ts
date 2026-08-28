import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyFinanceState, applyIncome, purchaseAsset, weeklyFinanceTick, addSponsorship } from "../finance";

describe("finance", () => {
  it("starts a new career with the promised $1,000 budget", () => {
    const state = emptyFinanceState();
    assert.equal(state.cash, 1_000);
    assert.equal(state.netWorth, 1_000);
  });

  it("applies income net of a flat tax rate", () => {
    const state = emptyFinanceState();
    const { state: next, taxed, net } = applyIncome(state, 100_000, "test");
    assert.equal(taxed + net, 100_000);
    assert.ok(taxed > 0);
    assert.equal(next.cash, state.cash + net);
    assert.equal(next.totalCareerEarnings, 100_000);
  });

  it("refuses to purchase an asset that costs more than available cash", () => {
    const state = emptyFinanceState();
    const { ok } = purchaseAsset(state, { name: "Mansion", type: "house", value: 10_000_000, weeklyUpkeep: 500, weeklyReturn: 0 }, 1);
    assert.equal(ok, false);
  });

  it("purchases an affordable asset and tracks upkeep", () => {
    const { state: funded } = applyIncome(emptyFinanceState(), 1_000_000, "bonus");
    const { state: next, ok } = purchaseAsset(funded, { name: "Car", type: "car", value: 50_000, weeklyUpkeep: 50, weeklyReturn: 0 }, 1);
    assert.equal(ok, true);
    assert.equal(next.assets.length, 1);
    assert.ok(next.weeklyExpenses > funded.weeklyExpenses);
  });

  it("weekly tick pays upkeep and collects sponsorship income", () => {
    let state = emptyFinanceState();
    state = addSponsorship(state, { brand: "Test Brand", weeklyValue: 1000, weeksRemaining: 4, requiresFame: 0 }, 1);
    const cashBefore = state.cash;
    const { state: next, log } = weeklyFinanceTick(state);
    assert.ok(next.cash > cashBefore - state.weeklyExpenses); // sponsorship income offsets base expenses
    assert.ok(log.some((l) => l.includes("Sponsorship")));
    assert.equal(next.sponsorships[0].weeksRemaining, 3);
  });

  it("net worth reflects cash plus assets minus debt", () => {
    const { state: funded } = applyIncome(emptyFinanceState(), 2_000_000, "bonus");
    const { state: withAsset } = purchaseAsset(funded, { name: "House", type: "house", value: 500_000, weeklyUpkeep: 200, weeklyReturn: 0 }, 1);
    assert.equal(withAsset.netWorth, withAsset.cash + 500_000 - withAsset.debt);
  });

  it("routes a cash shortfall into debt instead of letting cash go negative", () => {
    const state = { ...emptyFinanceState(), cash: 30 }; // weeklyExpenses: 50, so this tick runs a 20 shortfall
    const { state: next, log } = weeklyFinanceTick(state);
    assert.equal(next.cash, 0, "cash should floor at 0, never go negative");
    assert.equal(next.debt, 20, "the shortfall should be recorded as debt");
    assert.ok(log.some((l) => l.toLowerCase().includes("debt")));
    // Net worth math must be identical to the old behavior (cash going to -20,
    // debt staying 0) — moving the shortfall into debt is a pure relabeling.
    assert.equal(next.netWorth, -20);
  });

  it("does not touch debt when cash comfortably covers expenses", () => {
    const state = emptyFinanceState();
    const { state: next } = weeklyFinanceTick(state);
    assert.equal(next.debt, 0);
    assert.ok(next.cash >= 0);
  });
});
