import { gameStore } from "@store/gameStore";
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
}: {
  nextGame: ScheduleEntry | undefined;
  ownCrestSeed: { seed: string; label: string } | null;
}) {
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
          <button className="btn btn-primary btn-block next-event-cta" onClick={() => gameStore.getState().advance()}>
            ▶ Play Game
          </button>
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
          <button className="btn btn-primary btn-block next-event-cta" onClick={() => gameStore.getState().advance()}>
            Advance Week
          </button>
        </>
      )}
    </div>
  );
}
