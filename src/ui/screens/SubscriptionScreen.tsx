import { gameStore, useGameStore } from "@store/gameStore";
import { SUBSCRIPTION_PRICE_USD, SUBSCRIPTION_PERIOD_LABEL } from "@data/auth";
import { PremiumBadge } from "@ui/components/PremiumBadge";

export function SubscriptionScreen() {
  const session = useGameStore((s) => s.session);

  return (
    <div className="subscription-page">
      <header className="subscription-header">
        <div className="brand" style={{ fontSize: 20 }}>
          <span className="brand-mark">GL</span>
          GRIDIRON LIFE
        </div>
      </header>
      <main className="centered-page" id="subscription-main">
      <div className="onboarding-card">
        <h1 className="page-title" style={{ textAlign: "center" }}>Unlock your career</h1>
        <p className="page-subtitle" style={{ textAlign: "center", marginBottom: 4 }}>
          Hi, {session?.username}. Just one step left.
        </p>

        <div className="card" style={{ textAlign: "center", marginTop: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <PremiumBadge size={72} />
          </div>
          <div className="section-title">GRIDIRON LIFE Subscription</div>
          <div style={{ fontSize: 40, fontWeight: 800, margin: "10px 0" }}>
            ${SUBSCRIPTION_PRICE_USD}
            <span style={{ fontSize: 16, fontWeight: 500 }}> / {SUBSCRIPTION_PERIOD_LABEL}</span>
          </div>
          <p className="faint">Unlimited access to every career, no ads. Cancel anytime.</p>
        </div>

        <div className="auth-note" style={{ marginBottom: 16 }}>
          Demo mode — no card, no charge. This unlocks the full game for testing.
        </div>

        <button className="btn btn-primary btn-block" onClick={() => gameStore.getState().subscribe()}>
          Simulate ${SUBSCRIPTION_PRICE_USD}/{SUBSCRIPTION_PERIOD_LABEL} subscription
        </button>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => gameStore.getState().logoutAccount()}>
          Log Out
        </button>
      </div>
      </main>
      <footer className="subscription-footer">Original football fiction · No real payment processing</footer>
    </div>
  );
}
