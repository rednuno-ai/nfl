import { useState } from "react";
import { gameStore, useGameStore } from "@store/gameStore";

function referralCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref");
  return code && code.trim() ? code.trim() : null;
}

export function AuthScreen() {
  const referralCode = useState(() => referralCodeFromUrl())[0];
  const [mode, setMode] = useState<"login" | "register">(referralCode ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const authError = useGameStore((s) => s.authError);
  const authBusy = useGameStore((s) => s.authBusy);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") void gameStore.getState().loginAccount(username, password);
    else void gameStore.getState().registerAccount(username, password, referralCode ?? undefined);
  }

  return (
    <div className="centered-page">
      <div className="onboarding-card" style={{ maxWidth: 880 }}>
        <div className="brand" style={{ justifyContent: "center", fontSize: 26, marginBottom: 8 }}>
          <span className="brand-mark">NL</span>
          NFL LIFE
        </div>
        <p className="page-subtitle" style={{ textAlign: "center", marginBottom: 22 }}>
          Vive uma carreira inteira de futebol americano — do liceu ao Hall of Fame.
        </p>

        <div className="auth-layout">
          <div className="auth-demo">
            <video className="auth-demo-video" src="./demo.webm" autoPlay muted loop playsInline>
              O teu browser não suporta vídeo.
            </video>
            <p className="faint" style={{ marginTop: 10, fontSize: 12.5 }}>
              Uma carreira real jogada de ponta a ponta — do liceu à reforma.
            </p>
          </div>

          <form className="card auth-form" onSubmit={submit}>
            <div className="auth-tabs">
              <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
                Entrar
              </button>
              <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
                Criar Conta
              </button>
            </div>

            <div className="field">
              <label>Utilizador</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="adm" autoComplete="username" />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "register" && referralCode && (
              <p className="faint" style={{ marginTop: -6, marginBottom: 4, fontSize: 12 }}>
                🎟️ Foste convidado com o código <strong>{referralCode}</strong>.
              </p>
            )}

            {authError && <div className="auth-error">{authError}</div>}

            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} type="submit" disabled={authBusy || !username || !password}>
              {authBusy ? "A processar…" : mode === "login" ? "Entrar" : "Criar Conta"}
            </button>

            <p className="faint" style={{ marginTop: 12, fontSize: 12 }}>
              É necessário registo para jogar. Conta de demonstração: <strong>adm</strong> / <strong>adm</strong>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
