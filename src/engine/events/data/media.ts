import type { GameEventDefinition } from "../../types";

export const MEDIA_EVENTS: GameEventDefinition[] = [
  {
    id: "media_hot_take_response",
    category: "media",
    title: "A Reporter Wants Your Reaction",
    description: "A columnist wrote a critical piece questioning your work ethic. A reporter asks if you want to respond.",
    conditions: { minFame: 20, probability: 0.2 },
    cooldownWeeks: 12,
    tags: [],
    choices: [
      {
        id: "fire_back",
        label: "Fire back publicly",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 4 }],
          relationshipDeltas: [{ targetTag: "media", delta: -6 }],
          news: { headline: "Player claps back at critics", body: "The comments are already spreading online.", tone: "controversial" },
        },
      },
      {
        id: "take_high_road",
        label: "Take the high road",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 4 }], attributeDeltas: [{ path: "mental.composure", delta: 2 }] },
      },
      {
        id: "no_comment",
        label: "No comment",
        consequences: {},
      },
    ],
  },
  {
    id: "media_feature_story",
    category: "media",
    title: "Feature Story Request",
    description: "A major outlet wants to do an in-depth feature on your journey to this point.",
    conditions: { minFame: 30, probability: 0.15 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "open_up",
        label: "Open up and tell your full story",
        consequences: {
          attributeDeltas: [{ path: "general.fame", delta: 6 }, { path: "general.reputation", delta: 3 }],
          news: { headline: "The making of a star: an inside look", body: "A revealing feature resonates with fans.", tone: "positive" },
        },
      },
      {
        id: "keep_guarded",
        label: "Keep it professional and guarded",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 1 }] },
      },
    ],
  },
  {
    id: "media_social_backlash",
    category: "media",
    title: "A Post Didn't Land Well",
    description: "Something you posted is getting piled on. It's spreading faster than you expected.",
    conditions: { minFame: 25, probability: 0.12 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "delete_apologize",
        label: "Delete it and apologize",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 2 }], relationshipDeltas: [{ targetTag: "fans", delta: -2 }] },
      },
      {
        id: "stand_by_it",
        label: "Stand by what you said",
        consequences: { relationshipDeltas: [{ targetTag: "fans", delta: -6 }], attributeDeltas: [{ path: "general.fame", delta: 3 }] },
      },
      {
        id: "let_agent_handle",
        label: "Let your agent issue a statement",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 1 }] },
      },
    ],
  },
  {
    id: "media_podcast_invite",
    category: "media",
    title: "Podcast Appearance",
    description: "A popular sports podcast wants you on for a long-form, relaxed conversation.",
    conditions: { minFame: 20, probability: 0.15 },
    cooldownWeeks: 15,
    tags: [],
    choices: [
      {
        id: "do_it",
        label: "Do the podcast",
        consequences: { attributeDeltas: [{ path: "general.fame", delta: 3 }], cash: 2000 },
      },
      {
        id: "pass_podcast",
        label: "Pass this time",
        consequences: {},
      },
    ],
  },
  {
    id: "media_mvp_talk",
    category: "media",
    title: "MVP Talk Heats Up",
    description: "Analysts are starting to mention you in the MVP conversation.",
    conditions: { stage: ["nfl_season"], minAttribute: { path: "general.fame", value: 55 }, probability: 0.15 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "embrace_pressure",
        label: "Embrace the pressure",
        consequences: { attributeDeltas: [{ path: "mental.pressure", delta: 3 }, { path: "general.fame", delta: 3 }] },
      },
      {
        id: "deflect_praise",
        label: "Deflect to your teammates",
        consequences: { relationshipDeltas: [{ targetTag: "team", delta: 5 }] },
      },
    ],
  },
  {
    id: "media_documentary_offer",
    category: "media",
    title: "A Streaming Documentary Wants Access",
    description: "A production company wants to follow you for a season for a behind-the-scenes documentary.",
    conditions: { minFame: 45, probability: 0.1 },
    cooldownWeeks: 40,
    once: true,
    tags: [],
    choices: [
      {
        id: "grant_access",
        label: "Grant full access",
        consequences: {
          cash: 15000,
          attributeDeltas: [{ path: "general.fame", delta: 8 }],
          addTags: ["documentary_subject"],
          news: { headline: "Cameras follow star for new documentary", body: "Fans are excited for the unfiltered look inside the season.", tone: "positive" },
          narrativeMemory: "You let cameras follow you for a season-long documentary.",
        },
      },
      {
        id: "limited_access",
        label: "Allow limited, curated access only",
        consequences: { cash: 6000, attributeDeltas: [{ path: "general.fame", delta: 3 }] },
      },
      {
        id: "decline_documentary",
        label: "Decline — too much of a distraction",
        consequences: {},
      },
    ],
  },
  {
    id: "media_leaked_locker_room",
    category: "media",
    title: "A Locker Room Comment Got Leaked",
    description: "Something you said in what you thought was a private moment made its way to a reporter.",
    conditions: { probability: 0.1 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "own_it",
        label: "Own it publicly and move on",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 2 }], attributeDeltas: [{ path: "mental.composure", delta: 1 }] },
      },
      {
        id: "deny_it",
        label: "Deny it ever happened",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: -8 }], attributeDeltas: [{ path: "general.reputation", delta: -3 }] },
      },
    ],
  },
  {
    id: "media_commercial_shoot",
    category: "media",
    title: "National Commercial Offer",
    description: "A well-known brand wants you as the face of a national ad campaign.",
    conditions: { minFame: 30, probability: 0.13 },
    cooldownWeeks: 20,
    tags: [],
    choices: [
      {
        id: "sign_ad_deal",
        label: "Sign the deal",
        consequences: { cash: 30000, attributeDeltas: [{ path: "general.fame", delta: 5 }], addTags: ["brand_ambassador"] },
      },
      {
        id: "pass_ad_deal",
        label: "Pass — it's not the right fit",
        consequences: {},
      },
    ],
  },
  {
    id: "media_beat_writer_relationship",
    category: "media",
    title: "A Beat Writer Wants Closer Access",
    description: "The reporter who covers your team every day is asking for a standing one-on-one each week.",
    conditions: { probability: 0.12 },
    cooldownWeeks: 30,
    tags: [],
    choices: [
      {
        id: "build_rapport",
        label: "Build the relationship",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 8 }] },
      },
      {
        id: "keep_professional_distance",
        label: "Keep it strictly professional",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 1 }] },
      },
    ],
  },
  {
    id: "media_award_show",
    category: "media",
    title: "Invited to an Awards Show",
    description: "You've been invited to a major sports awards show — cameras, red carpet, the whole thing.",
    conditions: { minFame: 40, probability: 0.1 },
    cooldownWeeks: 35,
    tags: [],
    choices: [
      {
        id: "attend_show",
        label: "Attend and enjoy the spotlight",
        consequences: {
          cash: -5000,
          attributeDeltas: [{ path: "general.fame", delta: 6 }, { path: "general.morale", delta: 4 }],
          news: { headline: "Player turns heads at awards show", body: "Highlights from the red carpet are everywhere.", tone: "positive" },
        },
      },
      {
        id: "skip_show",
        label: "Skip it and stay focused on training",
        consequences: { attributeDeltas: [{ path: "general.discipline", delta: 2 }] },
      },
    ],
  },
  {
    id: "media_controversial_interview",
    category: "media",
    title: "An Interviewer Pushes a Sensitive Question",
    description: "Live on air, an interviewer asks you a pointed question you weren't prepared for.",
    conditions: { minFame: 25, probability: 0.1 },
    cooldownWeeks: 25,
    tags: [],
    choices: [
      {
        id: "answer_honestly",
        label: "Answer honestly, whatever the fallout",
        consequences: { attributeDeltas: [{ path: "general.reputation", delta: 3 }], relationshipDeltas: [{ targetTag: "media", delta: -3 }] },
      },
      {
        id: "deflect_question",
        label: "Deflect and change the subject",
        consequences: { relationshipDeltas: [{ targetTag: "media", delta: 2 }], attributeDeltas: [{ path: "general.reputation", delta: -1 }] },
      },
    ],
  },
];
