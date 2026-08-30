import type { GameEventDefinition } from "../../types";

export const PERSONAL_EVENTS: GameEventDefinition[] = [
  {
    id: "personal_family_time",
    category: "personal",
    title: "A Promise at Home",
    description: "Your family asks you to make time for an important dinner before the next game. It lands differently depending on the person you chose to be.",
    conditions: { personalityAny: ["family_oriented", "loyal", "ambitious"], probability: 0.14 },
    cooldownWeeks: 24,
    tags: [],
    choices: [
      {
        id: "show_up",
        label: "Keep the promise",
        description: "Protect the people who keep you grounded.",
        consequences: {
          relationshipDeltas: [{ targetTag: "family", delta: 6 }],
          attributeDeltas: [{ path: "general.morale", delta: 3 }],
          narrativeMemory: "You protected family time before a big week.",
        },
      },
      {
        id: "film_room",
        label: "Stay late for film",
        description: "Trade one evening at home for extra preparation.",
        consequences: {
          relationshipDeltas: [{ targetTag: "family", delta: -2 }],
          attributeDeltas: [{ path: "mental.footballIQ", delta: 1 }, { path: "general.discipline", delta: 1 }],
          narrativeMemory: "You chose preparation over a family commitment.",
        },
      },
    ],
  },
  {
    id: "personal_family_time_callback",
    category: "personal",
    title: "They Remembered",
    description: "Your family brings up the promise you kept before a difficult stretch. The earlier choice is still part of the conversation.",
    conditions: { tagsPresent: ["memory:personal_family_time:show_up"], probability: 0.18 },
    cooldownWeeks: 50,
    once: true,
    tags: [],
    choices: [
      {
        id: "share_the_moment",
        label: "Share the moment",
        description: "Let them see the work behind the career.",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: 5 }], attributeDeltas: [{ path: "general.morale", delta: 2 }] },
      },
      {
        id: "keep_it_simple",
        label: "Keep it simple",
        description: "Appreciate the support, then return to routine.",
        consequences: { attributeDeltas: [{ path: "general.composure", delta: 1 }] },
      },
    ],
  },
  {
    id: "personal_new_relationship",
    category: "personal",
    title: "Someone Catches Your Eye",
    description: "You've met someone through friends who you'd like to get to know better.",
    conditions: { minAge: 17, probability: 0.15, tagsAbsent: ["in_relationship"] },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "pursue",
        label: "Ask them out",
        consequences: { addTags: ["in_relationship"], attributeDeltas: [{ path: "general.morale", delta: 5 }] },
      },
      {
        id: "focus_career",
        label: "Not right now — focus on your career",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 1 }] },
      },
    ],
  },
  {
    id: "personal_relationship_milestone",
    category: "personal",
    title: "Taking the Next Step",
    description: "Your relationship has grown serious. It might be time to talk about the future.",
    conditions: { minAge: 22, tagsPresent: ["in_relationship"], probability: 0.1 },
    cooldownWeeks: 40,
    tags: [],
    choices: [
      {
        id: "propose",
        label: "Propose",
        consequences: {
          addTags: ["married"],
          attributeDeltas: [{ path: "general.morale", delta: 8 }],
          news: { headline: "Player announces engagement", body: "Fans are sharing their congratulations.", tone: "positive" },
        },
      },
      {
        id: "wait",
        label: "Not yet — enjoy where things are",
        consequences: {},
      },
    ],
  },
  {
    id: "personal_child_born",
    category: "personal",
    title: "Becoming a Parent",
    description: "You and your partner are expecting — life is about to change in the best way.",
    conditions: { minAge: 23, tagsPresent: ["married"], tagsAbsent: ["has_child"], probability: 0.12 },
    cooldownWeeks: 60,
    once: true,
    tags: [],
    choices: [
      {
        id: "embrace_fatherhood",
        label: "Embrace the new chapter",
        consequences: {
          addTags: ["has_child"],
          attributeDeltas: [{ path: "general.morale", delta: 10 }, { path: "general.discipline", delta: 2 }],
          narrativeMemory: "You became a parent, which reshaped how you balance football and home life.",
        },
      },
    ],
  },
  {
    id: "personal_breakup",
    category: "personal",
    title: "Growing Apart",
    description: "The demands of your career have put a strain on your relationship.",
    conditions: { tagsPresent: ["in_relationship"], tagsAbsent: ["married"], probability: 0.08 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "work_it_out",
        label: "Make time to work it out",
        consequences: { attributeDeltas: [{ path: "general.morale", delta: 3 }] },
      },
      {
        id: "let_go",
        label: "Let it go",
        consequences: { removeTags: ["in_relationship"], attributeDeltas: [{ path: "general.morale", delta: -6 }] },
      },
    ],
  },
  {
    id: "personal_luxury_temptation",
    category: "personal",
    title: "A Dealer Calls With 'The Perfect Car'",
    description: "A luxury dealership reached out personally — they have something they think is perfect for you.",
    conditions: { minFame: 25, probability: 0.15 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "buy_it",
        label: "Buy it — you earned it",
        consequences: { cash: -60000, attributeDeltas: [{ path: "general.morale", delta: 6 }], addTags: ["owns_luxury_car"] },
      },
      {
        id: "save_instead",
        label: "Save the money instead",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "personal_buy_house",
    category: "personal",
    title: "House Hunting",
    description: "It might finally be time to buy a home instead of renting.",
    conditions: { minAge: 22, tagsAbsent: ["owns_house"], probability: 0.15 },
    cooldownWeeks: 40,
    tags: [],
    choices: [
      {
        id: "buy_house",
        label: "Buy a house",
        consequences: { cash: -180000, addTags: ["owns_house"], attributeDeltas: [{ path: "general.morale", delta: 5 }] },
      },
      {
        id: "keep_renting",
        label: "Keep renting for flexibility",
        consequences: {},
      },
    ],
  },
  {
    id: "personal_invest_advice",
    category: "personal",
    title: "Your Agent Suggests Investing",
    description: "Your agent introduces you to a financial advisor with a long-term investment plan.",
    conditions: { minFame: 15, probability: 0.15 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "invest",
        label: "Invest a portion of your earnings",
        consequences: { addTags: ["has_investments"] },
      },
      {
        id: "keep_liquid",
        label: "Keep your money liquid for now",
        consequences: {},
      },
    ],
  },
  {
    id: "personal_old_friend",
    category: "personal",
    title: "An Old Friend Reaches Out",
    description: "A childhood friend you haven't spoken to in years wants to reconnect — and maybe asks for a favor.",
    conditions: { probability: 0.1 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "reconnect",
        label: "Reconnect genuinely",
        consequences: { relationshipDeltas: [{ targetTag: "friend", delta: 6 }] },
      },
      {
        id: "keep_distance",
        label: "Keep some distance",
        consequences: {},
      },
    ],
  },
  {
    id: "personal_parents_visit",
    category: "personal",
    title: "Parents Come to Town",
    description: "Your parents are flying in to see you play in person for the first time in a while.",
    conditions: { probability: 0.15 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "spend_time",
        label: "Clear your schedule for them",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: 8 }] },
      },
      {
        id: "stay_focused",
        label: "Keep your normal routine",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: -2 }], attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
    ],
  },
  {
    id: "personal_sibling_rivalry",
    category: "personal",
    title: "Your Sibling Wants a Piece of the Spotlight",
    description: "Your brother or sister has been posting online about being 'the real athlete in the family.' It's mostly a joke. Mostly.",
    conditions: { minFame: 10, probability: 0.1 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "laugh_it_off",
        label: "Laugh it off publicly and hype them up",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: 6 }], attributeDeltas: [{ path: "general.morale", delta: 2 }] },
      },
      {
        id: "quiet_word",
        label: "Have a quiet word with them privately",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: 3 }] },
      },
    ],
  },
  {
    id: "personal_charity_foundation",
    category: "personal",
    title: "Starting Your Own Foundation",
    description: "You have enough of a platform now to start a charitable foundation in your name, if you want the responsibility that comes with it.",
    conditions: { minFame: 35, tagsAbsent: ["has_foundation"], probability: 0.1 },
    cooldownWeeks: 60,
    once: true,
    tags: [],
    choices: [
      {
        id: "start_foundation",
        label: "Start the foundation",
        consequences: {
          cash: -40000,
          addTags: ["has_foundation"],
          attributeDeltas: [{ path: "general.morale", delta: 6 }],
          news: { headline: "Player launches charitable foundation", body: "The community response has been overwhelmingly positive.", tone: "positive" },
          narrativeMemory: "You started a foundation in your name, turning your platform into something lasting.",
        },
      },
      {
        id: "donate_instead",
        label: "Donate directly instead of managing a foundation",
        consequences: { cash: -10000, attributeDeltas: [{ path: "general.morale", delta: 3 }] },
      },
    ],
  },
  {
    id: "personal_hometown_return",
    category: "personal",
    title: "Invited Back to Your Hometown",
    description: "Your hometown wants to honor you with a day in your name and a visit to your old high school.",
    conditions: { minFame: 20, probability: 0.12 },
    cooldownWeeks: 45,
    tags: [],
    choices: [
      {
        id: "go_home",
        label: "Go back and make it a big moment",
        consequences: {
          relationshipDeltas: [{ targetTag: "family", delta: 5 }],
          attributeDeltas: [{ path: "general.morale", delta: 5 }],
          narrativeMemory: "You went back to your hometown to be honored where it all started.",
        },
      },
      {
        id: "send_regards",
        label: "Send a video message instead — schedule is packed",
        consequences: { attributeDeltas: [{ path: "general.morale", delta: -1 }] },
      },
    ],
  },
  {
    id: "personal_financial_scare",
    category: "personal",
    title: "A Bad Investment Surfaces",
    description: "Something your financial advisor put you into a few years back just went badly wrong.",
    conditions: { tagsPresent: ["has_investments"], probability: 0.08 },
    cooldownWeeks: 50,
    tags: [],
    choices: [
      {
        id: "cut_losses",
        label: "Cut your losses and clean house",
        consequences: { cash: -50000, removeTags: ["has_investments"], attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
      {
        id: "ride_it_out",
        label: "Ride it out and hope it recovers",
        consequences: { cash: -20000, attributeDeltas: [{ path: "general.morale", delta: -4 }] },
      },
    ],
  },
  {
    id: "personal_mentorship_offer",
    category: "personal",
    title: "A Kid From the Neighborhood Needs a Mentor",
    description: "A local youth coach asks if you'd be willing to mentor a promising but struggling young player.",
    conditions: { minAge: 24, probability: 0.12 },
    cooldownWeeks: 35,
    tags: [],
    choices: [
      {
        id: "mentor",
        label: "Take him under your wing",
        consequences: {
          attributeDeltas: [{ path: "general.morale", delta: 5 }, { path: "general.leadership", delta: 2 }],
          narrativeMemory: "You mentored a young player from your old neighborhood.",
        },
      },
      {
        id: "decline_time",
        label: "You don't have the time right now",
        consequences: {},
      },
    ],
  },
  {
    id: "personal_family_business",
    category: "personal",
    title: "Family Wants to Start a Business Together",
    description: "A relative pitches you on funding a family business, betting on your name to get it off the ground.",
    conditions: { minFame: 20, probability: 0.09 },
    cooldownWeeks: 45,
    tags: [],
    choices: [
      {
        id: "fund_it",
        label: "Fund it and stay involved",
        consequences: { cash: -75000, relationshipDeltas: [{ targetTag: "family", delta: 6 }], addTags: ["family_business"] },
      },
      {
        id: "pass_politely",
        label: "Pass, but offer advice instead",
        consequences: { relationshipDeltas: [{ targetTag: "family", delta: -2 }] },
      },
    ],
  },
];
