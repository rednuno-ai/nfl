import type { GameEventDefinition } from "../../types";

export const COLLEGE_EVENTS: GameEventDefinition[] = [
  {
    id: "college_nil_deal",
    category: "college",
    title: "NIL Deal on the Table",
    description: "A local business wants to pay for your name, image, and likeness — a small but real paycheck.",
    conditions: { stage: ["college"], minFame: 10, probability: 0.3 },
    cooldownWeeks: 10,
    tags: [],
    choices: [
      {
        id: "sign",
        label: "Sign the NIL deal",
        consequences: { cash: 800, addTags: ["has_nil_deal"] },
      },
      {
        id: "pass",
        label: "Pass — focus on football",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 1 }] },
      },
    ],
  },
  {
    id: "college_depth_chart_battle",
    category: "college",
    title: "Fighting for the Starting Job",
    description: "Preseason camp is a dogfight for the starting role at your position.",
    conditions: { stage: ["college"], probability: 0.35 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "extra_reps",
        label: "Ask the coaching staff for extra reps",
        consequences: {
          attributeDeltas: [{ path: "mental.footballIQ", delta: 2 }],
          relationshipDeltas: [{ targetTag: "coach", delta: 2 }],
          injuryChance: 0.02,
        },
      },
      {
        id: "film_study",
        label: "Outwork everyone in film study",
        consequences: { attributeDeltas: [{ path: "mental.decisionMaking", delta: 3 }] },
      },
    ],
  },
  {
    id: "college_party_invite",
    category: "college",
    title: "Big Party Invite",
    description: "There's a huge party this weekend and half the team is going. It's the night before a short-week practice.",
    conditions: { stage: ["college"], probability: 0.25 },
    cooldownWeeks: 10,
    tags: [],
    choices: [
      {
        id: "go",
        label: "Go and let loose",
        consequences: {
          attributeDeltas: [{ path: "general.morale", delta: 6 }, { path: "physical.stamina", delta: -3 }],
          relationshipDeltas: [{ targetTag: "team", delta: 3 }],
        },
      },
      {
        id: "skip_study",
        label: "Skip it and rest/study",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "college_transfer_temptation",
    category: "college",
    title: "The Transfer Portal Beckons",
    description: "You're buried on the depth chart and another program has reached out through back channels about the transfer portal.",
    conditions: { stage: ["college"], maxCoachRelationship: 45, probability: 0.2 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "enter_portal",
        label: "Enter the transfer portal",
        consequences: {
          addTags: ["entered_transfer_portal"],
          relationshipDeltas: [{ targetTag: "coach", delta: -10 }],
          news: { headline: "Prospect enters transfer portal", body: "A fresh start could be exactly what's needed.", tone: "neutral" },
        },
      },
      {
        id: "stay_fight",
        label: "Stay and fight for your spot",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 3 }] },
      },
    ],
  },
  {
    id: "college_academic_honor",
    category: "college",
    title: "Academic All-Conference Nod",
    description: "Your GPA earned you a nomination for academic honors — a nice story alongside the on-field production.",
    conditions: { stage: ["college"], probability: 0.15 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "accept_honor",
        label: "Accept and represent the program well",
        consequences: {
          attributeDeltas: [{ path: "general.reputation", delta: 4 }],
          news: { headline: "Student-athlete earns academic recognition", body: "Balancing the classroom and the field.", tone: "positive" },
        },
      },
    ],
  },
  {
    id: "college_bowl_game",
    category: "college",
    title: "Bowl Game Selection",
    description: "Your team earned a bowl bid. It's a chance to close the season strong and boost draft stock.",
    conditions: { stage: ["college"], minAge: 18, probability: 0.2 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "play_in_bowl",
        label: "Play — leave it all on the field",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 5 }],
          injuryChance: 0.05,
        },
      },
      {
        id: "sit_out",
        label: "Sit out to protect draft stock",
        consequences: {
          attributeDeltas: [{ path: "general.reputation", delta: -2 }],
          relationshipDeltas: [{ targetTag: "coach", delta: -4 }],
        },
      },
    ],
  },
  {
    id: "college_coach_fired",
    category: "college",
    title: "Coaching Change",
    description: "Your head coach was fired after a disappointing stretch. A new system is coming.",
    conditions: { stage: ["college"], probability: 0.08 },
    cooldownWeeks: 40,
    tags: [],
    choices: [
      {
        id: "adapt",
        label: "Commit to learning the new system",
        consequences: { attributeDeltas: [{ path: "mental.footballIQ", delta: 2 }] },
      },
      {
        id: "consider_leaving",
        label: "Consider your options",
        consequences: { addTags: ["considering_transfer"] },
      },
    ],
  },
  {
    id: "college_draft_declare_decision",
    category: "college",
    title: "Declare for the Draft?",
    description: "Underclassman deadline is approaching. Your agent-in-waiting thinks you could go in the first three rounds.",
    conditions: { stage: ["college"], minAge: 19, probability: 0.25 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "declare_early",
        label: "Declare early for the draft",
        consequences: { addTags: ["declared_early"] },
      },
      {
        id: "stay_school",
        label: "Stay in school another year",
        consequences: { attributeDeltas: [{ path: "mental.footballIQ", delta: 2 }] },
      },
    ],
  },
  {
    id: "college_agent_pitch",
    category: "college",
    title: "Agents Are Circling",
    description: "Several agents have reached out ahead of the draft process, each with a different pitch.",
    conditions: { stage: ["college"], minAge: 19, probability: 0.2 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "big_agency",
        label: "Go with a big, established agency",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 2 }] },
      },
      {
        id: "boutique_agent",
        label: "Go with a smaller, hungrier agent",
        consequences: { relationshipDeltas: [{ targetTag: "agent", delta: 8 }] },
      },
    ],
  },
  {
    id: "college_roommate_conflict",
    category: "college",
    title: "Roommate Trouble",
    description: "Your roommate, also on the team, has been slacking on everything from chores to curfew and it's starting to grate.",
    conditions: { stage: ["college"], probability: 0.15 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "address_directly",
        label: "Address it directly",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 3 }], attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
      {
        id: "request_new_room",
        label: "Ask to switch rooms",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: -2 }] },
      },
    ],
  },
  {
    id: "college_booster_gift",
    category: "college",
    title: "A Booster Offers a 'Gift'",
    description: "A wealthy program booster offers you something valuable, no strings attached — officially, anyway.",
    conditions: { stage: ["college"], minFame: 15, probability: 0.1 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "accept_gift",
        label: "Accept it",
        consequences: { cash: 3000, relationshipDeltas: [{ targetTag: "booster", delta: 6 }], addTags: ["booster_ties"] },
      },
      {
        id: "decline_gift",
        label: "Decline — too risky",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 1 }] },
      },
    ],
  },
  {
    id: "college_rivalry_game_hype",
    category: "college",
    title: "Rivalry Week",
    description: "The whole campus has been buzzing for a week about this game against your biggest rival.",
    conditions: { stage: ["college"], probability: 0.2 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "soak_it_in",
        label: "Soak in the atmosphere and feed off the crowd",
        consequences: { attributeDeltas: [{ path: "general.morale", delta: 5 }, { path: "mental.pressure", delta: 2 }] },
      },
      {
        id: "treat_normal",
        label: "Treat it like any other game",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
    ],
  },
  {
    id: "college_combine_invite_prep",
    category: "college",
    title: "Combine Training Camp",
    description: "You've been invited to a specialized pre-draft training facility to prepare for the scouting combine.",
    conditions: { stage: ["college"], minAge: 19, probability: 0.15 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "attend_combine_prep",
        label: "Attend — invest in your draft stock",
        consequences: { cash: -12000, attributeDeltas: [{ path: "physical.speed", delta: 2 }, { path: "physical.strength", delta: 2 }] },
      },
      {
        id: "train_on_your_own",
        label: "Train on your own to save money",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "college_senior_day",
    category: "college",
    title: "Senior Day",
    description: "Your final home game as a college player. Family is in the stands and the crowd wants to honor the seniors.",
    conditions: { stage: ["college"], minAge: 21, probability: 0.12 },
    cooldownWeeks: 999,
    once: true,
    tags: [],
    choices: [
      {
        id: "embrace_moment",
        label: "Embrace the emotional send-off",
        consequences: {
          attributeDeltas: [{ path: "general.morale", delta: 8 }],
          relationshipDeltas: [{ targetTag: "family", delta: 5 }],
          narrativeMemory: "You played your final home game in front of family on Senior Day.",
        },
      },
      {
        id: "stay_locked_in",
        label: "Stay locked in on the game plan",
        consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
    ],
  },
];
