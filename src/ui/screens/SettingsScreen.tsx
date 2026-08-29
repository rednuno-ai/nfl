import { useState } from "react";
import { useGameStore, gameStore } from "@store/gameStore";
import { InviteFriendsCard } from "@ui/components/InviteFriendsCard";
import { ConfirmModal } from "@ui/components/ConfirmModal";

export function SettingsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAccountDelete, setConfirmingAccountDelete] = useState(false);
  const referralUnlocked =
    state.currentSeasonGameStats.some((line) => line.gamesPlayed > 0) ||
    state.statHistory.some((line) => line.gamesPlayed > 0) ||
    state.achievements.some((achievement) => achievement.unlockedWeek !== null);

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
        <code>{currentUser?.recoveryKey ?? "Unavailable"}</code>
      </section>

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
    </div>
  );
}
