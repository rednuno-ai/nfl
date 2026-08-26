import type { Hand, PersonalityTrait, Player, PlayerBio, Position } from "./types";
import { applyPointBuy, generateInitialAttributes } from "./attributes";
import { RNG } from "./rng";

export interface CreatePlayerInput {
  firstName: string;
  lastName: string;
  position: Position;
  hometownCity: string;
  hometownState: string;
  hand: Hand;
  heightInches: number;
  weightLbs: number;
  personality: PersonalityTrait[];
  currentYear: number;
  /** Point-buy allocation from the character creator (dotted attribute path
   *  -> extra points above POINT_BUY_BASELINE). Optional so existing callers
   *  (tests, older saves) keep working with a purely random roll. */
  attributeAllocations?: Record<string, number>;
}

export function createId(prefix: string, rng: RNG): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(rng.next() * 1e9).toString(36)}`;
}

export function createPlayer(input: CreatePlayerInput, rng: RNG): Player {
  const talent = clampTalentFromPersonality(input.personality, rng);
  const bio: PlayerBio = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    age: 15,
    birthYear: input.currentYear - 15,
    hometownCity: input.hometownCity.trim(),
    hometownState: input.hometownState.trim(),
    hand: input.hand,
    heightInches: input.heightInches,
    weightLbs: input.weightLbs,
  };

  let attributes = generateInitialAttributes(input.position, talent, rng);
  if (input.attributeAllocations) {
    attributes = applyPointBuy(attributes, input.position, input.attributeAllocations);
  }

  return {
    id: createId("player", rng),
    bio,
    position: input.position,
    personality: input.personality,
    attributes,
    stage: "high_school",
    retired: false,
  };
}

function clampTalentFromPersonality(personality: PersonalityTrait[], rng: RNG): number {
  // Talent is mostly random, with a small nudge for archetypes that imply
  // early dedication (disciplined/ambitious/competitive) — a light, legible
  // effect rather than a hard bonus.
  let base = rng.next();
  if (personality.includes("disciplined")) base += 0.05;
  if (personality.includes("ambitious")) base += 0.03;
  if (personality.includes("competitive")) base += 0.03;
  return Math.max(0, Math.min(1, base));
}

export const PERSONALITY_LABELS: Record<PersonalityTrait, string> = {
  ambitious: "Ambitious",
  loyal: "Loyal",
  disciplined: "Disciplined",
  charismatic: "Charismatic",
  aggressive: "Aggressive",
  introvert: "Introvert",
  risk_taker: "Risk Taker",
  family_oriented: "Family Oriented",
  materialistic: "Materialistic",
  competitive: "Competitive",
};

export const PERSONALITY_DESCRIPTIONS: Record<PersonalityTrait, string> = {
  ambitious: "Chases the spotlight and big moments; unlocks bolder career events.",
  loyal: "Values long-term relationships with teams, coaches, and agents.",
  disciplined: "Lower injury and off-field risk; steadier attribute growth.",
  charismatic: "Better with media and sponsors; builds fame faster.",
  aggressive: "Plays with an edge; higher variance on the field, more conflict events.",
  introvert: "Struggles with media buzz but rarely rattled by locker-room drama.",
  risk_taker: "Bigger swings in decisions — bigger rewards, bigger busts.",
  family_oriented: "Prioritizes home life; unlocks family-centered story events.",
  materialistic: "Cares about money and status; different free agency behavior.",
  competitive: "Confidence and performance respond strongly to winning and losing.",
};
