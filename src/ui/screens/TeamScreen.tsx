import { useGameStore } from "@store/gameStore";
import { getCollege } from "@engine/colleges";

export function TeamScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const college = state.college ? getCollege(state.college.collegeId) : null;

  return (
    <div>
      <div className="page-title">Team</div>
      <p className="page-subtitle">Your program, coach, and schedule.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        {state.stage === "high_school" || state.stage === "recruiting" ? (
          <>
            <div className="section-title">High School</div>
            <p className="muted">
              {state.highSchool.schoolName} · {state.highSchool.city}, {state.highSchool.state}
            </p>
            <p className="faint">Coach: {state.highSchool.coachName}</p>
            <p className="faint">Star Rating: {"★".repeat(state.highSchool.starRating)}{"☆".repeat(5 - state.highSchool.starRating)}</p>
          </>
        ) : state.stage === "college" && college ? (
          <>
            <div className="section-title">College</div>
            <p className="muted">
              {college.name} {college.mascot} · {college.conference}
            </p>
            <p className="faint">Prestige {college.prestige} · Coaching {college.coachingQuality} · Academics {college.academics}</p>
          </>
        ) : state.team ? (
          <>
            <div className="section-title">NFL Team</div>
            <p className="muted">
              {state.team.city} {state.team.name} · {state.team.conference} {state.team.division}
            </p>
            <p className="faint">Head Coach: {state.team.headCoachName}</p>
            <p className="faint">
              Prestige {state.team.prestige} · Roster Strength {state.team.rosterStrength} · Coaching {state.team.coachingQuality}
            </p>
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
                <td style={{ padding: "8px 10px" }}>{s.opponentLabel}</td>
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
