import { gameStore, useGameStore } from "@store/gameStore";
import { SUBSCRIPTION_PRICE_USD, SUBSCRIPTION_PERIOD_LABEL } from "@data/auth";

export function SubscriptionScreen() {
  const session = useGameStore((s) => s.session);

  return (
    <div className="centered-page">
      <div className="onboarding-card">
        <div className="brand" style={{ justifyContent: "center", fontSize: 24, marginBottom: 8 }}>
          <span className="brand-mark">NL</span>
          NFL LIFE
        </div>
        <p className="page-subtitle" style={{ textAlign: "center", marginBottom: 4 }}>
          Hi, {session?.username}. Just one step left.
        </p>

        <div className="card" style={{ textAlign: "center", marginTop: 18, marginBottom: 18 }}>
          <div className="section-title">NFL LIFE Subscription</div>
          <div style={{ fontSize: 40, fontWeight: 800, margin: "10px 0" }}>
            ${SUBSCRIPTION_PRICE_USD}
            <span style={{ fontSize: 16, fontWeight: 500 }}> / {SUBSCRIPTION_PERIOD_LABEL}</span>
          </div>
          <p className="faint">Unlimited access to every career, no ads. Cancel anytime.</p>
        </div>

        <div className="auth-note" style={{ marginBottom: 16 }}>
          Demo environment: no real payment processor is connected to this instance, so no card is requested and no
          real charge happens. The button below simulates a successful payment so you can test the full product. In a
          real deployment, this would be replaced by a real checkout (e.g. Stripe).
        </div>

        <button className="btn btn-primary btn-block" onClick={() => gameStore.getState().subscribe()}>
          Simulate ${SUBSCRIPTION_PRICE_USD}/{SUBSCRIPTION_PERIOD_LABEL} subscription
        </button>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => gameStore.getState().logoutAccount()}>
          Log Out
        </button>
      </div>
    </div>
  );
}
