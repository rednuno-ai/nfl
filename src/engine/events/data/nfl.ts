import type { GameEventDefinition } from "../../types";

export const NFL_EVENTS: GameEventDefinition[] = [
  {
    id: "nfl_rookie_hazing",
    category: "nfl",
    title: "Rookie Duties",
    description: "Veterans expect rookies to carry the pads, buy the donuts, and take some good-natured ribbing.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], maxAge: 23, probability: 0.3 },
    cooldownWeeks: 30,
    once: true,
    tags: [],
    choices: [
      {
        id: "embrace",
        label: "Embrace it with good humor",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 6 }] },
      },
      {
        id: "resist",
        label: "Push back on it",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: -4 }], attributeDeltas: [{ path: "general.leadership", delta: 1 }] },
      },
    ],
  },
  {
    id: "nfl_coach_criticism",
    category: "nfl",
    title: "Coach Calls You Out",
    description: "In the film room, your position coach singles out your mistakes in front of the whole unit.",
    conditions: { stage: ["nfl_season"], probability: 0.25 },
    cooldownWeeks: 10,
    tags: [],
    choices: [
      {
        id: "take_it",
        label: "Take the criticism and work harder",
        consequences: { attributeDeltas: [{ path: "mental.decisionMaking", delta: 2 }], relationshipDeltas: [{ targetTag: "coach", delta: 3 }] },
      },
      {
        id: "push_back",
        label: "Push back in the moment",
        consequences: { relationshipDeltas: [{ targetTag: "coach", delta: -8 }], attributeDeltas: [{ path: "general.confidence", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_captaincy_offer",
    category: "nfl",
    title: "Team Captain Vote",
    description: "The locker room is voting on team captains for the season, and your name has come up.",
    conditions: { stage: ["nfl_offseason"], minAttribute: { path: "general.leadership", value: 55 }, probability: 0.3 },
    cooldownWeeks: 40,
    tags: [],
    choices: [
      {
        id: "accept_role",
        label: "Accept the responsibility",
        consequences: {
          attributeDeltas: [{ path: "general.leadership", delta: 4 }, { path: "general.fame", delta: 3 }],
          addTags: ["team_captain"],
        },
      },
      {
        id: "defer",
        label: "Defer to a veteran teammate",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 3 }] },
      },
    ],
  },
  {
    id: "nfl_contract_extension_talk",
    category: "nfl",
    title: "Extension Talks Begin",
    description: "Your agent says the front office wants to open extension conversations before the season starts.",
    conditions: { stage: ["nfl_offseason"], probability: 0.15 },
    cooldownWeeks: 52,
    tags: [],
    choices: [
      {
        id: "negotiate_now",
        label: "Negotiate now for security",
        consequences: { addTags: ["seeking_extension"] },
      },
      {
        id: "bet_on_self",
        label: "Bet on yourself and wait",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 3 }] },
      },
    ],
  },
  {
    id: "nfl_charity_event",
    category: "nfl",
    title: "Charity Appearance Request",
    description: "A local children's hospital has asked you to make an appearance this week.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], probability: 0.2 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "attend",
        label: "Attend and spend real time there",
        consequences: {
          attributeDeltas: [{ path: "general.reputation", delta: 5 }, { path: "general.fame", delta: 2 }],
          news: { headline: "Player spends off day giving back", body: "The visit meant the world to the kids at the hospital.", tone: "positive" },
        },
      },
      {
        id: "decline",
        label: "Decline — need the rest",
        consequences: { attributeDeltas: [{ path: "physical.stamina", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_trade_rumor",
    category: "nfl",
    title: "Trade Rumors Swirl",
    description: "Your agent hears the team is fielding calls about you ahead of the deadline.",
    conditions: { stage: ["nfl_season"], maxCoachRelationship: 50, probability: 0.15 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "stay_professional",
        label: "Stay professional, ignore the noise",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
      {
        id: "request_trade",
        label: "Ask your agent to push for a trade",
        consequences: { tradeProbabilityDelta: 0.25, relationshipDeltas: [{ targetTag: "coach", delta: -5 }] },
      },
    ],
  },
  {
    id: "nfl_endorsement_opportunity",
    category: "nfl",
    title: "National Brand Comes Calling",
    description: "A national brand wants you as the face of a regional campaign.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], minFame: 40, probability: 0.2 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "sign_deal",
        label: "Sign the endorsement deal",
        consequences: { cash: 15000, attributeDeltas: [{ path: "general.fame", delta: 4 }] },
      },
      {
        id: "pass",
        label: "Pass — keep focus on football",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 1 }] },
      },
    ],
  },
  {
    id: "nfl_locker_room_leader_needed",
    category: "nfl",
    title: "The Team Needs a Voice",
    description: "After a tough loss, the locker room is quiet. Someone needs to say something.",
    conditions: { stage: ["nfl_season"], probability: 0.2 },
    cooldownWeeks: 10,
    tags: [],
    choices: [
      {
        id: "speak_up",
        label: "Speak up",
        consequences: { attributeDeltas: [{ path: "general.leadership", delta: 4 }], relationshipDeltas: [{ targetTag: "team", delta: 5 }] },
      },
      {
        id: "stay_quiet",
        label: "Let a veteran handle it",
        consequences: {},
      },
    ],
  },
  {
    id: "nfl_playoff_pressure",
    category: "nfl",
    title: "Playoff Push",
    description: "The team is fighting for a playoff spot in the final stretch. Every game matters.",
    conditions: { stage: ["nfl_season"], probability: 0.25 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "play_hurt",
        label: "Play through the bumps and bruises",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 2 }], injuryChance: 0.08 },
      },
      {
        id: "manage_load",
        label: "Manage your workload carefully",
        consequences: { attributeDeltas: [{ path: "physical.stamina", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_veteran_mentor",
    category: "nfl",
    title: "A Veteran Takes You Under Their Wing",
    description: "A respected veteran teammate offers to mentor you through the ups and downs of the league.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], maxAge: 26, probability: 0.2 },
    cooldownWeeks: 52,
    once: true,
    tags: [],
    choices: [
      {
        id: "accept_mentor",
        label: "Gladly accept",
        consequences: {
          attributeDeltas: [{ path: "mental.footballIQ", delta: 3 }],
          relationshipDeltas: [{ targetTag: "team", delta: 5 }],
          narrativeMemory: "A veteran mentor helped you learn the league early in your career.",
        },
      },
      {
        id: "go_alone",
        label: "Prefer to figure it out yourself",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_holdout_decision",
    category: "nfl",
    title: "Contract Dispute Heats Up",
    description: "You feel underpaid relative to the market. Your agent asks how far you want to push this.",
    conditions: { stage: ["nfl_offseason"], minFame: 30, probability: 0.15 },
    cooldownWeeks: 60,
    tags: [],
    choices: [
      {
        id: "holdout",
        label: "Hold out of camp",
        consequences: {
          attributeDeltas: [{ path: "general.confidence", delta: 3 }, { path: "physical.stamina", delta: -2 }],
          relationshipDeltas: [{ targetTag: "team", delta: -8 }],
          news: { headline: "Star player holds out over contract", body: "Front office says talks are ongoing.", tone: "controversial" },
          narrativeMemory: "You held out for a new contract, straining your relationship with the front office.",
        },
      },
      {
        id: "report_and_play",
        label: "Report to camp and let your play do the talking",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 5 }], attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_position_battle",
    category: "nfl",
    title: "Training Camp Competition",
    description: "The coaching staff has opened up a real competition for your starting job.",
    conditions: { stage: ["nfl_offseason"], probability: 0.25 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "outwork",
        label: "Outwork everyone in camp",
        consequences: {
          attributeDeltas: [{ path: "general.confidence", delta: 4 }, { path: "physical.stamina", delta: -3 }],
          injuryChance: 0.05,
        },
      },
      {
        id: "trust_track_record",
        label: "Trust your track record and manage your workload",
        consequences: { attributeDeltas: [{ path: "physical.durability", delta: 1 }] },
      },
    ],
  },
  {
    id: "nfl_rival_week",
    category: "nfl",
    title: "Rivalry Week",
    description: "The whole city is talking about this week's game against your team's oldest rival.",
    conditions: { stage: ["nfl_season"], probability: 0.2 },
    cooldownWeeks: 16,
    tags: [],
    choices: [
      {
        id: "embrace_spotlight",
        label: "Embrace the extra attention",
        consequences: { attributeDeltas: [{ path: "general.fame", delta: 3 }, { path: "mental.pressure", delta: 2 }] },
      },
      {
        id: "treat_normally",
        label: "Treat it like any other game",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
    ],
  },
  {
    id: "nfl_podcast_invite",
    category: "nfl",
    title: "A Popular Podcast Wants You On",
    description: "A well-known sports podcast has invited you on for a long-form, unfiltered interview.",
    conditions: { stage: ["nfl_offseason", "nfl_season"], minFame: 25, probability: 0.15 },
    cooldownWeeks: 26,
    tags: [],
    choices: [
      {
        id: "go_candid",
        label: "Go on and be candid",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 5 }, { path: "general.reputation", delta: -2 }],
          news: { headline: "Player opens up in viral podcast appearance", body: "The interview is generating plenty of discussion.", tone: "neutral" },
        },
      },
      {
        id: "keep_it_safe",
        label: "Go on but keep answers safe",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 2 }] },
      },
      {
        id: "decline_podcast",
        label: "Politely decline",
        consequences: {},
      },
    ],
  },
  {
    id: "nfl_community_program",
    category: "nfl",
    title: "Community Outreach Opportunity",
    description: "The team's foundation is launching a youth program in your name and wants your involvement.",
    conditions: { stage: ["nfl_offseason"], probability: 0.12 },
    cooldownWeeks: 40,
    tags: [],
    choices: [
      {
        id: "get_involved",
        label: "Get personally involved",
        consequences: {
          attributeDeltas: [{ path: "general.reputation", delta: 6 }, { path: "general.leadership", delta: 2 }],
          cash: -50000,
          news: { headline: "Player launches community youth program", body: "Local fans praise the initiative.", tone: "positive" },
        },
      },
      {
        id: "fund_only",
        label: "Fund it but stay behind the scenes",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 2 }], cash: -15000 },
      },
    ],
  },
  {
    id: "nfl_offseason_workout_choice",
    category: "nfl",
    title: "Voluntary Offseason Program",
    description: "The team's voluntary workout program starts next week. Attendance is optional but noticed.",
    conditions: { stage: ["nfl_offseason"], probability: 0.3 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "attend_all",
        label: "Attend every session",
        consequences: {
          attributeDeltas: [{ path: "physical.stamina", delta: 2 }],
          relationshipDeltas: [{ targetTag: "team", delta: 4 }],
        },
      },
      {
        id: "train_privately",
        label: "Train on your own program instead",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 1 }], relationshipDeltas: [{ targetTag: "team", delta: -2 }] },
      },
    ],
  },
  {
    id: "nfl_milestone_chase",
    category: "nfl",
    title: "Chasing a Milestone",
    description: "With a few games left in the season, a meaningful career milestone is within reach.",
    conditions: { stage: ["nfl_season"], minAge: 26, probability: 0.12 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "chase_it",
        label: "Push to reach it, even if it means extra reps",
        consequences: { attributeDeltas: [{ path: "general.confidence", delta: 3 }, { path: "physical.stamina", delta: -3 }], injuryChance: 0.04 },
      },
      {
        id: "let_it_come",
        label: "Let it come naturally within the game plan",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
    ],
  },
  {
    id: "nfl_locker_room_conflict",
    category: "nfl",
    title: "Tension in the Locker Room",
    description: "Two teammates have been at odds for weeks, and it's starting to affect the group.",
    conditions: { stage: ["nfl_season"], minAttribute: { path: "general.leadership", value: 40 }, probability: 0.1 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "mediate",
        label: "Step in and mediate",
        consequences: {
          attributeDeltas: [{ path: "general.leadership", delta: 4 }],
          relationshipDeltas: [{ targetTag: "team", delta: 6 }],
        },
      },
      {
        id: "stay_out_of_it",
        label: "Stay out of it — not your business",
        consequences: {},
      },
    ],
  },
];
