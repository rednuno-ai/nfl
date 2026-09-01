import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useGameStore, gameStore, type ScreenId } from "@store/gameStore";
import { Sidebar, MobileNav } from "@ui/layout/NavBar";
import { AuthScreen } from "@ui/screens/AuthScreen";
import { SubscriptionScreen } from "@ui/screens/SubscriptionScreen";
import { CareerSelectScreen } from "@ui/screens/CareerSelectScreen";
import { PrivacyAccountControlsDialog } from "@ui/components/PrivacyAccountControlsDialog";
import { getGameDayObjective } from "@engine/gameObjectives";
import { recordDailyReturn } from "@data/metrics";
import { usesRemoteAuth } from "@data/auth";
import { publicCopy } from "@ui/copy";
import type { CareerState } from "@engine/career";

const CreatePlayerScreen = lazy(() => import("@ui/screens/CreatePlayerScreen").then((module) => ({ default: module.CreatePlayerScreen })));
const DashboardScreen = lazy(() => import("@ui/screens/DashboardScreen").then((module) => ({ default: module.DashboardScreen })));
const StatsScreen = lazy(() => import("@ui/screens/StatsScreen").then((module) => ({ default: module.StatsScreen })));
const FinanceScreen = lazy(() => import("@ui/screens/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));
const RelationshipsScreen = lazy(() => import("@ui/screens/RelationshipsScreen").then((module) => ({ default: module.RelationshipsScreen })));
const NewsScreen = lazy(() => import("@ui/screens/NewsScreen").then((module) => ({ default: module.NewsScreen })));
const LegacyScreen = lazy(() => import("@ui/screens/LegacyScreen").then((module) => ({ default: module.LegacyScreen })));
const SettingsScreen = lazy(() => import("@ui/screens/SettingsScreen").then((module) => ({ default: module.SettingsScreen })));
const TeamScreen = lazy(() => import("@ui/screens/TeamScreen").then((module) => ({ default: module.TeamScreen })));
const DecisionModal = lazy(() => import("@ui/components/DecisionModal").then((module) => ({ default: module.DecisionModal })));
const TrainingModal = lazy(() => import("@ui/components/TrainingModal").then((module) => ({ default: module.TrainingModal })));
const GameDayView = lazy(() => import("@ui/components/GameDayView").then((module) => ({ default: module.GameDayView })));
const LifeCinematic = lazy(() => import("@ui/components/LifeCinematic").then((module) => ({ default: module.LifeCinematic })));

const SCREEN_TITLES: Record<ScreenId, string> = {
  dashboard: "Career HQ",
  stats: "Stats",
  team: "Stadium",
  finance: "Front Office",
  relationships: "People",
  news: "News",
  legacy: "Legacy",
  settings: "Profile",
  "game-day": "Game Day",
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
  const saveError = useGameStore((s) => s.saveError);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const privacyTriggerRef = useRef<HTMLButtonElement>(null);

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
        : activeCareer?.interaction?.type === "game" && screen === "game-day"
          ? "Game Day"
          : SCREEN_TITLES[screen];
    document.title = `${title} | GRIDIRON LIFE`;
  }, [activeCareer?.interaction?.type, currentUser?.subscriptionActive, screen, session]);

  useEffect(() => {
    if (session) recordDailyReturn();
  }, [session?.username]);

  // Registration wall: no gameplay is reachable without an account.
  if (!session) {
    return <AuthScreen />;
  }

  // Subscription paywall: an account alone isn't enough to play.
  if (!currentUser?.subscriptionActive) {
    return <SubscriptionScreen />;
  }

  if (!activeCareer) {
    return screen === "create-player" ? <ScreenBoundary label="Loading player builder"><CreatePlayerScreen /></ScreenBoundary> : <CareerSelectScreen />;
  }

  const interaction = activeCareer.interaction;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#game-main">Skip to game content</a>
      <Sidebar active={screen} gameAvailable={interactionIsGame(activeCareer)} onNavigate={(id) => gameStore.getState().navigate(id)} onExit={() => gameStore.getState().backToCareerSelect()} />
      <div className="app-content">
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
        <main id="game-main" className="app-main" tabIndex={-1}>
          {interaction?.type === "game" && screen === "game-day" ? (
          <ScreenBoundary label="Loading Game Day">
            <GameDayView
              game={interaction.game}
              opponentLabel={interaction.game.opponentName}
              teamLabel={activeCareer.team ? `${activeCareer.team.city} ${activeCareer.team.name}` : "Your Team"}
              playerName={`${activeCareer.player.bio.firstName[0]}. ${activeCareer.player.bio.lastName}`}
              playerPosition={activeCareer.player.position}
              objective={getGameDayObjective(activeCareer.player.position, activeCareer.totalWeek)}
              onChoose={(optionId) => gameStore.getState().gameDecide(optionId)}
              onSimulate={() => gameStore.getState().simulateGame()}
              onFinished={() => gameStore.getState().acknowledgeGameResult()}
            />
          </ScreenBoundary>
          ) : (
          <ScreenBoundary label="Loading career screen"><div key={screen} className="screen-fade"><ScreenRouter screen={screen} /></div></ScreenBoundary>
          )}
        </main>
        <footer className="app-footer">
          GRIDIRON LIFE · Original football fiction
          <button ref={privacyTriggerRef} type="button" onClick={() => setPrivacyOpen(true)}>Privacy & account controls</button>
        </footer>
        {saveError && <aside className="save-recovery" role="alert"><span>{saveError}</span><button type="button" className="btn btn-ghost" onClick={() => gameStore.getState().retrySave()}>Retry save</button></aside>}
      </div>
      <MobileNav active={screen} gameAvailable={interactionIsGame(activeCareer)} onNavigate={(id) => gameStore.getState().navigate(id)} />

      {interaction?.type === "decision" && <Suspense fallback={null}><DecisionModal decision={interaction.decision} onChoose={(choiceId) => gameStore.getState().decide(choiceId)} /></Suspense>}
      {interaction?.type === "training" && (
        <Suspense fallback={null}><TrainingModal week={interaction.week} options={interaction.options} onChoose={(focusId) => gameStore.getState().chooseTraining(focusId)} /></Suspense>
      )}
      {cinematic && <Suspense fallback={null}><LifeCinematic {...cinematic} onClose={() => gameStore.getState().dismissCinematic()} /></Suspense>}
      {privacyOpen && (
        <PrivacyAccountControlsDialog
          username={session.username}
          storageSummary={usesRemoteAuth() ? publicCopy.storage.serverShort : publicCopy.storage.localShort}
          returnFocusRef={privacyTriggerRef}
          onClose={() => setPrivacyOpen(false)}
          onOpenSettings={() => {
            setPrivacyOpen(false);
            gameStore.getState().navigate("settings");
          }}
        />
      )}

      {toast && (
        <button type="button" className="toast" role="status" aria-live="polite" aria-label="Dismiss notification" onClick={() => gameStore.getState().dismissToast()}>
          {toast}
        </button>
      )}
    </div>
  );
}

function ScreenBoundary({ children, label }: { children: React.ReactNode; label: string }) {
  return <Suspense fallback={<div className="screen-loading" role="status" aria-live="polite" aria-busy="true">{label}…</div>}>{children}</Suspense>;
}

function interactionIsGame(career: CareerState | null): boolean {
  return career?.interaction?.type === "game";
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
