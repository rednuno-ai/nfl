import type { GameEventDefinition } from "../../types";

// =============================================================================
// High School events. ~15 seed events; architecture supports scaling to the
// full 50-event target from the design doc by adding more entries here —
// nothing else in the engine changes.
// =============================================================================

export const HIGH_SCHOOL_EVENTS: GameEventDefinition[] = [
  {
    id: "hs_first_scout_visit",
    category: "high_school",
    title: "A Scout Wants to Talk",
    description:
      "A scout from a mid-major program has been watching your film and wants to sit down for a conversation after practice.",
    conditions: { stage: ["high_school"], minAge: 15, probability: 0.4 },
    cooldownWeeks: 6,
    tags: ["recruiting"],
    choices: [
      {
        id: "accept",
        label: "Accept the meeting",
        description: "Hear them out and make a good impression.",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 3 }],
          relationshipDeltas: [{ targetTag: "media", delta: 2 }],
          addTags: ["met_first_scout"],
        },
      },
      {
        id: "decline",
        label: "Politely decline for now",
        description: "Focus on your game instead of the attention.",
        consequences: {
          attributeDeltas: [{ path: "general.discipline", delta: 2 }],
        },
      },
      {
        id: "coach_first",
        label: "Talk to your coach first",
        description: "Get advice before committing to anything.",
        consequences: {
          relationshipDeltas: [{ targetTag: "coach", delta: 4 }],
          attributeDeltas: [{ path: "mental.decisionMaking", delta: 1 }],
        },
      },
    ],
  },
  {
    id: "hs_two_a_days",
    category: "high_school",
    title: "Two-a-Day Practices",
    description: "Preseason camp is brutal. Your coach is pushing the team hard before the opener.",
    conditions: { stage: ["high_school"], probability: 0.5 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "grind",
        label: "Push through at full intensity",
        consequences: {
          attributeDeltas: [
            { path: "physical.stamina", delta: 3 },
            { path: "general.discipline", delta: 2 },
          ],
          injuryChance: 0.06,
        },
      },
      {
        id: "manage",
        label: "Manage your effort smartly",
        consequences: {
          attributeDeltas: [{ path: "physical.stamina", delta: 1 }],
          injuryChance: 0.015,
        },
      },
    ],
  },
  {
    id: "hs_disciplinary_issue",
    category: "high_school",
    title: "Called to the Principal's Office",
    description: "You were caught skipping class. The principal wants an explanation, and your coach already heard about it.",
    conditions: { stage: ["high_school"], probability: 0.15, maxAttribute: { path: "general.discipline", value: 60 } },
    cooldownWeeks: 15,
    tags: ["discipline"],
    choices: [
      {
        id: "own_it",
        label: "Own up to it and apologize",
        consequences: {
          attributeDeltas: [{ path: "general.discipline", delta: 4 }],
          relationshipDeltas: [{ targetTag: "coach", delta: 3 }],
        },
      },
      {
        id: "deflect",
        label: "Make excuses",
        consequences: {
          attributeDeltas: [{ path: "general.discipline", delta: -3 }],
          relationshipDeltas: [{ targetTag: "coach", delta: -6 }],
          news: {
            headline: "Discipline questions surface for young prospect",
            body: "Sources close to the program say off-field issues are becoming a pattern.",
            tone: "negative",
          },
        },
      },
    ],
  },
  {
    id: "hs_rivalry_game",
    category: "high_school",
    title: "Rivalry Week",
    description: "The whole town is talking about Friday's rivalry game. Cameras from a regional network will be there.",
    conditions: { stage: ["high_school"], minAge: 16, probability: 0.3 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "embrace",
        label: "Embrace the moment",
        consequences: {
          attributeDeltas: [
            { path: "mental.pressure", delta: 3 },
            { path: "general.confidence", delta: 2 },
          ],
          addTags: ["rivalry_hero"],
        },
      },
      {
        id: "stay_even",
        label: "Treat it like any other game",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
    ],
  },
  {
    id: "hs_offer_from_prestige_program",
    category: "high_school",
    title: "A Blue-Blood Program Calls",
    description: "One of the most storied programs in the country has extended a scholarship offer — a life-changing moment.",
    conditions: { stage: ["high_school"], minAge: 16, minAttribute: { path: "general.overall", value: 0 }, probability: 0.2 },
    cooldownWeeks: 40,
    once: false,
    tags: ["recruiting"],
    choices: [
      {
        id: "hype",
        label: "Post about it and let the hype build",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 8 }],
          news: {
            headline: "Blue-blood program offers local star",
            body: "The offer has recruiting analysts taking a much closer look.",
            tone: "positive",
          },
        },
      },
      {
        id: "quiet",
        label: "Keep it low-key for now",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "hs_study_hall",
    category: "high_school",
    title: "Grades Are Slipping",
    description: "Your academic advisor flags that your GPA is trending in the wrong direction, which could affect eligibility.",
    conditions: { stage: ["high_school"], probability: 0.2 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "hit_books",
        label: "Prioritize extra study time",
        consequences: { attributeDeltas: [{ path: "mental.decisionMaking", delta: 2 }, { path: "general.discipline", delta: 2 }] },
      },
      {
        id: "tutor",
        label: "Get a tutor through the athletic department",
        consequences: { cash: -50, attributeDeltas: [{ path: "mental.footballIQ", delta: 1 }] },
      },
      {
        id: "coast",
        label: "Coast on it — football comes first",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: -3 }] },
      },
    ],
  },
  {
    id: "hs_family_pressure",
    category: "high_school",
    title: "Family Expects a Decision Soon",
    description: "Your family wants to know how you're thinking about recruiting — and they have opinions.",
    conditions: { stage: ["high_school"], minAge: 17, probability: 0.25 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "listen",
        label: "Genuinely consider their input",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: 6 }] },
      },
      {
        id: "own_path",
        label: "Politely make clear this is your decision",
        consequences: {
          relationshipDeltas: [{ targetTag: "family", delta: -2 }],
          attributeDeltas: [{ path: "general.confidence", delta: 2 }],
        },
      },
    ],
  },
  {
    id: "hs_combine_camp_invite",
    category: "high_school",
    title: "Regional Combine Invite",
    description: "A regional prospect camp has invited you to test in front of college scouts.",
    conditions: { stage: ["high_school"], minAge: 16, probability: 0.25 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "compete",
        label: "Compete hard to boost your stock",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 4 }, { path: "physical.speed", delta: 1 }],
          injuryChance: 0.03,
        },
      },
      {
        id: "skip",
        label: "Skip it and rest instead",
        consequences: { attributeDeltas: [{ path: "physical.stamina", delta: 2 }] },
      },
    ],
  },
  {
    id: "hs_teammate_conflict",
    category: "high_school",
    title: "Locker Room Friction",
    description: "A teammate is upset you're getting more attention from scouts than they are.",
    conditions: { stage: ["high_school"], minFame: 15, probability: 0.15 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "squash_it",
        label: "Talk it out and squash it",
        consequences: { attributeDeltas: [{ path: "general.leadership", delta: 3 }] },
      },
      {
        id: "ignore",
        label: "Ignore it — not your problem",
        consequences: { attributeDeltas: [{ path: "general.leadership", delta: -2 }] },
      },
    ],
  },
  {
    id: "hs_state_championship",
    category: "high_school",
    title: "State Championship Berth",
    description: "Your team has fought its way into the state championship game. The pressure is enormous.",
    conditions: { stage: ["high_school"], minAge: 17, probability: 0.2 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "captain",
        label: "Step up as a vocal leader this week",
        consequences: {
          attributeDeltas: [{ path: "general.leadership", delta: 4 }, { path: "mental.pressure", delta: 3 }],
        },
      },
      {
        id: "lead_by_example",
        label: "Lead quietly by example",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "hs_growth_spurt",
    category: "high_school",
    title: "A Sudden Growth Spurt",
    description: "You've grown noticeably over the offseason, and your body feels different on the field.",
    conditions: { stage: ["high_school"], maxAge: 16, probability: 0.15 },
    cooldownWeeks: 999,
    once: true,
    tags: [],
    choices: [
      {
        id: "adjust_training",
        label: "Adjust your training to your new frame",
        consequences: { attributeDeltas: [{ path: "physical.strength", delta: 2 }, { path: "physical.agility", delta: -1 }] },
      },
      {
        id: "push_through",
        label: "Push through with your old routine",
        consequences: { injuryChance: 0.04 },
      },
    ],
  },
  {
    id: "hs_college_camp_invite",
    category: "high_school",
    title: "Summer Camp at a College Program",
    description: "A college program invited you to their summer prospect camp to work out in front of their staff.",
    conditions: { stage: ["high_school"], minAge: 15, probability: 0.25 },
    cooldownWeeks: 20,
    tags: ["recruiting"],
    choices: [
      {
        id: "attend_camp",
        label: "Attend the camp",
        consequences: { cash: -200, attributeDeltas: [{ path: "general.fame", delta: 3 } ] },
      },
      {
        id: "skip_camp",
        label: "Skip it — too far and too expensive",
        consequences: {},
      },
    ],
  },
  {
    id: "hs_social_media_following",
    category: "high_school",
    title: "Your Highlights Are Going Around",
    description: "A clip of one of your best plays is getting shared widely on recruiting social media accounts.",
    conditions: { stage: ["high_school"], minAge: 15, probability: 0.2 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "lean_in",
        label: "Lean into building your online following",
        consequences: { attributeDeltas: [{ path: "general.fame", delta: 5 } ] },
      },
      {
        id: "stay_grounded",
        label: "Stay grounded and ignore the attention",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 1 }] },
      },
    ],
  },
  {
    id: "hs_coach_relationship",
    category: "high_school",
    title: "Your Coach Takes an Interest",
    description: "Your head coach has started spending extra time with you after practice, clearly seeing something in you.",
    conditions: { stage: ["high_school"], probability: 0.2 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "soak_up_advice",
        label: "Soak up every bit of advice",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: 8 }], attributeDeltas: [{ path: "mental.footballIQ", delta: 2 }] },
      },
      {
        id: "keep_distance_coach",
        label: "Keep some distance — focus on peers instead",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: -2 }] },
      },
    ],
  },
  {
    id: "hs_recruiting_visit_conflict",
    category: "high_school",
    title: "Two Official Visits Overlap",
    description: "Two schools you're seriously considering scheduled their official visit weekends on the same dates.",
    conditions: { stage: ["high_school"], minAge: 16, minFame: 20, probability: 0.12 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "pick_top_choice",
        label: "Pick your current top choice",
        consequences: { attributeDeltas: [{ path: "mental.decisionMaking", delta: 2 }] },
      },
      {
        id: "ask_to_reschedule",
        label: "Ask one school to reschedule",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 1 }] },
      },
    ],
  },
];
