import type { NewsItem, NewsTone, SocialPost } from "./types";

// =============================================================================
// Press & social media generation. Deterministic templates driven by game
// state (no external AI dependency), matching the "core gameplay must work
// without an AI API" requirement. Headline variety comes from template pools,
// not hardcoded one-offs.
// =============================================================================

let counter = 0;
// Ids are derived from the week + a monotonic call counter rather than
// Date.now(), matching the same determinism contract as the rest of the
// engine (see finance.ts's purchaseAsset/addSponsorship): replaying the same
// seed + decisions should reproduce byte-identical ids, and Date.now() would
// make two runs of the same career diverge for no gameplay reason.
function nextId(prefix: string, week: number): string {
  counter += 1;
  return `${prefix}_${week}_${counter}`;
}

interface HeadlineContext {
  playerLastName: string;
  teamOrSchoolName?: string;
  week: number;
}

const PERFORMANCE_POSITIVE = [
  (c: HeadlineContext) => `${c.playerLastName} shines in statement performance`,
  (c: HeadlineContext) => `Rising star: ${c.playerLastName} is turning heads`,
  (c: HeadlineContext) => `${c.playerLastName} delivers when it matters most`,
  (c: HeadlineContext) => `Scouts buzzing after ${c.playerLastName}'s latest outing`,
];

const PERFORMANCE_NEGATIVE = [
  (c: HeadlineContext) => `Rough week for ${c.playerLastName}`,
  (c: HeadlineContext) => `Questions mount around ${c.playerLastName}'s consistency`,
  (c: HeadlineContext) => `${c.playerLastName} struggles as pressure builds`,
  (c: HeadlineContext) => `Is the hype outpacing the production for ${c.playerLastName}?`,
];

const CONTROVERSIAL = [
  (c: HeadlineContext) => `${c.playerLastName} sparks debate with bold comments`,
  (c: HeadlineContext) => `Coach and ${c.playerLastName} reportedly at odds`,
  (c: HeadlineContext) => `Locker room tension around ${c.playerLastName}, sources say`,
];

const NEUTRAL = [
  (c: HeadlineContext) => `${c.playerLastName} update: what to know this week`,
  (c: HeadlineContext) => `Inside ${c.teamOrSchoolName ?? "the program"}'s plan for ${c.playerLastName}`,
];

const BODY_POSITIVE = [
  "Analysts are taking notice, and the numbers back it up.",
  "It's the kind of performance that changes a season's trajectory.",
  "Teammates and coaches alike are pointing to a new level of confidence.",
];

const BODY_NEGATIVE = [
  "The performance has some wondering if adjustments are needed.",
  "Not the kind of week anyone wanted, and the questions are piling up.",
  "Pressure is mounting heading into the next matchup.",
];

const BODY_CONTROVERSIAL = [
  "Neither side is commenting on the record, but the tension is hard to miss.",
  "What happens next could shape the relationship for the rest of the season.",
];

const BODY_NEUTRAL = ["A routine update as the season rolls on.", "Nothing dramatic — just the steady grind of a long season."];

export function generatePerformanceNews(
  week: number,
  playerLastName: string,
  teamOrSchoolName: string,
  performanceScore: number, // -1..1, negative = bad game, positive = great game
  rng: { next: () => number }
): NewsItem | null {
  // Not every week produces news — only when something is notable.
  if (Math.abs(performanceScore) < 0.35 && rng.next() > 0.15) return null;

  const ctx: HeadlineContext = { playerLastName, teamOrSchoolName, week };
  let tone: NewsTone;
  let headlinePool: ((c: HeadlineContext) => string)[];
  let bodyPool: string[];

  if (performanceScore >= 0.35) {
    tone = "positive";
    headlinePool = PERFORMANCE_POSITIVE;
    bodyPool = BODY_POSITIVE;
  } else if (performanceScore <= -0.35) {
    tone = "negative";
    headlinePool = PERFORMANCE_NEGATIVE;
    bodyPool = BODY_NEGATIVE;
  } else {
    tone = "neutral";
    headlinePool = NEUTRAL;
    bodyPool = BODY_NEUTRAL;
  }

  const headlineFn = headlinePool[Math.floor(rng.next() * headlinePool.length)];
  const body = bodyPool[Math.floor(rng.next() * bodyPool.length)];

  return {
    id: nextId("news", week),
    week,
    headline: headlineFn(ctx),
    body,
    tone,
    source: pickSource(rng),
    requiresResponse: tone === "negative" && rng.next() > 0.5,
    responded: false,
    tags: ["performance"],
  };
}

export function generateControversyNews(week: number, playerLastName: string, rng: { next: () => number }): NewsItem {
  const headlineFn = CONTROVERSIAL[Math.floor(rng.next() * CONTROVERSIAL.length)];
  const body = BODY_CONTROVERSIAL[Math.floor(rng.next() * BODY_CONTROVERSIAL.length)];
  return {
    id: nextId("news", week),
    week,
    headline: headlineFn({ playerLastName, week }),
    body,
    tone: "controversial",
    source: pickSource(rng),
    requiresResponse: true,
    responded: false,
    tags: ["controversy"],
  };
}

const SOURCES = ["The Gridiron Report", "SportsWire", "Endzone Daily", "The Draft Beat", "Prime Time Sports Network", "The Locker Room Insider"];

function pickSource(rng: { next: () => number }): string {
  return SOURCES[Math.floor(rng.next() * SOURCES.length)];
}

const SOCIAL_HANDLES = ["@FootballInsider", "@GridironGuru", "@DraftDaddy", "@PrimeTimeTakes", "@TheRealAnalyst", "@FanZoneNFL"];

const SOCIAL_POSITIVE = ["Huge performance tonight. Future star.", "This kid is different. Watch out.", "Told y'all. Elite."];
const SOCIAL_NEGATIVE = ["Overrated.", "Not it tonight. Rough watch.", "Concerning trend the last few weeks."];
const SOCIAL_COMMENTS_POS = ["Facts.", "Called it months ago.", "MVP trajectory ngl", "Respect the grind 💪"];
const SOCIAL_COMMENTS_NEG = ["Hard disagree, still elite", "One bad week means nothing", "Y'all are so quick to turn"];

export function generateSocialPost(week: number, tone: "positive" | "negative", rng: { next: () => number }): SocialPost {
  const body = tone === "positive" ? pickFrom(SOCIAL_POSITIVE, rng) : pickFrom(SOCIAL_NEGATIVE, rng);
  const comments = Array.from({ length: 1 + Math.floor(rng.next() * 3) }, () =>
    pickFrom(tone === "positive" ? SOCIAL_COMMENTS_POS : SOCIAL_COMMENTS_NEG, rng)
  );
  return {
    id: nextId("social", week),
    week,
    handle: pickFrom(SOCIAL_HANDLES, rng),
    body,
    likes: Math.floor(rng.next() * 5000),
    comments,
    tone,
  };
}

function pickFrom<T>(arr: T[], rng: { next: () => number }): T {
  return arr[Math.floor(rng.next() * arr.length)];
}
