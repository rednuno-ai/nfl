import { runCareerSimulation, type CareerSimulationReport } from "../src/engine/balance";

/**
 * Local balance-regression entrypoint. This intentionally reads no accounts,
 * browser storage or environment data, and does not send network requests.
 * Output is a deterministic Markdown report for a fixed seed.
 */
const report = runCareerSimulation();
console.log(renderReport(report));

function renderReport(value: CareerSimulationReport): string {
  const lines = [
    "# GRIDIRON LIFE — Career balance simulation",
    "",
    "## Scope",
    "",
    "- Seed: " + value.seed,
    "- Baseline: " + formatNumber(value.baselineCareers) + " balanced careers (" + formatNumber(value.baselineCareers / value.positions.length) + " per position).",
    "- Strategy counterfactuals: " + formatNumber(value.strategyComparisonCareers) + " careers.",
    "- Total executed: " + formatNumber(value.totalCareers) + " careers.",
    "- This is local deterministic QA output, not product analytics. It reads no player account or browser data and sends nothing over the network.",
    "",
    "## Position results",
    "",
    "| Pos. | Careers | NFL seasons | Peak OVR | Injuries | Contracts | Contract value | Titles | Pro Bowl / All-Pro / MVP | Awards / 100 seasons | HoF | End: age / decline / injury |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const position of value.positions) {
    lines.push(
      "| " + position.position +
      " | " + position.careers +
      " | " + position.averageNFLSeasons +
      " | " + position.averagePeakOverall + " (max " + position.maxPeakOverall + ")" +
      " | " + position.injuries.total + " (" + percent(position.injuryCareerRate) + " careers)" +
      " | " + position.averageContracts +
      " | $" + formatNumber(position.averageContractValue) +
      " | " + position.championships +
      " | " + position.awards.proBowls + " / " + position.awards.allPros + " / " + position.awards.mvps +
      " | " + position.awardSelectionsPer100Seasons +
      " | " + position.hallOfFamers +
      " | " + position.endReasons.age_limit + " / " + position.endReasons.performance_decline + " / " + position.endReasons.injury_forced_retirement +
      " |"
    );
  }

  lines.push(
    "",
    "## Strategy comparison",
    "",
    "| Strategy | Careers | NFL seasons | Peak OVR | Injured careers | Injuries/career | Titles / 100 | HoF rate | Contract value |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  for (const strategy of value.strategies) {
    lines.push(
      "| " + strategy.strategy +
      " | " + strategy.careers +
      " | " + strategy.averageNFLSeasons +
      " | " + strategy.averagePeakOverall +
      " | " + percent(strategy.injuryCareerRate) +
      " | " + strategy.averageInjuries +
      " | " + strategy.championshipsPer100Careers +
      " | " + percent(strategy.hallOfFameRate) +
      " | $" + formatNumber(strategy.averageContractValue) +
      " |"
    );
  }

  lines.push("", "## Findings", "");
  for (const finding of [...value.positionAuditFindings, ...value.dominantStrategyFindings, ...value.impossibleResultFindings]) {
    lines.push("- [" + finding.severity.toUpperCase() + "] " + finding.message);
  }
  lines.push(
    "",
    "## Interpretation limits",
    "",
    "The cohort uses the live progression, ageing, injury, contract and legacy functions, but resolves a season in aggregate. It is a regression and balance signal, not a prediction of real-world athlete outcomes. Re-run with the same seed to reproduce any finding."
  );
  return lines.join("\n");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number): string {
  return String(Math.round(value * 1000) / 10) + "%";
}
