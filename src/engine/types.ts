// =============================================================================
// GRIDIRON LIFE — Core domain types
// -----------------------------------------------------------------------------
// This module has ZERO dependencies on React, Vite, or Supabase. It is pure,
// deterministic TypeScript so it can be unit tested in isolation and reused
// by any UI or backend. All game rules live in `src/engine/*`; the UI layer
// only ever reads state and dispatches intents into the engine.
// =============================================================================

export type Position = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "CB" | "S" | "K" | "P";

/** Positions with full MVP-depth simulation (attributes, stat lines, events tuned for them). */
export const MVP_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "LB", "CB"];

export const ALL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

export type Hand = "left" | "right";

export type PersonalityTrait =
  | "ambitious"
  | "loyal"
  | "disciplined"
  | "charismatic"
  | "aggressive"
  | "introvert"
  | "risk_taker"
  | "family_oriented"
  | "materialistic"
  | "competitive";

export type CareerStage =
  | "high_school"
  | "recruiting"
  | "college"
  | "draft"
  | "nfl_offseason"
  | "nfl_season"
  | "free_agency"
  | "retired";

// -----------------------------------------------------------------------------
// Attributes
// -----------------------------------------------------------------------------

/** General attributes every player has, regardless of position. */
export interface GeneralAttributes {
  overall: number; // derived, not stored directly (see attributes.ts computeOverall)
  potential: number; // 0-99 ceiling the player can reach with development
  fame: number; // 0-100 public recognition
  reputation: number; // 0-100 professional standing (media/league perception)
  confidence: number; // 0-100, volatile, affects performance
  morale: number; // 0-100, volatile, affects development & events
  discipline: number; // 0-100, affects injury/suspension risk & consistency
  leadership: number; // 0-100, affects locker room chemistry
}

export interface PhysicalAttributes {
  speed: number;
  acceleration: number;
  strength: number;
  agility: number;
  stamina: number;
  durability: number; // higher = lower injury risk
}

export interface MentalAttributes {
  decisionMaking: number;
  pressure: number; // composure under pressure
  composure: number;
  footballIQ: number;
}

/** Position-specific attribute blocks. Every player has all of them populated
 *  (irrelevant ones default low), which keeps storage simple, but only the
 *  block matching `player.position` is surfaced prominently in the UI. */
export interface QBAttributes {
  throwPower: number;
  shortAccuracy: number;
  mediumAccuracy: number;
  deepAccuracy: number;
  throwOnRun: number;
  awareness: number;
}

export interface RBAttributes {
  vision: number;
  carrying: number;
  elusiveness: number;
  breakTackle: number;
  passBlock: number;
}

export interface WRAttributes {
  catching: number;
  routeRunning: number;
  release: number;
  spectacularCatch: number;
}

export interface TEAttributes {
  catching: number;
  routeRunning: number;
  runBlock: number;
  passBlock: number;
}

export interface LBAttributes {
  tackling: number;
  blockShedding: number;
  coverage: number;
  pursuit: number;
}

export interface CBAttributes {
  manCoverage: number;
  zoneCoverage: number;
  press: number;
  ballHawk: number;
}

/** Generic block for positions outside the MVP depth set (OL/DL/S/K/P). */
export interface GenericPositionAttributes {
  blocking: number;
  tackling: number;
  technique: number;
  specialTeams: number;
}

export interface PositionAttributes {
  QB: QBAttributes;
  RB: RBAttributes;
  WR: WRAttributes;
  TE: TEAttributes;
  LB: LBAttributes;
  CB: CBAttributes;
  S: GenericPositionAttributes;
  OL: GenericPositionAttributes;
  DL: GenericPositionAttributes;
  K: GenericPositionAttributes;
  P: GenericPositionAttributes;
}

export interface Attributes {
  general: GeneralAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
  position: PositionAttributes;
}

// -----------------------------------------------------------------------------
// Player
// -----------------------------------------------------------------------------

export interface PlayerBio {
  firstName: string;
  lastName: string;
  age: number;
  birthYear: number;
  hometownCity: string;
  hometownState: string;
  hand: Hand;
  heightInches: number;
  weightLbs: number;
}

export interface Player {
  id: string;
  bio: PlayerBio;
  position: Position;
  personality: PersonalityTrait[];
  attributes: Attributes;
  stage: CareerStage;
  retired: boolean;
}

// -----------------------------------------------------------------------------
// Organizations: fictional colleges & NFL teams (no real-world licensing)
// -----------------------------------------------------------------------------

export interface College {
  id: string;
  name: string; // fictional
  mascot: string;
  conference: string;
  state: string;
  prestige: number; // 0-100, drives recruiting pull & draft exposure
  coachingQuality: number; // 0-100, drives development rate
  academics: number; // 0-100
  exposure: number; // 0-100, drives scouting/media visibility
  developmentRate: number; // multiplier applied to training gains
}

export interface Team {
  id: string;
  city: string; // fictional
  name: string; // fictional
  abbreviation: string;
  conference: "American" | "National"; // fictional analog, avoids real league abbreviations
  division: string;
  prestige: number; // 0-100
  marketSize: number; // 0-100, affects sponsorship $ and media pressure
  coachingQuality: number; // 0-100
  rosterStrength: number; // 0-100, avg quality of teammates
  headCoachName: string;
}

// -----------------------------------------------------------------------------
// Career progression records
// -----------------------------------------------------------------------------

export interface HighSchoolRecord {
  schoolName: string;
  coachName: string;
  city: string;
  state: string;
  classYear: 9 | 10 | 11 | 12;
  starRating: number; // 0-5, recruiting star rating, computed from performance
  stats: StatLine[];
}

export interface RecruitingOffer {
  collegeId: string;
  interestLevel: number; // 0-100
  offeredAt: number; // week index
  scholarship: boolean;
}

export interface CollegeRecord {
  collegeId: string;
  yearsPlayed: number;
  redshirted: boolean;
  transferred: boolean;
  major: string;
  gpa: number;
  nilEarnings: number;
  stats: StatLine[];
  declaredForDraft: boolean;
}

export interface DraftProjection {
  projectedRoundLow: number;
  projectedRoundHigh: number;
  stock: number; // 0-100, rising/falling
  interestedTeamIds: string[];
  combineScores?: CombineScores;
}

export interface CombineScores {
  fortyYardDash: number; // seconds
  verticalJump: number; // inches
  broadJump: number; // inches
  benchPressReps: number;
  threeCone: number; // seconds
  interviewScore: number; // 0-100
}

export interface DraftResult {
  year: number;
  round: number; // 0 = undrafted
  pick: number; // overall pick, 0 = undrafted
  teamId: string | null;
}

export interface Contract {
  teamId: string;
  years: number;
  totalValue: number;
  signingBonus: number;
  guaranteedMoney: number;
  annualSalary: number[]; // length == years
  startYear: number;
  currentYear: number; // index into annualSalary while active
  rookieDeal: boolean;
}

// -----------------------------------------------------------------------------
// Statistics
// -----------------------------------------------------------------------------

export interface StatLine {
  season: number;
  level: "high_school" | "college" | "nfl";
  teamOrSchoolId: string;
  gamesPlayed: number;
  gamesStarted: number;
  // Offense
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTDs: number;
  interceptionsThrown: number;
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  fumbles: number;
  // Defense
  tackles: number;
  sacks: number;
  interceptions: number;
  passesDefended: number;
  forcedFumbles: number;
  // Meta
  proBowl: boolean;
  allPro: boolean;
  mvp: boolean;
  championshipWon: boolean;
}

export function emptyStatLine(season: number, level: StatLine["level"], teamOrSchoolId: string): StatLine {
  return {
    season,
    level,
    teamOrSchoolId,
    gamesPlayed: 0,
    gamesStarted: 0,
    passAttempts: 0,
    passCompletions: 0,
    passYards: 0,
    passTDs: 0,
    interceptionsThrown: 0,
    rushAttempts: 0,
    rushYards: 0,
    rushTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
    fumbles: 0,
    tackles: 0,
    sacks: 0,
    interceptions: 0,
    passesDefended: 0,
    forcedFumbles: 0,
    proBowl: false,
    allPro: false,
    mvp: false,
    championshipWon: false,
  };
}

// -----------------------------------------------------------------------------
// Injuries
// -----------------------------------------------------------------------------

export type InjurySeverity = "minor" | "moderate" | "severe" | "career_threatening";

export interface Injury {
  id: string;
  type: string; // e.g. "Ankle sprain", "Torn ACL"
  severity: InjurySeverity;
  weekOccurred: number;
  recoveryWeeks: number;
  weeksRemaining: number;
  performancePenalty: number; // 0-1, multiplier reduction while recovering
  reinjuryRisk: number; // 0-1 chance per week of setback while playing hurt
  playedThrough: boolean;
}

// -----------------------------------------------------------------------------
// Relationships
// -----------------------------------------------------------------------------

export type RelationshipType = "coach" | "teammate" | "family" | "friend" | "agent" | "partner" | "media" | "booster";

export interface Relationship {
  id: string;
  name: string;
  type: RelationshipType;
  value: number; // 0-100
  tags: string[]; // e.g. ["recruited_you", "betrayed"], used by event conditions for callbacks
  history: { week: number; note: string }[];
}

// -----------------------------------------------------------------------------
// Finance
// -----------------------------------------------------------------------------

export interface Asset {
  id: string;
  name: string;
  type: "house" | "car" | "investment" | "business" | "luxury";
  value: number;
  weeklyUpkeep: number;
  weeklyReturn: number; // for investments, expected weekly return (can be negative)
  purchasedWeek: number;
}

export interface FinanceState {
  cash: number;
  netWorth: number;
  weeklyExpenses: number;
  totalCareerEarnings: number;
  totalTaxesPaid: number;
  debt: number;
  assets: Asset[];
  sponsorships: Sponsorship[];
}

export interface Sponsorship {
  id: string;
  brand: string;
  weeklyValue: number;
  weeksRemaining: number;
  requiresFame: number;
}

// -----------------------------------------------------------------------------
// News & Media
// -----------------------------------------------------------------------------

export type NewsTone = "positive" | "negative" | "neutral" | "controversial";

export interface NewsItem {
  id: string;
  week: number;
  headline: string;
  body: string;
  tone: NewsTone;
  source: string;
  requiresResponse: boolean;
  responded: boolean;
  tags: string[];
}

export interface SocialPost {
  id: string;
  week: number;
  handle: string;
  body: string;
  likes: number;
  comments: string[];
  tone: NewsTone;
}

// -----------------------------------------------------------------------------
// Achievements
// -----------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedWeek: number | null;
}

// -----------------------------------------------------------------------------
// Decisions & Events (data-driven event engine)
// -----------------------------------------------------------------------------

export interface EventCondition {
  stage?: CareerStage[];
  minAge?: number;
  maxAge?: number;
  positions?: Position[];
  minAttribute?: { path: string; value: number };
  maxAttribute?: { path: string; value: number };
  minCoachRelationship?: number;
  maxCoachRelationship?: number;
  minFame?: number;
  maxFame?: number;
  tagsPresent?: string[]; // world/player tags that must be present (e.g. from relationships/history)
  tagsAbsent?: string[];
  probability?: number; // 0-1 base chance this event fires when eligible
}

export interface AttributeDelta {
  path: string; // dotted path into Attributes, e.g. "general.confidence"
  delta: number;
}

export interface RelationshipDelta {
  targetTag: "coach" | "team" | "media" | "fans" | "family" | "partner" | string;
  delta: number;
}

export interface EventConsequence {
  attributeDeltas?: AttributeDelta[];
  relationshipDeltas?: RelationshipDelta[];
  cash?: number;
  addTags?: string[];
  removeTags?: string[];
  news?: { headline: string; body: string; tone: NewsTone };
  injuryChance?: number; // 0-1
  tradeProbabilityDelta?: number;
  narrativeMemory?: string; // stored so future events can reference it
}

export interface EventChoice {
  id: string;
  label: string;
  description?: string;
  consequences: EventConsequence;
}

export interface GameEventDefinition {
  id: string;
  category: "high_school" | "college" | "draft" | "nfl" | "personal" | "injury" | "media";
  title: string;
  description: string;
  conditions: EventCondition;
  choices: EventChoice[];
  cooldownWeeks: number; // minimum weeks before this event can fire again for this career
  once?: boolean; // fires at most once per career
  tags: string[];
}

export interface PendingDecision {
  eventId: string;
  title: string;
  description: string;
  choices: EventChoice[];
  week: number;
}

export interface ResolvedDecision {
  eventId: string;
  title: string;
  choiceId: string;
  choiceLabel: string;
  week: number;
}

// -----------------------------------------------------------------------------
// Legacy / retirement
// -----------------------------------------------------------------------------

export type LegacyTier = "bust" | "solid_career" | "star" | "superstar" | "legend" | "hall_of_fame";

export interface LegacyResult {
  tier: LegacyTier;
  score: number;
  summary: string;
  seasonsPlayed: number;
  gamesPlayed: number;
  championships: number;
  proBowls: number;
  allPros: number;
  mvps: number;
  careerEarnings: number;
  netWorth: number;
}
