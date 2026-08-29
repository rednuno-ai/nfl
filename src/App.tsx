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
import { LifeCinematic } from "@ui/components/LifeCinematic";
import { getGameDayObjective } from "@engine/gameObjectives";

const SCREEN_TITLES: Record<ScreenId, string> = {
  dashboard: "Career HQ",
  stats: "Stats",
  team: "Stadium",
  finance: "Front Office",
  relationships: "People",
  news: "News",
  legacy: "Legacy",
  settings: "Profile",
  "career-select": "Choose a Career",
  "create-player": "Create a Player",
};

export default function App() {
  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const activeCareer = useGameStore((s) => s.activeCareer);
  const screen = useGameStore((s) => s.screen);
  const toast = useGameStore((s) => s.toast);
  const cinematic = useGameStore((s) => s.cinematic);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => gameStore.getState().dismissToast(), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const title = !session
      ? "Sign in"
      : !currentUser?.subscriptionActive
        ? "Membership"
        : SCREEN_TITLES[screen];
    document.title = `${title} | GRIDIRON LIFE`;
  }, [currentUser?.subscriptionActive, screen, session]);

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
      <a className="skip-link" href="#game-main">Skip to game content</a>
      <Sidebar active={screen} onNavigate={(id) => gameStore.getState().navigate(id)} onExit={() => gameStore.getState().backToCareerSelect()} />
      <main id="game-main" className="app-main" tabIndex={-1}>
        <header className="season-hud" aria-label="Career status">
          <div className="season-hud-title">
            <span className="season-hud-live" aria-hidden="true" />
            LIVE CAREER
          </div>
          <div className="season-hud-status">
            <span>{activeCareer.seasonYear} SEASON</span>
            <span className="season-hud-divider" aria-hidden="true">•</span>
            <span>WEEK {activeCareer.weekInSeason}</span>
            <span className="season-hud-divider" aria-hidden="true">•</span>
            <span className="season-hud-screen">{screen.replace("-", " ")}</span>
          </div>
        </header>
        {interaction?.type === "game" ? (
          <GameDayView
            game={interaction.game}
            opponentLabel={interaction.game.opponentName}
            teamLabel={activeCareer.team ? `${activeCareer.team.city} ${activeCareer.team.name}` : "Your Team"}
            playerName={`${activeCareer.player.bio.firstName[0]}. ${activeCareer.player.bio.lastName}`}
            playerPosition={activeCareer.player.position}
            objective={getGameDayObjective(activeCareer.player.position, activeCareer.totalWeek)}
            onChoose={(optionId) => gameStore.getState().gameDecide(optionId)}
            onFinished={() => gameStore.getState().acknowledgeGameResult()}
          />
        ) : (
          <div key={screen} className="screen-fade">
            <ScreenRouter screen={screen} />
          </div>
        )}
      </main>
      <MobileNav active={screen} onNavigate={(id) => gameStore.getState().navigate(id)} />
      <footer className="app-footer">
        GRIDIRON LIFE · Original football fiction
        <button type="button" onClick={() => gameStore.getState().navigate("settings")}>Privacy & account controls</button>
      </footer>

      {interaction?.type === "decision" && <DecisionModal decision={interaction.decision} onChoose={(choiceId) => gameStore.getState().decide(choiceId)} />}
      {interaction?.type === "training" && (
        <TrainingModal week={interaction.week} options={interaction.options} onChoose={(focusId) => gameStore.getState().chooseTraining(focusId)} />
      )}
      {cinematic && <LifeCinematic {...cinematic} onClose={() => gameStore.getState().dismissCinematic()} />}

      {toast && (
        <button type="button" className="toast" aria-label="Dismiss notification" onClick={() => gameStore.getState().dismissToast()}>
          {toast}
        </button>
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
