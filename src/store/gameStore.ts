import { createStore, createUseStore } from "./createStore";
import { getRepository, type CareerSummary } from "@data/index";
import {
  getSession,
  getCurrentUser,
  register as authRegister,
  login as authLogin,
  recoverPassword as authRecoverPassword,
  changePassword as authChangePassword,
  logout as authLogout,
  activateSubscriptionDemo,
  resetDemoAccount as authResetDemoAccount,
  deleteAccount as authDeleteAccount,
  type AuthSession,
  type AuthUser,
} from "@data/auth";
import {
  advanceWeek,
  commitToCollege,
  createCareer,
  resolveDecision,
  resolveGameDecision,
  simulateActiveGame,
  acknowledgeFinishedGame,
  retireCareer,
  signWithTeam,
  buyAsset,
  endPartnerRelationship,
  handlePaparazzi,
  respondToNews,
  startOrChangePartner,
  chooseTrainingFocus,
  type TrainingSelection,
  type AdvanceWeekOptions,
  type CareerState,
} from "@engine/career";
import type { CreatePlayerInput } from "@engine/player";
import type { Asset } from "@engine/types";
import { completeOnboarding, recordFirstGameCompleted, recordFirstGameStarted } from "@data/metrics";
import {
  cinematicForDecision,
  cinematicForGameResult,
  cinematicForGameStart,
  cinematicForTraining,
  type CinematicScene,
} from "@data/cinematicCatalog";

export type { CinematicScene } from "@data/cinematicCatalog";

export type ScreenId =
  | "career-select"
  | "create-player"
  | "dashboard"
  | "stats"
  | "finance"
  | "relationships"
  | "news"
  | "legacy"
  | "settings"
  | "team"
  /** A live game is a destination in its own right, never a fake active tab. */
  | "game-day";

export interface GameStoreState {
  userId: string;
  session: AuthSession | null;
  currentUser: AuthUser | null;
  authError: string | null;
  authBusy: boolean;
  careers: CareerSummary[];
  activeCareer: CareerState | null;
  screen: ScreenId;
  loading: boolean;
  error: string | null;
  saveError: string | null;
  toast: string | null;
  cinematic: { scene: CinematicScene; title: string; body: string } | null;

  registerAccount: (username: string, password: string, referralCode?: string) => Promise<void>;
  loginAccount: (username: string, password: string) => Promise<void>;
  recoverAccount: (username: string, recoveryKey: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  resetDemoProfile: () => Promise<void>;
  logoutAccount: () => void;
  deleteCurrentAccount: () => void;
  subscribe: () => void;

  refreshCareers: () => Promise<void>;
  startNewCareer: (input: CreatePlayerInput) => Promise<void>;
  openCareer: (id: string) => Promise<void>;
  deleteCareer: (id: string) => Promise<void>;
  backToCareerSelect: () => void;

  advance: (options?: AdvanceWeekOptions) => void;
  decide: (choiceId: string) => void;
  chooseTraining: (focus: TrainingSelection) => void;
  gameDecide: (optionId: string) => void;
  simulateGame: () => void;
  acknowledgeGameResult: () => void;
  resumeGame: () => void;
  commitCollege: (collegeId: string) => void;
  signFreeAgent: (teamId: string) => void;
  retire: () => void;
  purchaseAsset: (asset: Omit<Asset, "id" | "purchasedWeek">) => void;
  respondNews: (newsId: string) => void;
  startOrChangePartner: () => void;
  endPartnerRelationship: () => void;
  respondToPaparazzi: (approach: "private" | "embrace") => void;
  dismissCinematic: () => void;

  navigate: (screen: ScreenId) => void;
  dismissToast: () => void;
  retrySave: () => void;
}

function persist(state: GameStoreState, set: (partial: Partial<GameStoreState>) => void) {
  if (state.activeCareer) {
    // Fire-and-forget autosave. LocalRepository is effectively synchronous;
    // a Supabase-backed repository would be a real network write here, so a
    // rejection (e.g. a dropped connection) shouldn't crash the app — just
    // surface it for debugging.
    void getRepository()
      .saveCareer(state.userId, state.activeCareer)
      .then(() => {
        if (state.saveError) set({ saveError: null });
      })
      .catch((err) => {
        console.error("Autosave failed:", err);
        set({ saveError: "Your latest change could not be saved. Check your connection, then retry." });
      });
  }
}

/** Titles of any achievements that flipped from locked to unlocked between
 *  two CareerState snapshots (index-aligned since ACHIEVEMENT_DEFINITIONS is
 *  a fixed, ordered list — see engine/achievements.ts). */
function newlyUnlockedTitles(prev: CareerState, next: CareerState): string[] {
  const titles: string[] = [];
  for (let i = 0; i < next.achievements.length; i++) {
    const before = prev.achievements[i];
    const after = next.achievements[i];
    if (before && after && before.unlockedWeek === null && after.unlockedWeek !== null) {
      titles.push(after.title);
    }
  }
  return titles;
}

/** Applies a new CareerState after any mutating engine call, surfacing a
 *  toast for newly-unlocked achievements (they take priority over a
 *  caller-supplied fallback toast, since they're rarer and more important),
 *  and autosaving. Every action below should route through this instead of
 *  duplicating the set+persist dance. */
function applyCareer(get: () => GameStoreState, set: (partial: Partial<GameStoreState>) => void, next: CareerState, fallbackToast?: string) {
  const current = get().activeCareer;
  const unlocked = current ? newlyUnlockedTitles(current, next) : [];
  const toast = unlocked.length > 0 ? `🏆 Achievement unlocked: ${unlocked.join(", ")}` : fallbackToast ?? get().toast;
  set({ activeCareer: next, toast });
  persist(get(), set);
}

const initialSession = typeof localStorage !== "undefined" ? getSession() : null;

export const gameStore = createStore<GameStoreState>((set, get) => ({
  userId: initialSession?.username ?? "",
  session: initialSession,
  currentUser: typeof localStorage !== "undefined" ? getCurrentUser() : null,
  authError: null,
  authBusy: false,
  careers: [],
  activeCareer: null,
  screen: "career-select",
  loading: false,
  error: null,
  saveError: null,
  toast: null,
  cinematic: null,

  registerAccount: async (username, password, referralCode) => {
    set({ authBusy: true, authError: null });
    const result = await authRegister(username, password, referralCode);
    if (!result.ok) {
      set({ authBusy: false, authError: result.error ?? "Couldn't create the account." });
      return;
    }
    const session = getSession();
    set({ authBusy: false, session, userId: session?.username ?? "", currentUser: getCurrentUser() });
    await get().refreshCareers();
  },

  loginAccount: async (username, password) => {
    set({ authBusy: true, authError: null });
    const result = await authLogin(username, password);
    if (!result.ok) {
      set({ authBusy: false, authError: result.error ?? "Couldn't sign in." });
      return;
    }
    const session = getSession();
    set({ authBusy: false, session, userId: session?.username ?? "", currentUser: getCurrentUser() });
    await get().refreshCareers();
  },

  recoverAccount: async (username, recoveryKey, password) => {
    set({ authBusy: true, authError: null });
    const result = await authRecoverPassword(username, recoveryKey, password);
    if (!result.ok) {
      set({ authBusy: false, authError: result.error ?? "Couldn't reset the password." });
      return;
    }
    const session = getSession();
    set({ authBusy: false, session, userId: session?.username ?? "", currentUser: getCurrentUser() });
    await get().refreshCareers();
  },

  changePassword: async (currentPassword, nextPassword) => {
    const username = get().session?.username;
    if (!username) {
      set({ authError: "Sign in before changing your password." });
      return false;
    }
    set({ authBusy: true, authError: null });
    const result = await authChangePassword(username, currentPassword, nextPassword);
    if (!result.ok) {
      set({ authBusy: false, authError: result.error ?? "Couldn't change the password." });
      return false;
    }
    set({ authBusy: false, authError: null, currentUser: getCurrentUser(), toast: "Password updated on this device." });
    return true;
  },

  resetDemoProfile: async () => {
    set({ authBusy: true, authError: null });
    const result = await authResetDemoAccount(get().session?.username ?? "");
    set({ authBusy: false, authError: result.ok ? null : result.error ?? "Couldn't reset the demo profile.", session: null, currentUser: null, userId: "", activeCareer: null, careers: [], screen: "career-select" });
  },

  logoutAccount: () => {
    authLogout();
    set({ session: null, currentUser: null, userId: "", activeCareer: null, careers: [], screen: "career-select" });
  },

  deleteCurrentAccount: () => {
    const session = get().session;
    if (!session) return;
    authDeleteAccount(session.username);
    set({ session: null, currentUser: null, userId: "", activeCareer: null, careers: [], screen: "career-select", toast: null });
  },

  subscribe: () => {
    const session = get().session;
    if (!session) return;
    activateSubscriptionDemo(session.username);
    set({ currentUser: getCurrentUser() });
  },

  refreshCareers: async () => {
    set({ loading: true });
    try {
      const careers = await getRepository().listCareers(get().userId);
      set({ careers, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  startNewCareer: async (input) => {
    const state = createCareer(input);
    completeOnboarding();
    set({ activeCareer: state, screen: "dashboard" });
    try {
      await getRepository().saveCareer(get().userId, state);
    } catch (err) {
      console.error("Initial career save failed:", err);
      set({ saveError: "Your new career could not be saved yet. Check your connection, then retry." });
    }
    await get().refreshCareers();
  },

  openCareer: async (id) => {
    set({ loading: true });
    try {
      const state = await getRepository().loadCareer(get().userId, id);
      set({ activeCareer: state, screen: state ? "dashboard" : "career-select", loading: false, toast: state ? get().toast : "That career could not be found." });
    } catch (err) {
      console.error("Career load failed:", err);
      set({ loading: false, toast: "Couldn't open that career. Check your connection and try again." });
    }
  },

  deleteCareer: async (id) => {
    try {
      await getRepository().deleteCareer(get().userId, id);
    } catch (err) {
      console.error("Career delete failed:", err);
      set({ saveError: "That career could not be deleted. Check your connection, then retry." });
      return;
    }
    await get().refreshCareers();
  },

  backToCareerSelect: () => set({ activeCareer: null, screen: "career-select" }),

  advance: (options) => {
    const current = get().activeCareer;
    if (!current) return;
    if (current.interaction?.type === "game") {
      set({ toast: "Game paused. Select Resume Game when you are ready." });
      return;
    }
    const next = advanceWeek(current, options);
    if (current.currentSeasonGameStats.length === 0 && next.interaction?.type === "game") recordFirstGameStarted();
    applyCareer(get, set, next);
    if (next.interaction?.type === "game") {
      set({ screen: "game-day" });
      const scheduledGame = current.schedule.find((entry) => entry.week === current.weekInSeason);
      const cinematic = cinematicForGameStart(scheduledGame?.isHome ?? true);
      if (cinematic) set({ cinematic });
    }
  },

  decide: (choiceId) => {
    const current = get().activeCareer;
    if (!current) return;
    const decision = current.interaction?.type === "decision" ? current.interaction.decision : null;
    applyCareer(get, set, resolveDecision(current, choiceId));
    const cinematic = decision ? cinematicForDecision(decision.eventId) : null;
    if (cinematic) set({ cinematic });
  },

  chooseTraining: (focus) => {
    const current = get().activeCareer;
    if (!current) return;
    const next = chooseTrainingFocus(current, focus);
    if (current.currentSeasonGameStats.length === 0 && next.interaction?.type === "game") recordFirstGameStarted();
    applyCareer(get, set, next);
    if (next.interaction?.type === "game") set({ screen: "game-day" });
    const cinematic = cinematicForTraining(focus);
    if (cinematic) set({ cinematic });
  },

  gameDecide: (optionId) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, resolveGameDecision(current, optionId));
  },

  simulateGame: () => {
    const current = get().activeCareer;
    if (!current || current.interaction?.type !== "game") {
      set({ toast: "There is no live game to simulate." });
      return;
    }
    const game = current.interaction.game;
    const firstCareerGame = current.currentSeasonGameStats.length === 0;
    const next = simulateActiveGame(current);
    if (firstCareerGame) recordFirstGameCompleted();
    applyCareer(get, set, next, `Game simulated: ${game.opponentName} is now in your career record.`);
    set({ screen: "dashboard" });
    const cinematic = cinematicForGameResult(game.result);
    if (cinematic) set({ cinematic });
  },

  acknowledgeGameResult: () => {
    const current = get().activeCareer;
    if (!current) return;
    if (current.currentSeasonGameStats.length === 0 && current.interaction?.type === "game" && current.interaction.game.finished) recordFirstGameCompleted();
    applyCareer(get, set, acknowledgeFinishedGame(current));
    set({ screen: "dashboard" });
    if (current.interaction?.type === "game" && current.interaction.game.finished) {
      const cinematic = cinematicForGameResult(current.interaction.game.result);
      if (cinematic) set({ cinematic });
    }
  },

  commitCollege: (collegeId) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, commitToCollege(current, collegeId), "Welcome to college football!");
  },

  signFreeAgent: (teamId) => {
    const current = get().activeCareer;
    if (!current) return;
    const team = current.freeAgencyOffers?.find((offer) => offer.teamId === teamId);
    applyCareer(get, set, signWithTeam(current, teamId));
    if (team) {
      set({ cinematic: { scene: "contract", title: "Deal Signed", body: `${team.contract.years} years. ${team.contract.totalValue.toLocaleString()} total value. Your next chapter starts now.` } });
    }
  },

  retire: () => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, retireCareer(current));
    set({ screen: "legacy" });
  },

  purchaseAsset: (asset) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, buyAsset(current, asset));
    if (current.finance.cash >= asset.value && (asset.type === "car" || asset.type === "house")) {
      set({
        cinematic: {
          scene: asset.type === "car" ? "garage" : "home",
          title: asset.type === "car" ? "New Keys" : "Welcome Home",
          body: `${asset.name} is now part of your life off the field.`,
        },
      });
    }
  },

  respondNews: (newsId) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, respondToNews(current, newsId));
  },

  startOrChangePartner: () => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, startOrChangePartner(current));
    set({ cinematic: { scene: "relationship", title: "Off The Clock", body: "Your relationship choices belong to you — not the headlines." } });
  },

  endPartnerRelationship: () => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, endPartnerRelationship(current));
  },

  respondToPaparazzi: (approach) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, handlePaparazzi(current, approach));
    set({
      cinematic: {
        scene: "press",
        title: approach === "private" ? "Hold The Line" : "Own The Moment",
        body: approach === "private" ? "You kept the attention at a distance." : "You chose to control the story, not hide from it.",
      },
    });
  },

  dismissCinematic: () => set({ cinematic: null }),

  resumeGame: () => {
    if (get().activeCareer?.interaction?.type !== "game") {
      set({ toast: "There is no paused game to resume." });
      return;
    }
    set({ screen: "game-day", toast: null });
  },

  navigate: (screen) => {
    const gameIsPaused = get().activeCareer?.interaction?.type === "game" && screen !== "game-day";
    set({ screen, toast: gameIsPaused ? "Game paused. Resume it from the Game Day tab whenever you are ready." : get().toast });
  },
  dismissToast: () => set({ toast: null }),
  retrySave: () => persist(get(), set),
}));

export const useGameStore = createUseStore(gameStore);
