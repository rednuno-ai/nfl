import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSimState, KeyMomentPrompt } from "@engine/simulation/gameSim";
import { TeamCrest } from "@ui/components/TeamCrest";

// =============================================================================
// Game Day — live, real-time presentation of a play-by-play game.
// -----------------------------------------------------------------------------
// gameSim.ts resolves plays instantly and synchronously (it has to, to stay a
// pure/testable step function) — a single advanceGame() call can return dozens
// of new log entries at once. This view is what turns that into something
// that actually *plays out*: it keeps its own "how many log entries have been
// revealed" cursor and advances it on a speed-controlled timer (à la a
// Football-Manager-style match engine), animating the field and the ticker as
// it goes, and only shows the next decision once the reveal has caught up to
// it. A full ~150-250 play NFL game at the default 1x speed takes roughly the
// ~5 minutes real-world requested; the 2x/3x buttons (and pause) let the
// player control the pace, same as a "speed up match" control.
// =============================================================================

const RISK_CLASS: Record<string, string> = { safe: "risk-safe", balanced: "risk-balanced", aggressive: "risk-aggressive" };

const KIND_LABEL: Record<KeyMomentPrompt["kind"], string> = {
  play_call: "Play Call",
  defense_look: "Pre-Snap Read",
  target_priority: "Target Read",
  defense_call: "Defense Call",
  fourth_down_approach: "4th Down",
  fourth_down: "4th Down",
  two_point: "Extra Point",
};

const DOWN_LABELS = ["1st", "2nd", "3rd", "4th"];
const SPEED_MS: Record<number, number> = { 1: 1900, 2: 950, 3: 480 };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatDownDistance(down: number, distance: number): string {
  if (down < 1 || down > 4) return "";
  return `${DOWN_LABELS[down - 1]} & ${distance}`;
}

function fieldPct(displayYard: number): number {
  // The 0-100 field is drawn across an 8%-92% band, leaving room for the two end zones.
  return 8 + clamp(displayYard, 0, 100) * 0.84;
}

// A short post-game recap built purely from the resolved log — biggest
// storylines (scoring, turnovers, momentum swings, crunch-time 4th downs)
// so a finished game leaves behind more than just a final score.
function buildGameStory(log: GameSimState["log"], teamLabel: string, opponentLabel: string): string[] {
  if (log.length === 0) return [];
  let playerTDs = 0;
  let oppTDs = 0;
  let playerTurnovers = 0;
  let oppTurnovers = 0;
  let momentumSwings = 0;
  let clutchPlays = 0;
  let prevMomentum: string | null = null;

  for (const entry of log) {
    if (entry.scoringPlay && entry.text.toLowerCase().includes("touchdown")) {
      if (entry.possession === "player") playerTDs += 1;
      else oppTDs += 1;
    }
    if (entry.turnover && (entry.text.toLowerCase().includes("intercept") || entry.text.toLowerCase().includes("fumbl") || entry.text.toLowerCase().includes("picked off"))) {
      if (entry.possession === "player") playerTurnovers += 1;
      else oppTurnovers += 1;
    }
    if (prevMomentum !== null && entry.momentum !== prevMomentum) momentumSwings += 1;
    prevMomentum = entry.momentum;
    if ((entry.quarter === 4 || entry.overtime) && entry.down === 4 && entry.playerInvolved) clutchPlays += 1;
  }

  const lines: string[] = [];
  if (playerTDs || oppTDs) {
    lines.push(`${teamLabel} found the end zone ${playerTDs} time${playerTDs === 1 ? "" : "s"}; ${opponentLabel} answered with ${oppTDs}.`);
  }
  if (playerTurnovers || oppTurnovers) {
    lines.push(`Turnovers: ${teamLabel} ${playerTurnovers}, ${opponentLabel} ${oppTurnovers}.`);
  }
  if (momentumSwings > 0) {
    lines.push(`The momentum swung ${momentumSwings} time${momentumSwings === 1 ? "" : "s"} over the course of the game.`);
  }
  if (clutchPlays > 0) {
    lines.push(`${clutchPlays} 4th-down decision${clutchPlays === 1 ? "" : "s"} came down to the wire in the final period.`);
  }
  return lines;
}

export function GameDayView({
  game,
  opponentLabel,
  teamLabel,
  onChoose,
  onFinished,
}: {
  game: GameSimState;
  opponentLabel: string;
  teamLabel: string;
  onChoose: (optionId: string) => void;
  onFinished: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const finishedNotifiedRef = useRef(false);

  const gameKey = `${game.week}-${game.teamId}-${game.opponentId}`;
  const gameKeyRef = useRef(gameKey);
  useEffect(() => {
    if (gameKeyRef.current !== gameKey) {
      gameKeyRef.current = gameKey;
      finishedNotifiedRef.current = false;
      setRevealedCount(0);
      setPaused(false);
    }
  }, [gameKey]);

  const totalEntries = game.log.length;
  const caughtUp = revealedCount >= totalEntries;

  // Advance the reveal cursor on a speed-controlled timer.
  useEffect(() => {
    if (paused || caughtUp) return;
    const id = setTimeout(() => setRevealedCount((c) => Math.min(c + 1, totalEntries)), SPEED_MS[speed]);
    return () => clearTimeout(id);
  }, [paused, caughtUp, revealedCount, speed, totalEntries]);

  // Once the reveal has caught up to a finished game, fold the result into
  // the career exactly once.
  useEffect(() => {
    if (caughtUp && game.finished && !finishedNotifiedRef.current) {
      finishedNotifiedRef.current = true;
      onFinished();
    }
  }, [caughtUp, game.finished, onFinished]);

  const revealed = useMemo(() => game.log.slice(0, revealedCount), [game.log, revealedCount]);
  const latest = revealed[revealed.length - 1];
  const gameStory = useMemo(
    () => (game.finished ? buildGameStory(game.log, teamLabel || "You", opponentLabel) : []),
    [game.finished, game.log, teamLabel, opponentLabel]
  );

  const decision = game.pendingDecision;
  const showDecision = caughtUp && !!decision;

  const quarterLabel = latest ? (latest.overtime ? "OT" : `Q${latest.quarter}`) : "Q1";
  const clockLabel = latest ? latest.clockLabel : "15:00";
  const scorePlayer = latest ? latest.scorePlayerAfter : 0;
  const scoreOpponent = latest ? latest.scoreOpponentAfter : 0;
  const possessionIsPlayer = latest ? latest.possession === "player" : true;
  const ballDisplay = latest ? latest.displayBallOnAfter : 25;
  const downDistance = latest && latest.down >= 1 ? formatDownDistance(latest.down, latest.distance) : "";
  const firstDownDisplay =
    latest && latest.down >= 1 ? clamp(possessionIsPlayer ? ballDisplay + latest.distance : ballDisplay - latest.distance, 0, 100) : null;

  return (
    <div>
      <div className="page-title">Game Day</div>
      <div className="page-subtitle">
        Week {game.week} · vs {opponentLabel}
      </div>

      <div className="scoreboard">
        <div className="team">
          <TeamCrest seed={game.teamId} label={(teamLabel || "You").slice(0, 3)} size={36} />
          <div className="score">{scorePlayer}</div>
          <div className="team-label">
            {possessionIsPlayer && <span className="possession-dot" />}
            {teamLabel || "You"}
          </div>
        </div>
        <div className="meta">
          <div>
            {quarterLabel} · {clockLabel}
          </div>
          {downDistance && <div className="faint">{downDistance}</div>}
          <div className="faint">Fatigue {Math.round(game.fatigue)}%</div>
        </div>
        <div className="team">
          <TeamCrest seed={game.opponentId} label={opponentLabel.slice(0, 3)} size={36} />
          <div className="score">{scoreOpponent}</div>
          <div className="team-label">
            {!possessionIsPlayer && <span className="possession-dot" />}
            {opponentLabel}
          </div>
        </div>
      </div>

      <div className="speed-controls">
        <button className={`speed-btn ${paused ? "active" : ""}`} onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"}>
          {paused ? "▶" : "❚❚"}
        </button>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            className={`speed-btn ${!paused && speed === s ? "active" : ""}`}
            onClick={() => {
              setSpeed(s);
              setPaused(false);
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="field-wrap">
        <div className="field-pitch">
          <div className="field-endzone field-endzone-left">
            <TeamCrest seed={game.teamId} label={(teamLabel || "You").slice(0, 3)} size={26} />
          </div>
          <div className="field-endzone field-endzone-right">
            <TeamCrest seed={game.opponentId} label={opponentLabel.slice(0, 3)} size={26} />
          </div>
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((yard) => (
            <div key={yard} className={`field-yardline ${yard === 50 ? "field-yardline-mid" : ""}`} style={{ left: `${fieldPct(yard)}%` }} />
          ))}
          {firstDownDisplay !== null && <div className="field-marker field-marker-firstdown" style={{ left: `${fieldPct(firstDownDisplay)}%` }} />}
          <div className="field-marker field-marker-los" style={{ left: `${fieldPct(ballDisplay)}%` }} />
          <div className={`field-ball ${possessionIsPlayer ? "" : "field-ball-opponent"}`} style={{ left: `${fieldPct(ballDisplay)}%` }}>
            🏈
          </div>
        </div>
      </div>

      <div className="ticker">
        {latest ? (
          <>
            <span className="ticker-tag">{possessionIsPlayer ? teamLabel || "You" : opponentLabel}</span> {latest.text}
          </>
        ) : (
          <span className="faint">Kickoff is coming up...</span>
        )}
      </div>

      {showDecision && decision && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="modal-eyebrow">{KIND_LABEL[decision.kind]}</div>
          <div className="keymoment-title">{decision.situation}</div>
          {decision.defenseIntel && (
            <div className="intel-banner">
              <div>{decision.defenseIntel.note}</div>
              <div className="intel-probs">
                <span>Run success {decision.defenseIntel.runProb}%</span>
                <span>Pass success {decision.defenseIntel.passProb}%</span>
              </div>
            </div>
          )}
          {decision.analystNote && decision.kind === "defense_call" && <div className="intel-banner">{decision.analystNote}</div>}
          {decision.momentumNote && (
            <div className={`momentum-banner ${decision.momentumNote.startsWith("🔥") ? "momentum-hot" : "momentum-shaken"}`}>
              {decision.momentumNote}
            </div>
          )}
          {decision.defenseLookNote && decision.kind === "defense_look" && <div className="intel-banner defense-look-banner">{decision.defenseLookNote}</div>}
          <div className="choice-list">
            {decision.options.map((option) => (
              <button key={option.id} className="choice-btn" onClick={() => onChoose(option.id)}>
                <div className="choice-label">
                  <span className="choice-icon">{option.icon}</span>
                  {option.label}
                  <span className={`risk-tag ${RISK_CLASS[option.riskLevel]}`}>{option.riskLevel}</span>
                </div>
                <div className="choice-desc">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {caughtUp && game.finished && !decision && (
        <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
          <div className="modal-eyebrow">Final</div>
          <div className="keymoment-title">
            {game.result === "win" ? "You win!" : game.result === "loss" ? "You lose." : "It's a tie."} {scorePlayer}-{scoreOpponent}
          </div>
          {gameStory.length > 0 && (
            <div className="game-story">
              <div className="section-title" style={{ marginTop: 16, textAlign: "left" }}>
                Game Story
              </div>
              {gameStory.map((line, i) => (
                <div key={i} className="game-story-line">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="section-title">Play by Play</div>
      <div className="play-log">
        {revealed.map((entry, i) => (
          <div key={i} className={`play-log-entry ${entry.playerInvolved ? "involved" : ""} ${entry.scoringPlay ? "scoring" : ""}`}>
            {entry.overtime ? "OT" : `Q${entry.quarter}`} · {entry.clockLabel} · {entry.text}
          </div>
        ))}
        {revealed.length === 0 && <div className="faint">Kickoff is coming up...</div>}
      </div>
    </div>
  );
}
