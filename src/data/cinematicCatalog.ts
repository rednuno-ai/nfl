import type { TrainingSelection } from "@engine/career";

/** All scenes use original, fictional first-person art. Scene keys control the
 * visual plate; beats are the context-specific moments players actually see. */
export type CinematicScene =
  | "contract"
  | "garage"
  | "home"
  | "press"
  | "relationship"
  | "training"
  | "film"
  | "recovery"
  | "team"
  | "tunnel"
  | "draft"
  | "interview"
  | "travel";

export interface CinematicBeat {
  id: string;
  scene: CinematicScene;
  title: string;
  body: string;
}

/** Thirty short, purpose-built moments spread over on-field, school, life,
 * media and career milestones. They are not random videos: every one has a
 * clear trigger in the career loop or a close related action. */
export const CINEMATIC_BEATS: readonly CinematicBeat[] = [
  { id: "training_position", scene: "training", title: "Before Sunrise", body: "The work starts before anyone is watching." },
  { id: "training_film", scene: "film", title: "One More Rep", body: "The smallest read can change the next big moment." },
  { id: "training_recovery", scene: "recovery", title: "Reset The Body", body: "Recovery is work too — choose the long game." },
  { id: "game_arrival_home", scene: "tunnel", title: "Walk Into The Noise", body: "Your field. Your moment. The next snap is yours." },
  { id: "game_arrival_away", scene: "travel", title: "Road Ready", body: "Everything is louder on the road. Lock into your routine." },
  { id: "game_result_win", scene: "team", title: "Earned Together", body: "The result belongs to the team, and the next week starts now." },
  { id: "game_result_loss", scene: "recovery", title: "Back To Work", body: "The film is waiting. The response is your decision." },
  { id: "personal_relationship", scene: "relationship", title: "Off The Clock", body: "The life you build away from football is still your call." },
  { id: "personal_milestone", scene: "relationship", title: "The Next Chapter", body: "A bigger life asks for the same honest decisions." },
  { id: "personal_family", scene: "draft", title: "Keep Your Circle Close", body: "The people who knew you first still matter when everything moves fast." },
  { id: "personal_home", scene: "home", title: "A Place Of Your Own", body: "A new front door can mark a whole new stage of life." },
  { id: "personal_car", scene: "garage", title: "The Keys", body: "Enjoy the moment — the budget still follows every decision." },
  { id: "personal_investment", scene: "contract", title: "Think Beyond Today", body: "The smart move is the one that still matters years from now." },
  { id: "personal_hometown", scene: "travel", title: "Where It Started", body: "The road forward is clearer when you remember the beginning." },
  { id: "media_reaction", scene: "press", title: "Every Word Travels", body: "The spotlight rewards composure and remembers everything." },
  { id: "media_feature", scene: "interview", title: "Tell Your Story", body: "You decide how much of the journey belongs to the cameras." },
  { id: "media_social", scene: "press", title: "The Feed Moves Fast", body: "A reaction can build a reputation — or test it." },
  { id: "media_podcast", scene: "interview", title: "Long-Form", body: "There is no script for a real conversation." },
  { id: "media_documentary", scene: "interview", title: "Access Granted", body: "Letting cameras in changes what the world gets to see." },
  { id: "media_commercial", scene: "interview", title: "The Campaign", body: "A bigger platform brings a bigger choice about your time." },
  { id: "media_awards", scene: "press", title: "The Arrival", body: "Celebrate the moment, then decide what comes next." },
  { id: "draft_combine", scene: "training", title: "Measured", body: "Every rep is a statement. Make yours count." },
  { id: "draft_interview", scene: "interview", title: "In The Room", body: "They know the numbers. Now they are meeting the person." },
  { id: "draft_pro_day", scene: "training", title: "One More Look", body: "Preparation is all you control when the eyes are on you." },
  { id: "draft_night", scene: "draft", title: "The Call", body: "Whatever happens next, you earned the right to be here." },
  { id: "draft_watch_party", scene: "draft", title: "Stay Present", body: "A life-changing night is better when you share it." },
  { id: "college_nil", scene: "contract", title: "Your First Deal", body: "A small contract can be a big lesson in what your name is worth." },
  { id: "college_depth", scene: "training", title: "Compete For It", body: "Starting jobs are won in the quiet reps." },
  { id: "college_academics", scene: "film", title: "More Than Football", body: "The classroom builds a different kind of confidence." },
  { id: "nfl_extension", scene: "contract", title: "Business Of Football", body: "Security, leverage and timing all matter when the deal is real." },
] as const;

const BY_ID = new Map(CINEMATIC_BEATS.map((beat) => [beat.id, beat]));

function beat(id: string): CinematicBeat | null {
  return BY_ID.get(id) ?? null;
}

const EVENT_TO_BEAT: Record<string, string> = {
  personal_new_relationship: "personal_relationship",
  personal_relationship_milestone: "personal_milestone",
  personal_parents_visit: "personal_family",
  personal_sibling_rivalry: "personal_family",
  personal_family_business: "personal_family",
  personal_buy_house: "personal_home",
  personal_luxury_temptation: "personal_car",
  personal_invest_advice: "personal_investment",
  personal_financial_scare: "personal_investment",
  personal_hometown_return: "personal_hometown",
  media_hot_take_response: "media_reaction",
  media_feature_story: "media_feature",
  media_social_backlash: "media_social",
  media_podcast_invite: "media_podcast",
  media_documentary_offer: "media_documentary",
  media_commercial_shoot: "media_commercial",
  media_award_show: "media_awards",
  draft_combine_invite: "draft_combine",
  draft_team_interview: "draft_interview",
  draft_pro_day: "draft_pro_day",
  draft_night_call: "draft_night",
  draft_family_watch_party: "draft_watch_party",
  college_nil_deal: "college_nil",
  college_depth_chart_battle: "college_depth",
  college_academic_honor: "college_academics",
  nfl_contract_extension_talk: "nfl_extension",
};

export function cinematicForDecision(eventId: string): CinematicBeat | null {
  const id = EVENT_TO_BEAT[eventId];
  return id ? beat(id) : null;
}

export function cinematicForTraining(focus: TrainingSelection): CinematicBeat | null {
  if (focus === "position_specific" || focus === "strength" || focus === "speed" || focus === "technique") return beat("training_position");
  if (focus === "mental") return beat("training_film");
  if (focus === "recovery") return beat("training_recovery");
  return null;
}

export function cinematicForGameStart(isHome: boolean): CinematicBeat | null {
  return beat(isHome ? "game_arrival_home" : "game_arrival_away");
}

export function cinematicForGameResult(result: "win" | "loss" | "tie" | null): CinematicBeat | null {
  return beat(result === "win" ? "game_result_win" : "game_result_loss");
}
