import { useGameStore, gameStore } from "@store/gameStore";
import { InviteFriendsCard } from "@ui/components/InviteFriendsCard";

export function SettingsScreen() {
  const state = useGameStore((s) => s.activeCareer)!;
  const session = useGameStore((s) => s.session);

  return (
    <div>
      <div className="page-title">Settings</div>
      <p className="page-subtitle">Manage your account and this career.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">👤 Account</div>
        <p className="muted">Signed in as {session?.username}</p>
        <button className="btn btn-ghost" onClick={() => gameStore.getState().logoutAccount()}>
          Sign Out
        </button>
      </div>

      <InviteFriendsCard />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">🏈 Career Info</div>
        <p className="muted">Weeks played: {state.totalWeek}</p>
      </div>

      <div className="card">
        <div className="section-title">⚠️ Danger Zone</div>
        <button
          className="btn"
          onClick={() => {
            if (confirm("Delete this career permanently?")) {
              void gameStore.getState().deleteCareer(state.id);
              gameStore.getState().backToCareerSelect();
            }
          }}
        >
          Delete This Career
        </button>
        <button className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={() => gameStore.getState().backToCareerSelect()}>
          Switch Career
        </button>
      </div>
    </div>
  );
}
