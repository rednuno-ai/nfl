import { gameStore } from "@store/gameStore";
import type { CareerState, TrainingSelection } from "@engine/career";
import type { ScheduleEntry } from "@engine/simulation/season";
import { TeamCrest } from "@ui/components/TeamCrest";

// =============================================================================
// "What do I do right now?" — surfaced as the very first decision point on
// the Dashboard, above the stat grid. Before this, a player landed on a wall
// of numbers and had to hunt for the "Advance Week" button several cards
// down; this puts the next concrete thing (play a game, or push through a
// training week) front and center, framed like a matchup card instead of a
// generic panel.
// =============================================================================
export function NextEventCard({
  nextGame,
  ownCrestSeed,
  state,
}: {
  nextGame: ScheduleEntry | undefined;
  ownCrestSeed: { seed: string; label: string } | null;
  state: CareerState;
}) {
  const needsWeeklyPlan = state.trainingFocusChosenForWeek !== state.totalWeek;
  const choosePlan = (trainingFocus: TrainingSelection) => gameStore.getState().advance({ trainingFocus });

  return (
    <div className="next-event-card">
      <div className="next-event-eyebrow">🏟️ NEXT EVENT</div>
      {nextGame ? (
        <>
          <div className="next-event-matchup">
            {ownCrestSeed ? <TeamCrest seed={ownCrestSeed.seed} label={ownCrestSeed.label} size={40} /> : <div className="next-event-crest-placeholder" />}
            <div className="next-event-vs">{nextGame.isHome ? "VS" : "@"}</div>
            <TeamCrest seed={nextGame.opponentId} label={nextGame.opponentLabel} size={40} />
            <div className="next-event-opponent-name">{nextGame.opponentLabel}</div>
          </div>
          <div className="next-event-meta">
            <span className="badge badge-accent">This Week</span>
            <span className="faint">
              Week {nextGame.week} · {nextGame.isHome ? "Home" : "Away"}
            </span>
          </div>
          <WeeklyPlan needsWeeklyPlan={needsWeeklyPlan} onChoose={choosePlan} />
          {needsWeeklyPlan ? (
            <div className="next-event-locked" role="status">Choose a weekly focus to unlock Game Day.</div>
          ) : (
            <button className="btn btn-primary btn-block next-event-cta" onClick={() => gameStore.getState().advance()}>
              ▶ Play Game
            </button>
          )}
        </>
      ) : (
        <>
          <div className="next-event-matchup next-event-matchup-plain">
            <div className="next-event-training-icon">🏋️</div>
            <div>
              <div className="next-event-training-title">Training Week</div>
              <div className="faint">No game this week — build your attributes and stay ready.</div>
            </div>
          </div>
          <WeeklyPlan needsWeeklyPlan={needsWeeklyPlan} onChoose={choosePlan} />
          {needsWeeklyPlan ? (
            <div className="next-event-locked" role="status">Choose a weekly focus to continue.</div>
          ) : (
            <button className="btn btn-primary btn-block next-event-cta" onClick={() => gameStore.getState().advance()}>
              Advance Week
            </button>
          )}
        </>
      )}
    </div>
  );
}

function WeeklyPlan({ needsWeeklyPlan, onChoose }: { needsWeeklyPlan: boolean; onChoose: (focus: TrainingSelection) => void }) {
  if (!needsWeeklyPlan) {
    return <div className="weekly-plan-status"><span aria-hidden="true">✓</span> Weekly focus selected. Your next decision is ready.</div>;
  }
  return (
    <section className="weekly-plan" aria-labelledby="weekly-plan-title">
      <div className="weekly-plan-heading">
        <div>
          <div className="weekly-plan-kicker">BEFORE GAME DAY</div>
          <h2 id="weekly-plan-title">Set this week's priority</h2>
        </div>
        <span>Real trade-offs</span>
      </div>
      <div className="weekly-plan-options">
        <button type="button" className="weekly-plan-option" onClick={() => onChoose("position_specific")}>
          <strong>🏋️ Position work</strong><span>Key position skills grow; you go straight to the next event.</span>
        </button>
        <button type="button" className="weekly-plan-option" onClick={() => onChoose("mental")}>
          <strong>📚 School & film</strong><span>Decision-making, composure and pressure handling get the focus.</span>
        </button>
        <button type="button" className="weekly-plan-option" onClick={() => onChoose("recovery")}>
          <strong>🛌 Recover</strong><span>Prioritise morale and recovery over faster attribute growth.</span>
        </button>
      </div>
      <div className="weekly-plan-links" aria-label="Off-field decisions">
        <button type="button" onClick={() => gameStore.getState().navigate("relationships")}>People <span>Relationships & media choices</span></button>
        <button type="button" onClick={() => gameStore.getState().navigate("news")}>Reputation <span>Review active headlines</span></button>
      </div>
    </section>
  );
}
