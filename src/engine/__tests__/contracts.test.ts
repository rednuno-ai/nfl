import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildContract, weeklySalary, advanceContractYear, isContractExpired, checkPerformanceRelease, generateFreeAgencyOffers } from "../contracts";
import { RNG } from "../rng";

describe("contracts", () => {
  it("buildContract back-loads salary so later years pay more than earlier ones", () => {
    const contract = buildContract("team_a", 4, 40_000_000, 8_000_000, 2026, false);
    assert.equal(contract.annualSalary.length, 4);
    for (let i = 1; i < contract.annualSalary.length; i++) {
      assert.ok(contract.annualSalary[i] >= contract.annualSalary[i - 1], `year ${i} salary (${contract.annualSalary[i]}) should be >= year ${i - 1} (${contract.annualSalary[i - 1]})`);
    }
    // Signing bonus + the back-loaded years should roughly reconstruct totalValue.
    const reconstructed = contract.signingBonus + contract.annualSalary.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(reconstructed - contract.totalValue) <= contract.years, "annual salary + signing bonus should sum back to ~totalValue");
  });

  it("guaranteedMoney is always at least the signing bonus", () => {
    const contract = buildContract("team_a", 3, 15_000_000, 2_000_000, 2026, true);
    assert.ok(contract.guaranteedMoney >= contract.signingBonus);
  });

  it("weeklySalary divides the current contract year's salary across the season and clamps to the last year on overrun", () => {
    const contract = buildContract("team_a", 2, 10_000_000, 1_000_000, 2026, false);
    const week1Pay = weeklySalary(contract, 18);
    assert.equal(week1Pay, Math.round(contract.annualSalary[0] / 18));

    // currentYear advanced past the contract's own length shouldn't index out of bounds.
    const overrun = { ...contract, currentYear: 5 };
    const pay = weeklySalary(overrun, 18);
    assert.equal(pay, Math.round(contract.annualSalary[contract.annualSalary.length - 1] / 18));
  });

  it("advanceContractYear and isContractExpired agree on when a deal is done", () => {
    let contract = buildContract("team_a", 2, 5_000_000, 500_000, 2026, false);
    assert.equal(isContractExpired(contract), false);
    contract = advanceContractYear(contract);
    assert.equal(isContractExpired(contract), false); // currentYear 1 of 2 -> still active
    contract = advanceContractYear(contract);
    assert.equal(isContractExpired(contract), true); // currentYear 2 of 2 -> expired
  });

  describe("checkPerformanceRelease", () => {
    it("never releases in the first year of a deal, even after a winless season", () => {
      const contract = buildContract("team_a", 3, 30_000_000, 6_000_000, 2026, false);
      const rng = new RNG(1);
      assert.equal(checkPerformanceRelease(contract, 0, 17, rng), false);
    });

    it("never releases a contract that's already expired", () => {
      let contract = buildContract("team_a", 1, 5_000_000, 1_000_000, 2026, false);
      contract = advanceContractYear(contract); // now expired
      const rng = new RNG(1);
      assert.equal(checkPerformanceRelease(contract, 0, 17, rng), false);
    });

    it("never releases over a .500-or-better season regardless of contract size", () => {
      let contract = buildContract("team_a", 4, 100_000_000, 20_000_000, 2026, false);
      contract = advanceContractYear(contract);
      for (let seed = 1; seed <= 20; seed++) {
        assert.equal(checkPerformanceRelease(contract, 9, 8, new RNG(seed)), false, `seed ${seed}: a 9-8 season should never trigger a release`);
      }
    });

    it("can release a big-money contract after a genuinely bad season, but it's not guaranteed every time", () => {
      let contract = buildContract("team_a", 4, 100_000_000, 20_000_000, 2026, false);
      contract = advanceContractYear(contract);
      let releases = 0;
      for (let seed = 1; seed <= 200; seed++) {
        if (checkPerformanceRelease(contract, 1, 16, new RNG(seed))) releases++;
      }
      assert.ok(releases > 0, "expected at least some releases across 200 seeds of a 1-16 season on a $100M deal");
      assert.ok(releases < 200, "release chance should be probabilistic, not certain");
    });
  });

  it("generateFreeAgencyOffers returns the requested count with positive, distinct-enough contract values", () => {
    const rng = new RNG(42);
    const offers = generateFreeAgencyOffers(88, 60, 26, 2026, rng, 4);
    assert.equal(offers.length, 4);
    for (const offer of offers) {
      assert.ok(offer.contract.totalValue > 0);
      assert.ok(offer.championshipProbability >= 0.02 && offer.championshipProbability <= 0.6);
      assert.ok(["starter", "backup", "competition"].includes(offer.role));
    }
  });
});
