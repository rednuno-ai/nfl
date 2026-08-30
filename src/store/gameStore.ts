import { createStore, createUseStore } from "./createStore";
import { getRepository, type CareerSummary } from "@data/index";
import {
  getSession,
  getCurrentUser,
  register as authRegister,
  login as authLogin,
  recoverPassword as authRecoverPassword,
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

export type CinematicScene = "contract" | "garage" | "home" | "press";

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
  | "team";

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
  toast: string | null;
  cinematic: { scene: CinematicScene; title: string; body: string } | null;

  registerAccount: (username: string, password: string, referralCode?: string) => Promise<void>;
  loginAccount: (username: string, password: string) => Promise<void>;
  recoverAccount: (username: string, recoveryKey: string, password: string) => Promise<void>;
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
  acknowledgeGameResult: () => void;
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
}

const repository = getRepository();

function persist(state: GameStoreState) {
  if (state.activeCareer) {
    // Fire-and-forget autosave. LocalRepository is effectively synchronous;
    // a Supabase-backed repository would be a real network write here, so a
    // rejection (e.g. a dropped connection) shouldn't crash the app — just
    // surface it for debugging.
    void repository.saveCareer(state.userId, state.activeCareer).catch((err) => {
      console.error("Autosave failed:", err);
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
  persist(get());
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
      const careers = await repository.listCareers(get().userId);
      set({ careers, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  startNewCareer: async (input) => {
    const state = createCareer(input);
    set({ activeCareer: state, screen: "dashboard" });
    await repository.saveCareer(get().userId, state);
    await get().refreshCareers();
  },

  openCareer: async (id) => {
    set({ loading: true });
    const state = await repository.loadCareer(get().userId, id);
    set({ activeCareer: state, screen: state ? "dashboard" : "career-select", loading: false });
  },

  deleteCareer: async (id) => {
    await repository.deleteCareer(get().userId, id);
    await get().refreshCareers();
  },

  backToCareerSelect: () => set({ activeCareer: null, screen: "career-select" }),

  advance: (options) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, advanceWeek(current, options));
  },

  decide: (choiceId) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, resolveDecision(current, choiceId));
  },

  chooseTraining: (focus) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, chooseTrainingFocus(current, focus));
  },

  gameDecide: (optionId) => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, resolveGameDecision(current, optionId));
  },

  acknowledgeGameResult: () => {
    const current = get().activeCareer;
    if (!current) return;
    applyCareer(get, set, acknowledgeFinishedGame(current));
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
    set({ cinematic: { scene: "press", title: "Life, On Your Terms", body: "Your relationship choices belong to you — not the headlines." } });
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

  navigate: (screen) => {
    // While a game is live, GameDayView occupies the main area regardless of
    // `screen` (see App.tsx). Changing `screen` here would desync the nav
    // highlight from what's actually on screen — the tapped tab would light
    // up while the game stays put, looking broken. Block it until the game
    // resolves.
    if (get().activeCareer?.interaction?.type === "game") return;
    set({ screen });
  },
  dismissToast: () => set({ toast: null }),
}));

export const useGameStore = createUseStore(gameStore);
