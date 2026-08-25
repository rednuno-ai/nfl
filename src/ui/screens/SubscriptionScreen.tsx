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
          Olá, {session?.username}. Falta só um passo.
        </p>

        <div className="card" style={{ textAlign: "center", marginTop: 18, marginBottom: 18 }}>
          <div className="section-title">Assinatura NFL LIFE</div>
          <div style={{ fontSize: 40, fontWeight: 800, margin: "10px 0" }}>
            ${SUBSCRIPTION_PRICE_USD}
            <span style={{ fontSize: 16, fontWeight: 500 }}> / {SUBSCRIPTION_PERIOD_LABEL}</span>
          </div>
          <p className="faint">Acesso ilimitado a todas as carreiras, sem anúncios. Cancela quando quiseres.</p>
        </div>

        <div className="auth-note" style={{ marginBottom: 16 }}>
          Ambiente de demonstração: nenhum processador de pagamentos real está ligado a esta instância, por isso nenhum
          cartão é pedido e nenhuma cobrança real acontece. O botão abaixo simula um pagamento bem-sucedido para que
          possas testar o produto completo. Numa implantação real, isto seria substituído por um checkout real (ex.
          Stripe).
        </div>

        <button className="btn btn-primary btn-block" onClick={() => gameStore.getState().subscribe()}>
          Simular assinatura de ${SUBSCRIPTION_PRICE_USD}/{SUBSCRIPTION_PERIOD_LABEL}
        </button>

        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => gameStore.getState().logoutAccount()}>
          Sair
        </button>
      </div>
    </div>
  );
}
