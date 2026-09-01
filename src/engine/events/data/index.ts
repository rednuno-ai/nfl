import { HIGH_SCHOOL_EVENTS } from "./highschool";
import { COLLEGE_EVENTS } from "./college";
import { DRAFT_EVENTS } from "./draft";
import { NFL_EVENTS } from "./nfl";
import { PERSONAL_EVENTS } from "./personal";
import { INJURY_EVENTS } from "./injuries";
import { MEDIA_EVENTS } from "./media";
import { POSITION_EVENTS } from "./position";
import { CONTINUITY_EVENTS } from "./continuity";
import type { GameEventDefinition } from "../../types";

// Single source of truth: every event definition in the game. To add content,
// append to the relevant data file above — nothing else needs to change.
export const ALL_EVENTS: GameEventDefinition[] = [
  ...HIGH_SCHOOL_EVENTS,
  ...COLLEGE_EVENTS,
  ...DRAFT_EVENTS,
  ...NFL_EVENTS,
  ...PERSONAL_EVENTS,
  ...INJURY_EVENTS,
  ...MEDIA_EVENTS,
  ...POSITION_EVENTS,
  ...CONTINUITY_EVENTS,
];

export { HIGH_SCHOOL_EVENTS, COLLEGE_EVENTS, DRAFT_EVENTS, NFL_EVENTS, PERSONAL_EVENTS, INJURY_EVENTS, MEDIA_EVENTS, POSITION_EVENTS, CONTINUITY_EVENTS };
