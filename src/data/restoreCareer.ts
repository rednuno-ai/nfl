import type { CareerState } from "@engine/career";
import { initialAchievements } from "@engine/achievements";
import { ALL_EVENTS } from "@engine/events/data";
import { isEventEligible } from "@engine/events/engine";

/** Migrate optional additions only. Never fabricate the player's core save. */
export function restoreCareer(value: unknown): CareerState {
  if (!value || typeof value !== "object") throw new Error("This career save is unreadable. The original has not been changed.");
  const state = structuredClone(value) as CareerState;
  if (!state.id || !state.player?.bio || !state.player.attributes?.general || !state.highSchool || !state.finance || !state.seasonRecord || !state.rngState || !Number.isFinite(state.totalWeek)) {
    throw new Error("This career is missing essential data. The original save has been preserved.");
  }
  for (const key of ["relationships", "news", "socialFeed", "injuries", "tags", "schedule", "statHistory", "currentSeasonGameStats", "decisionHistory", "log", "teamsPlayedFor", "recruitingOffers"] as const) {
    if (state[key] === undefined) (state as unknown as Record<string, unknown>)[key] = [];
    if (!Array.isArray(state[key])) throw new Error(`Invalid career ${key}. The original save has been preserved.`);
  }
  state.achievements ??= initialAchievements();
  state.eventMemory ??= { firedAt: [], firedOnce: [], firedCount: [] };
  state.eventMemory.firedCount ??= [];
  if (![state.eventMemory.firedAt, state.eventMemory.firedOnce, state.eventMemory.firedCount].every(Array.isArray)) throw new Error("This career has invalid event history. The original save has been preserved.");
  state.trainingLoad ??= 0;
  state.injuryRiskModifier ??= 0;
  state.trainingFocusChosenForWeek ??= -1;
  state.narrativeRolledForWeek ??= -1;
  state.pendingTrainingFocus ??= null;
  state.interaction ??= null;
  if (state.interaction?.type === "decision" && !state.interaction.decision?.choices?.length) throw new Error("This saved decision has no choices. The original save has been preserved.");
  if (state.interaction?.type === "game" && !Array.isArray(state.interaction.game?.log)) throw new Error("This saved game is incomplete. The original save has been preserved.");
  if (state.interaction?.type === "decision") {
    const id = state.interaction.decision.eventId;
    const definition = ALL_EVENTS.find(event => event.id === id);
    if (definition && !isEventEligible(definition, state).eligible) {
      state.interaction = null;
      state.narrativeRolledForWeek = -1;
      state.log = ["An outdated pending story was withdrawn because its requirements are no longer met.", ...state.log];
    }
  }
  return state;
}
