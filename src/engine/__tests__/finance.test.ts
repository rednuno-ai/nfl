import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyFinanceState, applyIncome, purchaseAsset, weeklyFinanceTick, addSponsorship } from "../finance";

describe("finance", () => {
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
});
