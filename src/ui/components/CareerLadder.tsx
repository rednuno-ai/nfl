import type { CareerState } from "@engine/career";
import { computeOverall } from "@engine/attributes";
import { STAGE_LABELS } from "../format";

const LADDER: { label: string }[] = [{ label: "ROOKIE" }, { label: "STARTER" }, { label: "STAR" }, { label: "SUPERSTAR" }, { label: "LEGEND" }];

// =============================================================================
// A lightweight, always-computable "where am I on the arc?" indicator — a
// deliberately simpler cousin of the end-of-career LegacyTier (see legacy.ts),
// which needs a full career's worth of accolades to grade and only exists
// once retired. This is purely cosmetic (never read by game logic): it just
// gives the player a constant, at-a-glance sense of climbing, using current
// overall rating as the proxy for a mid-career player and the final legacy
// tier once retired.
// =============================================================================
function ladderIndexFor(state: CareerState): number {
  if (state.stage === "retired" && state.legacy) {
    switch (state.legacy.tier) {
      case "hall_of_fame":
      case "legend":
        return 4;
      case "superstar":
        return 3;
      case "star":
        return 2;
      default:
        return 1;
    }
  }
  const overall = computeOverall(state.player.attributes, state.player.position);
  if (overall >= 93) return 4;
  if (overall >= 87) return 3;
  if (overall >= 80) return 2;
  if (overall >= 70) return 1;
  return 0;
}

export function CareerLadder({ state }: { state: CareerState }) {
  const activeIndex = ladderIndexFor(state);
  return (
    <div className="career-ladder">
      <div className="career-ladder-track">
        {LADDER.map((stop, i) => (
          <div className={`career-ladder-stop ${i === activeIndex ? "is-active" : i < activeIndex ? "is-done" : ""}`} key={stop.label}>
            {i === activeIndex && <div className="career-ladder-you-are-here">YOU ARE HERE</div>}
            <div className="career-ladder-dot" />
            <div className="career-ladder-label">{stop.label}</div>
          </div>
        ))}
      </div>
      <div className="career-ladder-caption">
        Week {state.weekInSeason} — {STAGE_LABELS[state.stage] ?? state.stage}
      </div>
    </div>
  );
}
