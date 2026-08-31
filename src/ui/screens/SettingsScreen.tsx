import { useState, type FormEvent } from "react";
import { useGameStore, gameStore } from "@store/gameStore";
import { isDemoAccount } from "@data/auth";
import { createAccountExport } from "@data/accountExport";
import { InviteFriendsCard } from "@ui/components/InviteFriendsCard";
import { ConfirmModal } from "@ui/components/ConfirmModal";

export function SettingsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const authError = useGameStore((s) => s.authError);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAccountDelete, setConfirmingAccountDelete] = useState(false);
  const [confirmingDemoReset, setConfirmingDemoReset] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const demoAccount = isDemoAccount(currentUser?.username);
  const referralUnlocked =
    state.currentSeasonGameStats.some((line) => line.gamesPlayed > 0) ||
    state.statHistory.some((line) => line.gamesPlayed > 0) ||
    state.achievements.some((achievement) => achievement.unlockedWeek !== null);

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice("");
    const changed = await gameStore.getState().changePassword(currentPassword, nextPassword);
    if (changed) {
      setCurrentPassword("");
      setNextPassword("");
      setPasswordNotice("Password updated on this device.");
    }
  }

  async function downloadData() {
    const data = currentUser ? await createAccountExport(currentUser.username) : null;
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gridiron-life-${currentUser?.username ?? "account"}-export.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div>
      <div className="screen-eyebrow">👤 PROFILE</div>
      <h1 className="page-title">Settings</h1>

      <section className="card" id="account-settings" style={{ marginBottom: 20 }} aria-labelledby="account-settings-title">
        <h2 className="section-title" id="account-settings-title">👤 Account</h2>
        <p className="muted">Signed in as {session?.username}</p>
        <button className="btn btn-ghost" onClick={() => gameStore.getState().logoutAccount()}>
          Sign Out
        </button>
      </section>

      <section className="card recovery-card" aria-labelledby="recovery-title">
        <h2 className="section-title" id="recovery-title">Password recovery</h2>
        <p className="muted">Keep this code private. It can reset this local account from the login screen.</p>
        <details>
          <summary>Show recovery code</summary>
          <code>{currentUser?.recoveryKey ?? "Unavailable"}</code>
        </details>
      </section>

      <section className="card" style={{ marginBottom: 20 }} aria-labelledby="password-title">
        <h2 className="section-title" id="password-title">Change password</h2>
        <p className="muted">New player passwords use at least 8 characters. The public demo keeps its documented test credentials.</p>
        <form className="settings-password-form" onSubmit={(event) => void submitPasswordChange(event)}>
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={demoAccount ? 3 : 8} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
          </div>
          <button className="btn btn-ghost" type="submit" disabled={!currentPassword || !nextPassword}>Update Password</button>
          {(passwordNotice || authError) && <p className="form-help" role="status">{passwordNotice || authError}</p>}
        </form>
      </section>

      <section className="card" style={{ marginBottom: 20 }} aria-labelledby="export-title">
        <h2 className="section-title" id="export-title">Download your data</h2>
        <p className="muted">Download a JSON copy of this account and its careers. Passwords, hashes and recovery codes are never included.</p>
        <button className="btn btn-ghost" type="button" onClick={() => void downloadData()}>Download Data</button>
      </section>

      <section className="card" style={{ marginBottom: 20 }} aria-labelledby="metrics-title">
        <h2 className="section-title" id="metrics-title">Local product metrics</h2>
        <p className="muted">This device keeps anonymous counters for onboarding, game progress, broad choice categories and recovery errors. They are never sent to a server and do not include your name, career details, password, recovery code, device or IP address.</p>
      </section>

      {demoAccount && (
        <section className="card demo-reset-card" aria-labelledby="demo-reset-title">
          <h2 className="section-title" id="demo-reset-title">Demo account</h2>
          <p className="muted">Reset Demo Account removes only the demo careers stored in this browser and returns the demo to a clean starting state. Normal accounts are never touched.</p>
          <button className="btn btn-ghost" onClick={() => setConfirmingDemoReset(true)}>Reset Demo Account</button>
        </section>
      )}

      {referralUnlocked ? <InviteFriendsCard /> : (
        <section className="card referral-locked-card" aria-labelledby="referral-locked-title">
          <h2 className="section-title" id="referral-locked-title">Invite rewards</h2>
          <p className="muted">Complete your first game or unlock an achievement to share your career.</p>
        </section>
      )}

      <section className="card" style={{ marginBottom: 20 }} aria-labelledby="career-info-title">
        <h2 className="section-title" id="career-info-title">🏈 Career Info</h2>
        <p className="muted">Weeks played: {state.totalWeek}</p>
      </section>

      <section className="card" id="account-deletion" aria-labelledby="danger-zone-title">
        <h2 className="section-title" id="danger-zone-title">⚠️ Danger Zone</h2>
        <button className="btn" onClick={() => setConfirmingDelete(true)}>
          Delete This Career
        </button>
        <button className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={() => gameStore.getState().backToCareerSelect()}>
          Switch Career
        </button>
        <div className="account-delete-row">
          <div><strong>Delete account</strong><span>Removes this account and all of its local careers from this browser.</span></div>
          <button className="btn btn-danger" onClick={() => setConfirmingAccountDelete(true)}>Delete Account</button>
        </div>
      </section>

      {confirmingDelete && (
        <ConfirmModal
          title="Delete this career?"
          body={`This permanently deletes ${state.player.bio.firstName} ${state.player.bio.lastName}'s career — every season, stat, and save. This can't be undone.`}
          confirmLabel="Delete Career"
          danger
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            void gameStore.getState().deleteCareer(state.id);
            gameStore.getState().backToCareerSelect();
          }}
        />
      )}
      {confirmingAccountDelete && (
        <ConfirmModal
          title="Delete account and all careers?"
          body="This permanently removes the signed-in account and every GRIDIRON LIFE career stored for it in this browser. This cannot be undone."
          confirmLabel="Delete Account"
          danger
          onCancel={() => setConfirmingAccountDelete(false)}
          onConfirm={() => {
            setConfirmingAccountDelete(false);
            gameStore.getState().deleteCurrentAccount();
          }}
        />
      )}
      {confirmingDemoReset && (
        <ConfirmModal
          title="Reset the demo account?"
          body="This removes every demo career stored in this browser and signs out. It does not affect normal accounts. You can sign back in with adm / adm to start fresh."
          confirmLabel="Reset Demo Account"
          danger
          onCancel={() => setConfirmingDemoReset(false)}
          onConfirm={() => {
            setConfirmingDemoReset(false);
            void gameStore.getState().resetDemoProfile();
          }}
        />
      )}
    </div>
  );
}
