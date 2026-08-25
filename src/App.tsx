import { useEffect } from "react";
import { useGameStore, gameStore, type ScreenId } from "@store/gameStore";
import { Sidebar, MobileNav } from "@ui/layout/NavBar";
import { AuthScreen } from "@ui/screens/AuthScreen";
import { SubscriptionScreen } from "@ui/screens/SubscriptionScreen";
import { CareerSelectScreen } from "@ui/screens/CareerSelectScreen";
import { CreatePlayerScreen } from "@ui/screens/CreatePlayerScreen";
import { DashboardScreen } from "@ui/screens/DashboardScreen";
import { StatsScreen } from "@ui/screens/StatsScreen";
import { FinanceScreen } from "@ui/screens/FinanceScreen";
import { RelationshipsScreen } from "@ui/screens/RelationshipsScreen";
import { NewsScreen } from "@ui/screens/NewsScreen";
import { LegacyScreen } from "@ui/screens/LegacyScreen";
import { SettingsScreen } from "@ui/screens/SettingsScreen";
import { TeamScreen } from "@ui/screens/TeamScreen";
import { DecisionModal } from "@ui/components/DecisionModal";
import { TrainingModal } from "@ui/components/TrainingModal";
import { GameDayView } from "@ui/components/GameDayView";

export default function App() {
  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const activeCareer = useGameStore((s) => s.activeCareer);
  const screen = useGameStore((s) => s.screen);
  const toast = useGameStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => gameStore.getState().dismissToast(), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Registration wall: no gameplay is reachable without an account.
  if (!session) {
    return <AuthScreen />;
  }

  // Subscription paywall: an account alone isn't enough to play.
  if (!currentUser?.subscriptionActive) {
    return <SubscriptionScreen />;
  }

  if (!activeCareer) {
    return screen === "create-player" ? <CreatePlayerScreen /> : <CareerSelectScreen />;
  }

  const interaction = activeCareer.interaction;

  return (
    <div className="app-shell">
      <Sidebar active={screen} onNavigate={(id) => gameStore.getState().navigate(id)} onExit={() => gameStore.getState().backToCareerSelect()} />
      <main className="app-main">
        {interaction?.type === "game" ? (
          <GameDayView
            game={interaction.game}
            opponentLabel={interaction.game.opponentName}
            teamLabel={activeCareer.team ? `${activeCareer.team.city} ${activeCareer.team.name}` : "Your Team"}
            onChoose={(optionId) => gameStore.getState().gameDecide(optionId)}
          />
        ) : (
          <ScreenRouter screen={screen} />
        )}
      </main>
      <MobileNav active={screen} onNavigate={(id) => gameStore.getState().navigate(id)} />

      {interaction?.type === "decision" && <DecisionModal decision={interaction.decision} onChoose={(choiceId) => gameStore.getState().decide(choiceId)} />}
      {interaction?.type === "training" && (
        <TrainingModal week={interaction.week} options={interaction.options} onChoose={(focusId) => gameStore.getState().chooseTraining(focusId)} />
      )}

      {toast && (
        <div className="toast" onClick={() => gameStore.getState().dismissToast()}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ScreenRouter({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case "stats":
      return <StatsScreen />;
    case "finance":
      return <FinanceScreen />;
    case "relationships":
      return <RelationshipsScreen />;
    case "news":
      return <NewsScreen />;
    case "legacy":
      return <LegacyScreen />;
    case "settings":
      return <SettingsScreen />;
    case "team":
      return <TeamScreen />;
    default:
      return <DashboardScreen />;
  }
}
