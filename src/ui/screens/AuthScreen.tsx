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
          Live an entire football career — from high school to the Hall of Fame.
        </p>

        <div className="auth-layout">
          <div className="auth-demo">
            <video className="auth-demo-video" src="./demo.webm" autoPlay muted loop playsInline>
              Your browser doesn't support video.
            </video>
            <p className="faint" style={{ marginTop: 10, fontSize: 12.5 }}>
              A real career played start to finish — from high school to retirement.
            </p>
          </div>

          <form className="card auth-form" onSubmit={submit}>
            <div className="auth-tabs">
              <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>
                Log In
              </button>
              <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => setMode("register")}>
                Create Account
              </button>
            </div>

            <div className="field">
              <label>Username</label>
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
                🎟️ You were invited with code <strong>{referralCode}</strong>.
              </p>
            )}

            {authError && <div className="auth-error">{authError}</div>}

            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} type="submit" disabled={authBusy || !username || !password}>
              {authBusy ? "Processing…" : mode === "login" ? "Log In" : "Create Account"}
            </button>

            <p className="faint" style={{ marginTop: 12, fontSize: 12 }}>
              Registration is required to play. Demo account: <strong>adm</strong> / <strong>adm</strong>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
