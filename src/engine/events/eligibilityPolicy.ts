import type { CareerStage, EventCondition, GameEventDefinition } from "../types";
import { characterRequirements } from "../characters";

/**
 * Narrative policy lives in one place instead of being reimplemented by
 * screens, modals, or weekly ticks. Definitions can still carry their own
 * requirements; this file supplies phase-safe defaults and the audited
 * exceptions whose story premise needs more context than a category provides.
 */
const ACTIVE_STAGES: CareerStage[] = ["high_school", "recruiting", "college", "draft", "nfl_offseason", "nfl_season", "free_agency"];
const PROFESSIONAL_STAGES: CareerStage[] = ["nfl_offseason", "nfl_season", "free_agency"];
const COLLEGE_OR_PRO_STAGES: CareerStage[] = ["college", ...PROFESSIONAL_STAGES];

function categoryBaseline(category: GameEventDefinition["category"]): EventCondition {
  switch (category) {
    case "high_school": return { stage: ["high_school"], minAge: 15, maxAge: 18, minWeek: 1 };
    case "college": return { stage: ["college"], minAge: 17, maxAge: 24, minWeek: 1 };
    case "draft": return { stage: ["draft"], minAge: 20, maxAge: 25, minCareerSeasons: 1, minWeek: 1 };
    case "nfl": return { stage: PROFESSIONAL_STAGES, minAge: 21, maxAge: 42, minWeek: 1 };
    case "media": return { stage: COLLEGE_OR_PRO_STAGES, minAge: 18, minGamesPlayed: 2, minWeek: 1 };
    case "personal": return { stage: ACTIVE_STAGES, minAge: 15, minWeek: 1 };
    case "injury": return { stage: ACTIVE_STAGES, minAge: 15, minWeek: 1 };
  }
}

/**
 * Every exceptional premise is audited here. The category baseline above
 * covers the remaining definitions, so a newly added event cannot silently
 * become valid for a freshman simply because its author forgot a stage.
 */
export const EVENT_ELIGIBILITY_OVERRIDES: Record<string, Partial<EventCondition>> = {
  // High-school story beats that should develop after the opening week.
  hs_first_scout_visit: { minWeek: 2, minGamesPlayed: 1 },
  hs_college_camp_invite: { minWeek: 3, minGamesPlayed: 1 },
  hs_social_media_following: { minWeek: 3, minGamesPlayed: 2 },
  hs_rivalry_game: { minWeek: 5, minGamesPlayed: 3 },
  hs_state_championship: { minWeek: 9, minGamesPlayed: 7 },
  hs_offer_from_prestige_program: { minWeek: 6, minGamesPlayed: 4, minFame: 10 },
  hs_combine_camp_invite: { minWeek: 5, minGamesPlayed: 3 },
  hs_recruiting_visit_conflict: { minWeek: 7, minGamesPlayed: 5, minFame: 20 },

  // Media: local attention is possible in college; celebrity attention is not.
  media_personality_platform: { stage: ["college", ...PROFESSIONAL_STAGES], minAge: 18, minGamesPlayed: 3, minFame: 8 },
  media_hot_take_response: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 6, minFame: 20 },
  media_feature_story: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 10, minFame: 30 },
  media_social_backlash: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 8, minFame: 25 },
  media_podcast_invite: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 6, minFame: 20 },
  media_mvp_talk: { stage: ["nfl_season"], minGamesPlayed: 8, minFame: 55, minAwards: { proBowls: 1 } },
  media_documentary_offer: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 24, minFame: 45, minReputation: 35 },
  media_leaked_locker_room: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 4, minReputation: 15 },
  media_commercial_shoot: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 12, minFame: 30 },
  media_beat_writer_relationship: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 4, minReputation: 15 },
  media_award_show: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 17, minFame: 40, minAwards: { proBowls: 1 } },
  media_controversial_interview: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 8, minFame: 25 },
  media_paparazzi_outside: {
    stage: COLLEGE_OR_PRO_STAGES,
    minAge: 18,
    minGamesPlayed: 8,
    minFame: 35,
    minReputation: 20,
    maxOccurrences: 3,
  },

  // Adult-life, agent and money stories.
  personal_new_relationship: { minAge: 17, stage: ["high_school", "college", ...PROFESSIONAL_STAGES] },
  personal_relationship_milestone: { minAge: 22, stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 12 },
  personal_child_born: { minAge: 23, stage: PROFESSIONAL_STAGES, minGamesPlayed: 24 },
  personal_luxury_temptation: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 8, minFame: 25 },
  personal_buy_house: { stage: PROFESSIONAL_STAGES, minAge: 22, minGamesPlayed: 16 },
  personal_invest_advice: { stage: ["draft", ...PROFESSIONAL_STAGES], minAge: 20, minFame: 15 },
  personal_sibling_rivalry: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 4, minFame: 10 },
  personal_charity_foundation: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 24, minFame: 35, minReputation: 30 },
  personal_hometown_return: { stage: COLLEGE_OR_PRO_STAGES, minGamesPlayed: 10, minFame: 20 },
  personal_financial_scare: { stage: PROFESSIONAL_STAGES, minAge: 23, minCareerSeasons: 2 },
  personal_mentorship_offer: { stage: PROFESSIONAL_STAGES, minAge: 24, minGamesPlayed: 32 },
  personal_family_business: { stage: PROFESSIONAL_STAGES, minGamesPlayed: 16, minFame: 20 },

  // Professional events that require a real professional résumé.
  nfl_contract_extension_talk: { minCareerSeasons: 2, minGamesPlayed: 24, minRelationships: { agent: 45 } },
  nfl_holdout_decision: { minCareerSeasons: 3, minGamesPlayed: 40, minFame: 30, minRelationships: { agent: 45 } },
  nfl_captaincy_offer: { minCareerSeasons: 3, minGamesPlayed: 32, minRelationships: { teammate: 60 } },
  nfl_community_program: { minCareerSeasons: 2, minGamesPlayed: 20, minReputation: 25 },
  nfl_milestone_chase: { minCareerSeasons: 4, minGamesPlayed: 48, minWeek: 11 },
  nfl_playoff_pressure: { minGamesPlayed: 8, minWeek: 10 },
  nfl_veteran_mentor: { minCareerSeasons: 0, maxAge: 26, maxOccurrences: 1 },

  // Persistent arcs need a plausible relationship and cannot start at Week 1.
  continuity_coach_promise: { stage: ["high_school", "college", ...PROFESSIONAL_STAGES], minWeek: 2, minRelationships: { coach: 45 } },
  continuity_coach_promise_due: { stage: ["high_school", "college", ...PROFESSIONAL_STAGES], minWeek: 3, requiredEvents: ["continuity_coach_promise"] },
  continuity_agent_promise: { stage: ["draft", ...PROFESSIONAL_STAGES], minAge: 20, minRelationships: { agent: 40 } },
  continuity_agent_reckoning: { stage: ["draft", ...PROFESSIONAL_STAGES], requiredEvents: ["continuity_agent_promise"] },
  continuity_teammate_bond: { minWeek: 3, minRelationships: { teammate: 40 } },
  continuity_teammate_consequence: { minWeek: 4, requiredEvents: ["continuity_teammate_bond"] },
  continuity_rival_challenge: { stage: ["high_school", "college", ...PROFESSIONAL_STAGES], minWeek: 4, minGamesPlayed: 2, minRelationships: { rival: 35 } },
  continuity_rival_rematch: { stage: ["high_school", "college", ...PROFESSIONAL_STAGES], minWeek: 5, requiredEvents: ["continuity_rival_challenge"], minGamesPlayed: 3 },
};

/** Effective requirements used by the engine. `once` remains supported for
 * older data and is normalized to `maxOccurrences: 1`. */
export function getEventRequirements(event: GameEventDefinition): EventCondition {
  const baseline = categoryBaseline(event.category);
  const override = EVENT_ELIGIBILITY_OVERRIDES[event.id] ?? {};
  // Three appearances is a conservative default for any repeatable story.
  // Definitions can lower it (or intentionally raise it) in their own data;
  // `once` always wins so legacy content keeps its original meaning.
  const merged = { maxOccurrences: 3, ...baseline, ...event.conditions, ...override };
  merged.tagsPresent = [...new Set([...(merged.tagsPresent ?? []), ...characterRequirements(event)])];
  return event.once ? { ...merged, maxOccurrences: 1 } : merged;
}

export function auditedPhaseForEvent(event: GameEventDefinition): CareerStage[] {
  return getEventRequirements(event).stage ?? ACTIVE_STAGES;
}
