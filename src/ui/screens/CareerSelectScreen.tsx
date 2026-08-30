import { useEffect, useState } from "react";
import { useGameStore, gameStore } from "@store/gameStore";
import { STAGE_LABELS } from "../format";
import { FREE_TIER_CAREER_LIMIT } from "@data/index";
import { InviteFriendsCard } from "@ui/components/InviteFriendsCard";
import { PositionBadge } from "@ui/components/PositionBadge";
import { PlayerHeroArt } from "@ui/components/PlayerHeroArt";
import { ConfirmModal } from "@ui/components/ConfirmModal";

export function CareerSelectScreen() {
  const careers = useGameStore((s) => s.careers);
  const loading = useGameStore((s) => s.loading);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; playerName: string } | null>(null);

  useEffect(() => {
    void gameStore.getState().refreshCareers();
  }, []);

  const atLimit = careers.length >= FREE_TIER_CAREER_LIMIT;
  const hasCareers = !loading && careers.length > 0;
  const featured = hasCareers ? careers[0] : null;

  return (
    <div className="homepage-page">
      <header className={`homepage-hero ${hasCareers ? "homepage-hero-compact" : ""}`}>
        <PlayerHeroArt className="homepage-hero-art" />
        <div className="homepage-hero-content">
          <div className="brand" style={{ fontSize: 20, marginBottom: hasCareers ? 18 : 40 }}>
            <span className="brand-mark">GL</span>
            GRIDIRON LIFE
          </div>

          {!hasCareers ? (
            <>
              <div className="homepage-eyebrow">LIVE AN ENTIRE CAREER</div>
              <h1 className="homepage-headline">
                YOUR CAREER
                <br />
                AWAITS
              </h1>
              <p className="homepage-subtitle">From high school freshman to the Hall of Fame. Every decision is yours.</p>
              <button
                className="btn btn-primary btn-lg homepage-cta"
                disabled={atLimit || loading}
                onClick={() => gameStore.setState({ screen: "create-player" })}
              >
                {loading ? "Loading…" : "▶ START CAREER"}
              </button>
            </>
          ) : (
            <>
              <div className="homepage-eyebrow">{featured?.playerName.toUpperCase()}</div>
              <h1 className="homepage-headline homepage-headline-sm">
                {STAGE_LABELS[featured!.stage] ?? featured!.stage}
                <span className="homepage-headline-dot"> · </span>
                OVR {featured!.overall}
              </h1>
            </>
          )}
        </div>
      </header>

      <main className="homepage-body" id="career-select-main">
        {loading && <div className="faint" style={{ textAlign: "center" }}>Loading your careers…</div>}

        {hasCareers && (
          <div className="list" style={{ marginBottom: 20 }}>
            {careers.map((c) => (
              <article
                key={c.id}
                className="card card-tight career-card"
              >
                <button
                  type="button"
                  className="career-card-open"
                  aria-label={`Continue ${c.playerName}'s career, ${STAGE_LABELS[c.stage] ?? c.stage}, overall ${c.overall}`}
                  onClick={() => void gameStore.getState().openCareer(c.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <PositionBadge position={c.position} size={48} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.playerName}</div>
                      <div className="faint" style={{ fontSize: 12.5 }}>
                        {STAGE_LABELS[c.stage] ?? c.stage} · Age {c.age} · OVR {c.overall}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label={`Delete ${c.playerName}'s career`}
                  onClick={() => {
                    setPendingDelete({ id: c.id, playerName: c.playerName });
                  }}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}

        {hasCareers && (
          <button
            className="btn btn-primary btn-block"
            disabled={atLimit}
            onClick={() => gameStore.setState({ screen: "create-player" })}
          >
            {atLimit ? `Free tier limit reached (${FREE_TIER_CAREER_LIMIT} careers)` : "Start a New Career"}
          </button>
        )}
        {atLimit && <p className="faint" style={{ textAlign: "center", marginTop: 10 }}>Delete an existing career to start a new one.</p>}

        {careers.some((career) => career.referralUnlocked) && (
          <div style={{ marginTop: 24, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            <InviteFriendsCard />
          </div>
        )}
      </main>

      <footer className="homepage-footer">GRIDIRON LIFE · Original football fiction</footer>

      {pendingDelete && (
        <ConfirmModal
          title="Delete this career?"
          body={`This permanently deletes ${pendingDelete.playerName}'s career — every season, stat, and save. This can't be undone.`}
          confirmLabel="Delete Career"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void gameStore.getState().deleteCareer(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
