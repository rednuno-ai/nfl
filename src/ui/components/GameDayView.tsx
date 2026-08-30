import { useEffect, useMemo, useRef, useState } from "react";
import type { GameSimState, KeyMomentPrompt } from "@engine/simulation/gameSim";
import { isGameDayObjectiveComplete, objectiveProgress, type GameDayObjective } from "@engine/gameObjectives";
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
const RISK_LABEL: Record<string, string> = { safe: "Safe", balanced: "Balanced", aggressive: "Aggressive" };

const KIND_LABEL: Record<KeyMomentPrompt["kind"], string> = {
  play_call: "Play Call",
  defense_look: "Pre-Snap Read",
  target_priority: "Target Read",
  defense_call: "Defense Call",
  fourth_down_approach: "4th Down",
  fourth_down: "4th Down",
  // Covers both the kick and the 2-point try, so "Extra Point" alone was
  // misleading — the player may see two options here, not just a kick.
  two_point: "Point After Touchdown",
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

type VisualPlay = "idle" | "pass" | "run" | "tackle" | "touchdown" | "first-down" | "turnover";

function visualPlayFor(text = "", scoring = false, turnover = false): VisualPlay {
  if (scoring && /touchdown/i.test(text)) return "touchdown";
  if (turnover) return "turnover";
  if (/first down|moves the chains/i.test(text)) return "first-down";
  if (/sack|tackl|stuffed|no gain/i.test(text)) return "tackle";
  if (/pass|throw|complete|intercept|reception|caught/i.test(text)) return "pass";
  if (/run|rush|scrambl|carry/i.test(text)) return "run";
  return "idle";
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

// "Feel the rewards": when a just-revealed log entry is a player scoring
// play, we pop a short-lived celebration banner. It only ever shows numbers
// that are already real (the score before/after that log entry) — no
// fabricated XP or overall-rating bump, since neither actually changes
// mid-play in this engine. The celebration is purely presentational sugar
// on top of state that was already true.
interface Celebration {
  key: number;
  headline: string;
  scoreBefore: number;
  scoreAfter: number;
}

export function GameDayView({
  game,
  opponentLabel,
  teamLabel,
  playerName,
  playerPosition,
  objective,
  onChoose,
  onFinished,
}: {
  game: GameSimState;
  opponentLabel: string;
  teamLabel: string;
  playerName: string;
  playerPosition: string;
  objective: GameDayObjective;
  onChoose: (optionId: string) => void;
  onFinished: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [speed, setSpeed] = useState(1);
  // A saved game is never allowed to play itself on mount. This also applies
  // when the player returns after visiting another screen or refreshing.
  const [paused, setPaused] = useState(true);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const finishedNotifiedRef = useRef(false);
  const prevRevealedRef = useRef(0);
  const celebrationSeqRef = useRef(0);

  const gameKey = `${game.week}-${game.teamId}-${game.opponentId}`;
  const gameKeyRef = useRef(gameKey);
  useEffect(() => {
    if (gameKeyRef.current !== gameKey) {
      gameKeyRef.current = gameKey;
      finishedNotifiedRef.current = false;
      prevRevealedRef.current = 0;
      setRevealedCount(0);
      setPaused(true);
      setCelebration(null);
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

  // Whenever the reveal cursor moves forward, check the newly-revealed slice
  // for a player touchdown — that's the one moment worth interrupting the
  // ticker for. Runs off revealedCount (not a per-entry effect) so it fires
  // exactly once per reveal step, matching the pace the play-by-play itself
  // advances at.
  useEffect(() => {
    const from = prevRevealedRef.current;
    prevRevealedRef.current = revealedCount;
    if (revealedCount <= from) return;
    // Search from the end so, if several entries land in one reveal step
    // (e.g. after a speed change), the most recent touchdown wins.
    let foundIndex = -1;
    for (let i = revealedCount - 1; i >= from; i--) {
      const e = game.log[i];
      if (e.scoringPlay && e.possession === "player" && e.text.toLowerCase().includes("touchdown")) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex === -1) return;
    const scoreBefore = foundIndex > 0 ? game.log[foundIndex - 1].scorePlayerAfter : 0;
    celebrationSeqRef.current += 1;
    setCelebration({
      key: celebrationSeqRef.current,
      headline: "🔥 TOUCHDOWN!",
      scoreBefore,
      scoreAfter: game.log[foundIndex].scorePlayerAfter,
    });
  }, [revealedCount, game.log]);

  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(() => setCelebration(null), 2200);
    return () => clearTimeout(id);
  }, [celebration]);

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
  const objectiveComplete = game.finished && isGameDayObjectiveComplete(objective, game.stat, game.result);
  const objectiveValue = objective.id === "team_finish" ? (objectiveComplete ? objective.target : 0) : objectiveProgress(objective, game.stat);

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
  const visualPlay = visualPlayFor(latest?.text, latest?.scoringPlay, latest?.turnover);
  const offenseMovesRight = possessionIsPlayer;
  const snapKey = `${revealedCount}-${visualPlay}`;
  const controlledOffense = ["QB", "RB", "WR", "TE", "OL"].includes(playerPosition);
  const controlledClass = (position: string) => controlledOffense && playerPosition === position ? " controlled" : "";

  return (
    <div className="game-day-cinematic" style={{ position: "relative" }}>
      <div className="game-day-cinematic-art" aria-hidden="true" />
      <div className="game-day-cinematic-content">
      {celebration && (
        <div className="td-celebration" key={celebration.key}>
          <div className="td-celebration-headline">{celebration.headline}</div>
          <div className="td-celebration-score">
            {celebration.scoreBefore} → {celebration.scoreAfter}
          </div>
        </div>
      )}

      <h1 className="page-title">Game Day</h1>
      <div className="page-subtitle">
        Week {game.week} · vs {opponentLabel}
      </div>

      <section className={`gameday-objective ${objectiveComplete ? "is-complete" : ""}`} aria-labelledby="gameday-mission-title">
        <div className="gameday-objective-topline"><span>GAME DAY MISSION</span><strong>{objectiveComplete ? "COMPLETE" : `${objectiveValue}/${objective.target}`}</strong></div>
        <h2 className="gameday-objective-title" id="gameday-mission-title">{objective.title}</h2>
        <div className="gameday-objective-copy">{objective.description} <em>{objective.rewardLabel}</em></div>
        <div className="gameday-objective-track"><div style={{ width: `${Math.min(100, (objectiveValue / objective.target) * 100)}%` }} /></div>
      </section>

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
        <button type="button" className={`speed-btn game-resume-control ${paused ? "active" : ""}`} onClick={() => setPaused((p) => !p)} aria-pressed={!paused}>
          {paused ? "▶ Resume Game" : "❚❚ Pause Game"}
        </button>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            className={`speed-btn ${!paused && speed === s ? "active" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="field-wrap">
        <div className={`field-pitch play-${visualPlay} ${offenseMovesRight ? "drive-right" : "drive-left"}`} key={snapKey} aria-label={`Animated field. Ball at the ${Math.round(ballDisplay)} yard line. ${latest?.text ?? "Awaiting kickoff."}`}>
          <div className="field-live-hud"><strong>{quarterLabel}</strong><span>{clockLabel}</span><em>{downDistance || "KICKOFF"}</em></div>
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
            <span aria-hidden="true">◆</span>
          </div>
          <div className="formation" aria-hidden="true">
            <svg className="route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path className="route route-slant" d={offenseMovesRight ? "M 38 18 C 51 18, 60 29, 70 38" : "M 62 18 C 49 18, 40 29, 30 38"} />
              <path className="route route-out" d={offenseMovesRight ? "M 38 80 C 53 80, 62 78, 70 66" : "M 62 80 C 47 80, 38 78, 30 66"} />
              <path className="route route-run" d={offenseMovesRight ? "M 34 65 C 45 60, 52 52, 62 50" : "M 66 65 C 55 60, 48 52, 38 50"} />
            </svg>
            <span className={`field-player offense qb${controlledClass("QB")}`} style={{ left: `${fieldPct(ballDisplay - (offenseMovesRight ? 4 : -4))}%`, top: "47%" }}><i>QB</i>{playerPosition === "QB" && <b>{playerName}</b>}</span>
            <span className={`field-player offense rb${controlledClass("RB")}`} style={{ left: `${fieldPct(ballDisplay - (offenseMovesRight ? 8 : -8))}%`, top: "66%" }}><i>RB</i>{playerPosition === "RB" && <b>{playerName}</b>}</span>
            <span className={`field-player offense wr wr-top${controlledClass("WR")}`} style={{ left: `${fieldPct(ballDisplay - (offenseMovesRight ? 1 : -1))}%`, top: "16%" }}><i>WR</i>{playerPosition === "WR" && <b>{playerName}</b>}</span>
            <span className="field-player offense wr wr-bottom" style={{ left: `${fieldPct(ballDisplay - (offenseMovesRight ? 1 : -1))}%`, top: "79%" }}><i>WR</i></span>
            {[-3, -1.5, 0, 1.5, 3].map((offset, index) => <span key={`ol-${index}`} className="field-player offense lineman" style={{ left: `${fieldPct(ballDisplay)}%`, top: `${38 + offset * 4}%` }} />)}
            {[18, 31, 43, 57, 69, 82].map((top, index) => <span key={`d-${index}`} className={`field-player defense defender defender-${index}${!controlledOffense && index === 0 ? " controlled" : ""}`} style={{ left: `${fieldPct(ballDisplay + (offenseMovesRight ? 5 + (index % 2) * 3 : -5 - (index % 2) * 3))}%`, top: `${top}%` }}>{!controlledOffense && index === 0 && <b>{playerName}</b>}</span>)}
            {visualPlay === "pass" && <span className="pass-flight" />}
          </div>
          {visualPlay !== "idle" && <div className={`play-feedback feedback-${visualPlay}`} role="status">{visualPlay === "first-down" ? "FIRST DOWN" : visualPlay === "touchdown" ? "TOUCHDOWN" : visualPlay === "turnover" ? "TURNOVER" : visualPlay === "tackle" ? "TACKLE" : visualPlay === "pass" ? "PASS" : "RUN"}</div>}
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
        <section className="card" style={{ marginBottom: 20 }} aria-labelledby="game-decision-title">
          <div className="modal-eyebrow">{KIND_LABEL[decision.kind]}</div>
          <h2 className="keymoment-title" id="game-decision-title">{decision.situation}</h2>
          {decision.kind === "play_call" && (
            <div className="decision-context" role="note">
              <strong>Read the moment</strong>
              <span>Position attributes, fatigue ({Math.round(game.fatigue)}%), confidence ({Math.round(game.confidence)}) and the game situation all shape the result. Risk labels describe the trade-off, never a guaranteed outcome.</span>
            </div>
          )}
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
                  <span className={`risk-tag ${RISK_CLASS[option.riskLevel]}`}>{RISK_LABEL[option.riskLevel] ?? option.riskLevel}</span>
                </div>
                <div className="choice-desc">{option.description}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {caughtUp && game.finished && !decision && (
        <section className="card" style={{ marginBottom: 20, textAlign: "center" }} aria-labelledby="game-final-title">
          <div className="modal-eyebrow">Final</div>
          <h2 className="keymoment-title" id="game-final-title">
            {game.result === "win" ? "You win!" : game.result === "loss" ? "You lose." : "It's a tie."} {scorePlayer}-{scoreOpponent}
          </h2>
          {gameStory.length > 0 && (
            <div className="game-story">
              <h2 className="section-title" style={{ marginTop: 16, textAlign: "left" }}>
                Game Story
              </h2>
              {gameStory.map((line, i) => (
                <div key={i} className="game-story-line">
                  {line}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <h2 className="sr-only" id="play-log-title">Play log</h2>
      <details className="play-log-details" aria-labelledby="play-log-title">
        <summary>Play log <span>{revealed.length}</span></summary>
      <div className="play-log" aria-live="polite">
        {revealed.map((entry, i) => (
          <div key={i} className={`play-log-entry ${entry.playerInvolved ? "involved" : ""} ${entry.scoringPlay ? "scoring" : ""}`}>
            {entry.overtime ? "OT" : `Q${entry.quarter}`} · {entry.clockLabel} · {entry.text}
          </div>
        ))}
        {revealed.length === 0 && <div className="faint">Kickoff is coming up...</div>}
      </div>
      </details>
      </div>
    </div>
  );
}
