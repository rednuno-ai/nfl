import type { GameSimState } from "@engine/simulation/gameSim";

const RISK_CLASS: Record<string, string> = { safe: "risk-safe", balanced: "risk-balanced", aggressive: "risk-aggressive" };

export function GameDayView({ game, opponentLabel, onChoose }: { game: GameSimState; opponentLabel: string; teamLabel: string; onChoose: (optionId: string) => void }) {
  const decision = game.pendingDecision;
  return (
    <div>
      <div className="page-title">Game Day</div>
      <div className="page-subtitle">
        Week {game.week} · vs {opponentLabel}
      </div>

      <div className="scoreboard">
        <div className="team">
          <div className="score">{game.scorePlayer}</div>
          <div className="team-label">You</div>
        </div>
        <div className="meta">
          <div>{["1st", "2nd", "3rd", "4th"][game.quarter - 1]} Quarter</div>
          <div className="faint">Fatigue {Math.round(game.fatigue)}%</div>
        </div>
        <div className="team">
          <div className="score">{game.scoreOpponent}</div>
          <div className="team-label">{opponentLabel}</div>
        </div>
      </div>

      {decision && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="modal-eyebrow">Key Moment</div>
          <div className="keymoment-title">{decision.situation}</div>
          <div className="choice-list">
            {decision.options.map((option) => (
              <button key={option.id} className="choice-btn" onClick={() => onChoose(option.id)}>
                <div className="choice-label">
                  {option.label}
                  <span className={`risk-tag ${RISK_CLASS[option.riskLevel]}`}>{option.riskLevel}</span>
                </div>
                <div className="choice-desc">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section-title">Play by Play</div>
      <div className="play-log">
        {game.log.map((entry, i) => (
          <div key={i} className={`play-log-entry ${entry.playerInvolved ? "involved" : ""}`}>
            Q{entry.quarter} · {entry.text}
          </div>
        ))}
        {game.log.length === 0 && <div className="faint">Kickoff is coming up...</div>}
      </div>
    </div>
  );
}
