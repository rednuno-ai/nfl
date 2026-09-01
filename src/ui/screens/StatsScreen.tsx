import { useGameStore } from "@store/gameStore";
import { careerTotals, passerRating, yardsPerCarry, yardsPerReception } from "@engine/stats";
import { sumStatLines } from "@engine/stats";

const LEVEL_LABELS: Record<string, string> = { high_school: "High School", college: "College", nfl: "NFL" };
const LEVEL_ICON: Record<string, string> = { high_school: "🏫", college: "🎓", nfl: "🏈" };

export function StatsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const position = state.player.position;
  const seasons = state.statHistory;
  const currentLevel = state.stage === "high_school" || state.stage === "recruiting" ? "high_school" : state.stage === "college" ? "college" : "nfl";
  const currentSeason = state.currentSeasonGameStats.length > 0 ? sumStatLines(state.currentSeasonGameStats, state.seasonYear, currentLevel, "current") : null;
  const totals = careerTotals(seasons);

  return (
    <div>
      <div className="screen-eyebrow">📊 PERFORMANCE</div>
      <h1 className="page-title">Career Stats</h1>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {position === "QB" && (
          <>
            <StatTile label="Pass Yards" value={totals.passYards} />
            <StatTile label="Pass TDs" value={totals.passTDs} />
            <StatTile label="INTs" value={totals.interceptionsThrown} />
            <StatTile label="Passer Rating" value={passerRating(totals)} />
          </>
        )}
        {position === "RB" && (
          <>
            <StatTile label="Rush Yards" value={totals.rushYards} />
            <StatTile label="Rush TDs" value={totals.rushTDs} />
            <StatTile label="Yards / Carry" value={yardsPerCarry(totals)} />
            <StatTile label="Fumbles" value={totals.fumbles} />
          </>
        )}
        {(position === "WR" || position === "TE") && (
          <>
            <StatTile label="Receptions" value={totals.receptions} />
            <StatTile label="Rec. Yards" value={totals.receivingYards} />
            <StatTile label="Rec. TDs" value={totals.receivingTDs} />
            <StatTile label="Yards / Catch" value={yardsPerReception(totals)} />
          </>
        )}
        {(position === "LB" || position === "CB" || position === "DL" || position === "S") && (
          <>
            <StatTile label="Tackles" value={totals.tackles} />
            <StatTile label="Sacks" value={totals.sacks} />
            <StatTile label="Interceptions" value={totals.interceptions} />
            <StatTile label="Passes Defended" value={totals.passesDefended} />
          </>
        )}
        {position === "OL" && (
          <>
            <StatTile label="Blocks Won" value={totals.blocksWon} />
            <StatTile label="Games Started" value={totals.gamesStarted} />
          </>
        )}
        {position === "K" && (
          <>
            <StatTile label="Field Goals" value={totals.fieldGoalsMade} />
            <StatTile label="FG Attempts" value={totals.fieldGoalAttempts} />
            <StatTile label="FG Accuracy" value={percentage(totals.fieldGoalsMade, totals.fieldGoalAttempts)} />
            <StatTile label="Extra Points" value={totals.extraPointsMade} />
          </>
        )}
        {position === "P" && (
          <>
            <StatTile label="Punts" value={totals.punts} />
            <StatTile label="Punt Yards" value={totals.puntYards} />
            <StatTile label="Punt Average" value={average(totals.puntYards, totals.punts)} />
            <StatTile label="Inside 20" value={totals.puntsInside20} />
          </>
        )}
        <StatTile label="Games Played" value={totals.gamesPlayed} />
      </div>

      <h2 className="section-title">Season by Season</h2>
      <div className="card stats-table-card">
        <div className="stats-table-scroll" tabIndex={0} role="region" aria-label="Season by season stats table. Swipe or scroll sideways to view every stat.">
        <table className="stats-table">
          <caption className="sr-only">Season by season statistics. Scroll horizontally on smaller screens for all columns.</caption>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th scope="col">Season</th><th scope="col">Level</th><th scope="col">G</th><th scope="col">Pass Yds</th><th scope="col">Rush Yds</th><th scope="col">Rec Yds</th><th scope="col">Tackles</th><th scope="col">Sacks</th><th scope="col">INT</th><th scope="col">Awards</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons, ...(currentSeason ? [currentSeason] : [])].map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <th scope="row">{s.season || "current"}</th>
                <td>
                  {LEVEL_ICON[s.level] ?? "🏈"} {LEVEL_LABELS[s.level] ?? s.level}
                </td>
                <td>{s.gamesPlayed}</td><td>{s.passYards}</td><td>{s.rushYards}</td><td>{s.receivingYards}</td><td>{s.tackles}</td><td>{s.sacks}</td><td>{s.interceptions}</td>
                <td>
                  {s.mvp && <span className="badge badge-gold">MVP</span>} {s.allPro && <span className="badge badge-accent">All-Pro</span>}{" "}
                  {s.proBowl && <span className="badge">Pro Bowl</span>} {s.championshipWon && <span className="badge badge-green">Champion</span>}
                </td>
              </tr>
            ))}
            {seasons.length === 0 && !currentSeason && (
              <tr>
                <td colSpan={10} className="faint">
                  No completed seasons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <div className="value">{Number.isFinite(value) ? value.toLocaleString() : 0}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function average(total: number, count: number): number {
  return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
}
