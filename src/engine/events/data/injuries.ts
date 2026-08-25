import type { GameEventDefinition } from "../../types";

export const INJURY_EVENTS: GameEventDefinition[] = [
  {
    id: "injury_play_through_minor",
    category: "injury",
    title: "Play Through a Minor Injury?",
    description: "You're banged up but the trainers say it's minor. The next game is a big one.",
    conditions: { tagsPresent: ["has_active_injury_minor"], probability: 1 },
    cooldownWeeks: 1,
    tags: [],
    choices: [
      {
        id: "play_hurt",
        label: "Play through it",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 2 }] },
      },
      {
        id: "sit_week",
        label: "Sit this week to be safe",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: 1 }] },
      },
    ],
  },
  {
    id: "injury_second_opinion",
    category: "injury",
    title: "Get a Second Opinion?",
    description: "The team doctor has a diagnosis, but your agent suggests seeing an independent specialist.",
    conditions: { tagsPresent: ["has_active_injury_moderate"], probability: 0.5 },
    cooldownWeeks: 10,
    tags: [],
    choices: [
      {
        id: "second_opinion",
        label: "Get a second opinion",
        consequences: { cash: -2000, attributeDeltas: [{ path: "physical.durability", delta: 1 }] },
      },
      {
        id: "trust_team",
        label: "Trust the team doctor",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: 2 }] },
      },
    ],
  },
  {
    id: "injury_rehab_intensity",
    category: "injury",
    title: "Rehab Approach",
    description: "Recovery is underway. How hard do you push the rehab program?",
    conditions: { tagsPresent: ["has_active_injury_severe"], probability: 0.6 },
    cooldownWeeks: 6,
    tags: [],
    choices: [
      {
        id: "aggressive_rehab",
        label: "Push hard to return faster",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: -1 }] },
      },
      {
        id: "patient_rehab",
        label: "Follow the conservative timeline",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: 2 }] },
      },
    ],
  },
  {
    id: "injury_career_threatening_decision",
    category: "injury",
    title: "A Career-Altering Diagnosis",
    description: "The news is serious. Doctors are split on whether you can return to your previous level.",
    conditions: { tagsPresent: ["has_active_injury_career_threatening"], probability: 1 },
    cooldownWeeks: 999,
    once: true,
    tags: [],
    choices: [
      {
        id: "fight_back",
        label: "Commit everything to the comeback",
        consequences: {
          attributeDeltas: [{ path: "general.discipline", delta: 5 }],
          narrativeMemory: "You fought back from a career-threatening injury.",
          addTags: ["comeback_story"],
        },
      },
      {
        id: "consider_retirement",
        label: "Start thinking about what comes next",
        consequences: { addTags: ["considering_retirement"] },
      },
    ],
  },
  {
    id: "injury_reinjury_scare",
    category: "injury",
    title: "Something Feels Off Again",
    description: "In practice, you feel a familiar twinge in the same spot that gave you trouble before.",
    conditions: { tagsPresent: ["comeback_story"], probability: 0.15 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "report_it",
        label: "Report it to the training staff immediately",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: 1 }] },
      },
      {
        id: "play_through_it",
        label: "Play through it and hope it's nothing",
        consequences: { injuryChance: 0.3 },
      },
    ],
  },
  {
    id: "injury_offseason_surgery_choice",
    category: "injury",
    title: "Elective Offseason Surgery",
    description: "A nagging issue could be fixed with a minor surgery now, during the offseason, instead of risking it flaring up later.",
    conditions: { stage: ["nfl_offseason", "college"], minAge: 20, probability: 0.1 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "get_surgery",
        label: "Get it done now while there's time to recover",
        consequences: { cash: -8000, attributeDeltas: [{ path: "physical.durability", delta: 3 }] },
      },
      {
        id: "skip_surgery",
        label: "Skip it — don't want to lose training time",
        consequences: { injuryChance: 0.08 },
      },
    ],
  },
  {
    id: "injury_teammate_recovery_advice",
    category: "injury",
    title: "A Teammate Asks How You Recovered",
    description: "A younger teammate going through their first serious injury asks how you got through yours.",
    conditions: { tagsPresent: ["comeback_story"], probability: 0.12 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "share_openly",
        label: "Share openly, including the hard parts",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 6 }], attributeDeltas: [{ path: "general.leadership", delta: 2 }] },
      },
      {
        id: "keep_it_brief",
        label: "Give brief, practical advice",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 2 }] },
      },
    ],
  },
  {
    id: "injury_experimental_treatment",
    category: "injury",
    title: "An Experimental Treatment Option",
    description: "Your medical team mentions a newer, less-proven treatment that could speed up recovery — or do nothing at all.",
    conditions: { tagsPresent: ["has_active_injury_moderate"], probability: 0.2 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "try_experimental",
        label: "Try it — worth the risk",
        consequences: { cash: -15000, attributeDeltas: [{ path: "physical.durability", delta: 2 }] },
      },
      {
        id: "stick_with_standard",
        label: "Stick with the standard protocol",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: 1 }] },
      },
    ],
  },
  {
    id: "injury_playing_through_pain_reputation",
    category: "injury",
    title: "Word Gets Out You Played Hurt",
    description: "Reporters found out you played through pain last week without telling anyone. Reactions are mixed.",
    conditions: { tagsPresent: ["has_active_injury_minor"], probability: 0.1 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "embrace_toughness",
        label: "Embrace the tough-guy reputation",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 3 }, { path: "general.fame", delta: 2 }] },
      },
      {
        id: "downplay_it",
        label: "Downplay it — don't want to encourage risky habits",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: 2 }] },
      },
    ],
  },
];
