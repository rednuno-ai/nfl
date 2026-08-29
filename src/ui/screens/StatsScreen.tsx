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
      <div className="page-title">Career Stats</div>

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
        {(position === "LB" || position === "CB") && (
          <>
            <StatTile label="Tackles" value={totals.tackles} />
            <StatTile label="Sacks" value={totals.sacks} />
            <StatTile label="Interceptions" value={totals.interceptions} />
            <StatTile label="Passes Defended" value={totals.passesDefended} />
          </>
        )}
        <StatTile label="Games Played" value={totals.gamesPlayed} />
      </div>

      <div className="section-title">Season by Season</div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>Season</th>
              <th style={{ padding: "6px 10px" }}>Level</th>
              <th style={{ padding: "6px 10px" }}>G</th>
              <th style={{ padding: "6px 10px" }}>Pass Yds</th>
              <th style={{ padding: "6px 10px" }}>Rush Yds</th>
              <th style={{ padding: "6px 10px" }}>Rec Yds</th>
              <th style={{ padding: "6px 10px" }}>Tackles</th>
              <th style={{ padding: "6px 10px" }}>Sacks</th>
              <th style={{ padding: "6px 10px" }}>INT</th>
              <th style={{ padding: "6px 10px" }}>Awards</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons, ...(currentSeason ? [currentSeason] : [])].map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px" }}>{s.season || "current"}</td>
                <td style={{ padding: "8px 10px" }}>
                  {LEVEL_ICON[s.level] ?? "🏈"} {LEVEL_LABELS[s.level] ?? s.level}
                </td>
                <td style={{ padding: "8px 10px" }}>{s.gamesPlayed}</td>
                <td style={{ padding: "8px 10px" }}>{s.passYards}</td>
                <td style={{ padding: "8px 10px" }}>{s.rushYards}</td>
                <td style={{ padding: "8px 10px" }}>{s.receivingYards}</td>
                <td style={{ padding: "8px 10px" }}>{s.tackles}</td>
                <td style={{ padding: "8px 10px" }}>{s.sacks}</td>
                <td style={{ padding: "8px 10px" }}>{s.interceptions}</td>
                <td style={{ padding: "8px 10px" }}>
                  {s.mvp && <span className="badge badge-gold">MVP</span>} {s.allPro && <span className="badge badge-accent">All-Pro</span>}{" "}
                  {s.proBowl && <span className="badge">Pro Bowl</span>} {s.championshipWon && <span className="badge badge-green">Champion</span>}
                </td>
              </tr>
            ))}
            {seasons.length === 0 && !currentSeason && (
              <tr>
                <td colSpan={10} className="faint" style={{ padding: "14px 10px" }}>
                  No completed seasons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
