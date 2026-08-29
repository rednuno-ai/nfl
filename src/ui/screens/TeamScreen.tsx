import { useGameStore } from "@store/gameStore";
import { getCollege } from "@engine/colleges";
import { TeamCrest } from "@ui/components/TeamCrest";

export function TeamScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const college = state.college ? getCollege(state.college.collegeId) : null;

  return (
    <div>
      <div className="screen-eyebrow">🏟️ STADIUM</div>
      <h1 className="page-title">Team</h1>

      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        {state.stage === "high_school" || state.stage === "recruiting" ? (
          <>
            <TeamCrest seed={state.highSchool.schoolName} label={state.highSchool.schoolName} size={64} />
            <div>
              <div className="section-title">High School</div>
              <p className="muted">
                {state.highSchool.schoolName} · {state.highSchool.city}, {state.highSchool.state}
              </p>
              <p className="faint">Coach: {state.highSchool.coachName}</p>
              <p className="faint">
                Star Rating: {"★".repeat(state.highSchool.starRating)}
                {"☆".repeat(5 - state.highSchool.starRating)} ({state.highSchool.starRating}/5)
              </p>
            </div>
          </>
        ) : state.stage === "college" && college && state.college ? (
          <>
            <TeamCrest seed={state.college.collegeId} label={college.mascot ?? college.name} size={64} />
            <div>
              <div className="section-title">College</div>
              <p className="muted">
                {college.name} {college.mascot} · {college.conference}
              </p>
              <p className="faint">Prestige {college.prestige} · Coaching {college.coachingQuality} · Academics {college.academics}</p>
            </div>
          </>
        ) : state.team ? (
          <>
            <TeamCrest seed={state.team.id} label={state.team.abbreviation} size={64} />
            <div>
              <div className="section-title">NFL Team</div>
              <p className="muted">
                {state.team.city} {state.team.name} · {state.team.conference} {state.team.division}
              </p>
              <p className="faint">Head Coach: {state.team.headCoachName}</p>
              <p className="faint">
                Prestige {state.team.prestige} · Roster Strength {state.team.rosterStrength} · Coaching {state.team.coachingQuality}
              </p>
            </div>
          </>
        ) : (
          <p className="muted">No team right now.</p>
        )}
      </div>

      <div className="section-title">Schedule</div>
      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>Week</th>
              <th style={{ padding: "6px 10px" }}>Opponent</th>
              <th style={{ padding: "6px 10px" }}>Location</th>
              <th style={{ padding: "6px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {state.schedule.map((s) => (
              <tr key={s.week} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px" }}>{s.week}</td>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamCrest seed={s.opponentId} label={s.opponentLabel} size={24} />
                    {s.opponentLabel}
                  </div>
                </td>
                <td style={{ padding: "8px 10px" }}>{s.isHome ? "Home" : "Away"}</td>
                <td style={{ padding: "8px 10px" }}>{s.played ? "Played" : s.week === state.weekInSeason ? "This week" : "Upcoming"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
