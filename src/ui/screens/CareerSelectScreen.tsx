import { useEffect } from "react";
import { useGameStore, gameStore } from "@store/gameStore";
import { STAGE_LABELS } from "../format";
import { FREE_TIER_CAREER_LIMIT } from "@data/index";
import { InviteFriendsCard } from "@ui/components/InviteFriendsCard";
import { PositionBadge } from "@ui/components/PositionBadge";

export function CareerSelectScreen() {
  const careers = useGameStore((s) => s.careers);
  const loading = useGameStore((s) => s.loading);

  useEffect(() => {
    void gameStore.getState().refreshCareers();
  }, []);

  const atLimit = careers.length >= FREE_TIER_CAREER_LIMIT;

  return (
    <div className="centered-page">
      <div className="onboarding-card">
        <div className="brand" style={{ justifyContent: "center", fontSize: 26, marginBottom: 8 }}>
          <span className="brand-mark">GL</span>
          GRIDIRON LIFE
        </div>
        <p className="page-subtitle" style={{ textAlign: "center" }}>
          Live an entire football career — from high school to the Hall of Fame.
        </p>

        {loading && <div className="faint" style={{ textAlign: "center" }}>Loading your careers…</div>}

        {!loading && careers.length > 0 && (
          <div className="list" style={{ marginBottom: 20 }}>
            {careers.map((c) => (
              <div key={c.id} className="card card-tight career-card" onClick={() => void gameStore.getState().openCareer(c.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <PositionBadge position={c.position} size={48} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.playerName}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {STAGE_LABELS[c.stage] ?? c.stage} · Age {c.age} · OVR {c.overall}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void gameStore.getState().deleteCareer(c.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          disabled={atLimit}
          onClick={() => gameStore.setState({ screen: "create-player" })}
        >
          {atLimit ? `Free tier limit reached (${FREE_TIER_CAREER_LIMIT} careers)` : "Start a New Career"}
        </button>
        {atLimit && <p className="faint" style={{ textAlign: "center", marginTop: 10 }}>Delete an existing career to start a new one.</p>}

        <div style={{ marginTop: 24 }}>
          <InviteFriendsCard />
        </div>
      </div>
    </div>
  );
}
