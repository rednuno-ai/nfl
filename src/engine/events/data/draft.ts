import type { GameEventDefinition } from "../../types";

export const DRAFT_EVENTS: GameEventDefinition[] = [
  {
    id: "draft_combine_invite",
    category: "draft",
    title: "Combine Invitation",
    description: "You've been invited to the national scouting combine — every rep will be measured and compared.",
    conditions: { stage: ["draft"], probability: 0.6 },
    cooldownWeeks: 52,
    once: true,
    tags: [],
    choices: [
      {
        id: "train_hard",
        label: "Train specifically for combine numbers",
        consequences: { attributeDeltas: [{ path: "physical.speed", delta: 1 }, { path: "physical.acceleration", delta: 1 }] },
      },
      {
        id: "train_football",
        label: "Keep training football skills instead",
        consequences: { attributeDeltas: [{ path: "mental.footballIQ", delta: 2 }] },
      },
    ],
  },
  {
    id: "draft_team_interview",
    category: "draft",
    title: "Team Interview Room",
    description: "A team's front office wants 15 minutes with you to ask some pointed questions.",
    conditions: { stage: ["draft"], probability: 0.5 },
    cooldownWeeks: 6,
    tags: [],
    choices: [
      {
        id: "confident",
        label: "Answer with confidence and swagger",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 2 }] },
      },
      {
        id: "humble",
        label: "Stay humble and coachable",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: 3 }] },
      },
    ],
  },
  {
    id: "draft_mock_draft_buzz",
    category: "draft",
    title: "Mock Drafts Are Circulating",
    description: "Analysts are publishing mock drafts, and your name is bouncing around wildly from round to round.",
    conditions: { stage: ["draft"], probability: 0.4 },
    cooldownWeeks: 4,
    tags: [],
    choices: [
      {
        id: "ignore_noise",
        label: "Ignore the noise",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
      {
        id: "engage_media",
        label: "Engage with the coverage on social media",
        consequences: { attributeDeltas: [{ path: "general.fame", delta: 3 } ] },
      },
    ],
  },
  {
    id: "draft_pro_day",
    category: "draft",
    title: "Pro Day at Your School",
    description: "Scouts are gathering at campus specifically to watch you work out one more time.",
    conditions: { stage: ["draft"], probability: 0.4 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "go_all_out",
        label: "Go all-out to boost your stock",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 3 } ], injuryChance: 0.04 },
      },
      {
        id: "conservative",
        label: "Play it conservative, protect your stock",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
    ],
  },
  {
    id: "draft_character_concern_leak",
    category: "draft",
    title: "A Report Raises Character Questions",
    description: "An anonymous team executive tells a reporter they have 'concerns' about your makeup.",
    conditions: { stage: ["draft"], maxAttribute: { path: "general.discipline", value: 55 }, probability: 0.2 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "respond_publicly",
        label: "Respond publicly and directly",
        consequences: { attributeDeltas: [{ path: "general.fame", delta: 2 }], relationshipDeltas: [{ targetTag: "media", delta: -2 }] },
      },
      {
        id: "stay_silent",
        label: "Stay silent and let your agent handle it",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
    ],
  },
  {
    id: "draft_night_call",
    category: "draft",
    title: "Draft Night: The Phone Rings",
    description: "It's finally here. Somewhere, a team is about to call your name.",
    conditions: { stage: ["draft"], probability: 1 },
    cooldownWeeks: 999,
    once: true,
    tags: [],
    choices: [
      {
        id: "acknowledge",
        label: "This is it.",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 5 }] },
      },
    ],
  },
  {
    id: "draft_agent_negotiation",
    category: "draft",
    title: "Pre-Draft Marketing Push",
    description: "Your agent wants to spend on a pre-draft PR push to raise your profile with teams picking near the top.",
    conditions: { stage: ["draft"], probability: 0.25 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "fund_push",
        label: "Fund the marketing push",
        consequences: { cash: -10000, attributeDeltas: [{ path: "general.fame", delta: 4 }] },
      },
      {
        id: "let_film_speak",
        label: "Let your film speak for itself",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 1 }] },
      },
    ],
  },
  {
    id: "draft_family_watch_party",
    category: "draft",
    title: "Where to Watch Draft Night",
    description: "Family and friends want to throw a big watch party for draft night. Cameras might even be there.",
    conditions: { stage: ["draft"], probability: 0.3 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "big_party",
        label: "Go big with a full watch party",
        consequences: {
          cash: -5000,
          relationshipDeltas: [{ targetTag: "family", delta: 6 }],
          attributeDeltas: [{ path: "general.fame", delta: 2 }],
        },
      },
      {
        id: "keep_it_small",
        label: "Keep it small and quiet",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
    ],
  },
  {
    id: "draft_slide_anxiety",
    category: "draft",
    title: "The Slide",
    description: "You expected to be picked by now, and round after round, your name still hasn't been called.",
    conditions: { stage: ["draft"], maxAttribute: { path: "general.confidence", value: 60 }, probability: 0.2 },
    cooldownWeeks: 999,
    once: true,
    tags: [],
    choices: [
      {
        id: "stay_composed",
        label: "Stay composed and trust the process",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 3 } ] },
      },
      {
        id: "channel_frustration",
        label: "Channel the frustration into motivation",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 3 }], narrativeMemory: "You slid further than expected on draft night and used it as fuel." },
      },
    ],
  },
];
