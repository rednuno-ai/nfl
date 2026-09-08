import { useState, type FormEvent } from "react";
import { gameStore, useGameStore } from "@store/gameStore";
import { DEMO_ACCOUNT_USERNAME, usesRemoteAuth } from "@data/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, validateRegistrationInput } from "@data/authValidation";
import { publicCopy } from "@ui/copy";

type AuthMode = "login" | "register" | "recover";

function referralCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref");
  return code && code.trim() ? code.trim() : null;
}

export function AuthScreen() {
  const referralCode = useState(() => referralCodeFromUrl())[0];
  const [mode, setMode] = useState<AuthMode>(referralCode ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [notice, setNotice] = useState("");
  const [submittedRegistration, setSubmittedRegistration] = useState(false);
  const authError = useGameStore((s) => s.authError);
  const authBusy = useGameStore((s) => s.authBusy);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice("");
    setSubmittedRegistration(false);
    gameStore.setState({ authError: null });
  }

  async function useDemo() {
    setMode("login");
    setNotice(publicCopy.demo.opening);
    gameStore.setState({ authError: null });
    // The shared demo is reset only after an authenticated demo sign-in.
    // This gives every visitor a clean entry while never touching real users.
    await gameStore.getState().loginAccount("adm", "adm");
    if (!gameStore.getState().session) return;
    const reset = await gameStore.getState().resetDemoProfile();
    if (!reset) return;
    await gameStore.getState().loginAccount("adm", "adm");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "login") void gameStore.getState().loginAccount(username, password);
    else if (mode === "register") {
      setSubmittedRegistration(true);
      if (!validateRegistrationInput(username, password, DEMO_ACCOUNT_USERNAME).valid) return;
      void gameStore.getState().registerAccount(username.trim().toLowerCase(), password, referralCode ?? undefined);
    }
    else void gameStore.getState().recoverAccount(username, recoveryKey, password);
  }

  const submitLabel = mode === "login" ? "Log In" : mode === "register" ? "Create Account" : "Reset Password";
  const isReady = mode === "recover" ? Boolean(username && password && recoveryKey) : Boolean(username && password);
  const registration = mode === "register" ? validateRegistrationInput(username, password, DEMO_ACCOUNT_USERNAME) : null;
  const showRegistrationErrors = mode === "register" && submittedRegistration;

  return (
    <div className="auth-page">
      <a className="skip-link" href="#auth-main">Skip to game content</a>
      <header className="auth-header">
        <div className="brand">
          <span className="brand-mark">GL</span>
          GRIDIRON LIFE
        </div>
        <p>Football career simulator</p>
      </header>

      <main id="auth-main" className="auth-main">
        <section className="auth-landing" aria-labelledby="auth-title">
          <div className="auth-heading">
            <div className="screen-eyebrow">YOUR STORY, YOUR CALLS</div>
            <h1 id="auth-title">Build the career. Live the consequences.</h1>
            <p>Start in high school, make the calls on and off the field, and chase a legacy that is yours.</p>
          </div>

          <div className="auth-layout">
            <figure className="auth-demo" aria-labelledby="demo-caption">
              <img className="auth-demo-media" src="/og-image.png" alt="GRIDIRON LIFE game dashboard preview" />
              <figcaption id="demo-caption">
                <strong>See the game at full scale</strong>
                <span>Career choices, game day, news and the life between the snaps.</span>
              </figcaption>
            </figure>

            <section className="card auth-form" aria-labelledby="account-title">
              <h2 id="account-title" className="section-title">Account access</h2>
              <div className="auth-tabs" aria-label="Account actions">
                <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} aria-pressed={mode === "login"} onClick={() => selectMode("login")}>Log In</button>
                <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`} aria-pressed={mode === "register"} onClick={() => selectMode("register")}>Create Account</button>
              </div>

              <form onSubmit={submit} noValidate>
                <div className="field">
                  <label htmlFor="auth-username">Username</label>
                  <input id="auth-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Jordan_23" autoComplete="username" minLength={mode === "register" ? USERNAME_MIN_LENGTH : undefined} maxLength={USERNAME_MAX_LENGTH} aria-invalid={showRegistrationErrors && Boolean(registration?.username)} aria-describedby={mode === "register" ? "auth-username-help" : undefined} />
                  {mode === "register" && <p id="auth-username-help" className={showRegistrationErrors && registration?.username ? "form-help form-help-warning" : "form-help"}>{showRegistrationErrors && registration?.username ? registration.username : "2–31 lowercase letters, numbers, underscores or hyphens. Start with a letter or number."}</p>}
                </div>

                {mode === "recover" && (
                  <div className="field">
                    <label htmlFor="auth-recovery-code">Recovery code</label>
                    <input id="auth-recovery-code" name="recovery-code" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} placeholder="GL-ABCD" autoComplete="off" />
                  </div>
                )}

                <div className="field">
                  <label htmlFor="auth-password">{mode === "recover" ? "New password" : "Password"}</label>
                  <input id="auth-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} aria-invalid={showRegistrationErrors && Boolean(registration?.password)} aria-describedby={mode === "register" ? "auth-password-help" : undefined} />
                  {mode === "register" && <p id="auth-password-help" className={showRegistrationErrors && registration?.password ? "form-help form-help-warning" : "form-help"}>{showRegistrationErrors && registration?.password ? registration.password : "Use 8–128 characters. A passphrase is easiest to remember."}</p>}
                </div>

                {mode === "register" && referralCode && <p className="form-help">Invite code <strong>{referralCode}</strong> will be applied after sign-up.</p>}
                {mode === "recover" && <p className="form-help">Your recovery code is shown in Profile after you sign in. Demo code: <strong>DEMO-2026</strong>.</p>}

                {(authError || notice) && <div className={authError ? "auth-error" : "auth-notice"} role="status">{authError ?? notice}</div>}

                <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} type="submit" disabled={authBusy || !isReady}>
                  {authBusy ? "Processing…" : submitLabel}
                </button>
              </form>

              {mode !== "recover" && <button type="button" className="text-action" onClick={() => selectMode("recover")}>Forgot password?</button>}
              {mode === "recover" && <button type="button" className="text-action" onClick={() => selectMode("login")}>Back to log in</button>}

              <aside className="demo-account-card" aria-label="Resettable demo account">
                <div>
                  <strong>{publicCopy.demo.title}</strong>
                  <span>{publicCopy.demo.detail}</span>
                </div>
                <div className="demo-account-actions">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={authBusy} onClick={() => void useDemo()}>{publicCopy.demo.use}</button>
                </div>
              </aside>
            </section>
          </div>
        </section>
      </main>

      <footer className="auth-footer" aria-label="Account help and legal information">
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
        <a href="#support">Support</a>
        <a href="#account-deletion">Delete account</a>
        <div className="auth-legal-panels">
          <details id="privacy"><summary>Privacy</summary><p>{usesRemoteAuth() ? publicCopy.storage.server : publicCopy.storage.local}</p></details>
          <details id="terms"><summary>Terms</summary><p>GRIDIRON LIFE is a fictional football simulator. Teams, players, marks and stories are original and unaffiliated with the NFL.</p></details>
          <details id="support"><summary>Support</summary><p>Use the demo for a clean, automatic test entry. For account help, keep your recovery code available in Profile.</p></details>
          <details id="account-deletion"><summary>Delete account</summary><p>After signing in, open Profile → Danger Zone → Delete Account. The confirmation explains exactly which saved careers will be removed.</p></details>
        </div>
      </footer>
    </div>
  );
}
