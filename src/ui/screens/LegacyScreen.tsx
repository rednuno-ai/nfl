import { useGameStore, gameStore } from "@store/gameStore";
import { canRetire } from "@engine/career";
import { LEGACY_TIER_LABELS } from "@engine/legacy";
import { LegacyMedal } from "@ui/components/LegacyMedal";
import { money } from "../format";

export function LegacyScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const unlocked = state.achievements.filter((a) => a.unlockedWeek !== null);
  const locked = state.achievements.filter((a) => a.unlockedWeek === null);

  return (
    <div>
      <div className="screen-eyebrow">🏆 LEGACY</div>
      <div className="page-title">Legacy</div>

      {state.legacy && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="modal-eyebrow">Final Verdict</div>
          <div style={{ fontSize: 30, fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: 6, display: "flex", alignItems: "center", gap: 14 }}>
            <LegacyMedal tier={state.legacy.tier} size={56} />
            {LEGACY_TIER_LABELS[state.legacy.tier]}
          </div>
          <p className="muted" style={{ marginBottom: 16 }}>
            {state.legacy.summary}
          </p>
          <div className="grid grid-4">
            <div className="stat-tile">
              <div className="value">{state.legacy.seasonsPlayed}</div>
              <div className="label">Seasons</div>
            </div>
            <div className="stat-tile">
              <div className="value">{state.legacy.championships}</div>
              <div className="label">Championships</div>
            </div>
            <div className="stat-tile">
              <div className="value">{state.legacy.proBowls}</div>
              <div className="label">Pro Bowls</div>
            </div>
            <div className="stat-tile">
              <div className="value">{money(state.legacy.careerEarnings)}</div>
              <div className="label">Career Earnings</div>
            </div>
          </div>
        </div>
      )}

      {!state.retired && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="section-title">Retirement</div>
          <p className="muted" style={{ marginBottom: 12 }}>
            {canRetire(state) ? "You can retire at any time once you're in the NFL." : "Retirement becomes available once you reach the NFL."}
          </p>
          <button className="btn" disabled={!canRetire(state)} onClick={() => gameStore.getState().retire()}>
            Retire Now
          </button>
        </div>
      )}

      <div className="section-title">Achievements ({unlocked.length}/{state.achievements.length})</div>
      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Unlocked</div>
          <div className="list">
            {unlocked.map((a) => (
              <div className="list-item" key={a.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏅</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {a.description}
                    </div>
                  </div>
                </div>
                <span className="badge badge-gold">Week {a.unlockedWeek}</span>
              </div>
            ))}
            {unlocked.length === 0 && <p className="faint">None yet.</p>}
          </div>
        </div>
        <div className="card">
          <div className="section-title">Locked</div>
          <div className="list">
            {locked.map((a) => (
              <div className="list-item" key={a.id} style={{ opacity: 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {a.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
