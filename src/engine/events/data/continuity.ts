import type { GameEventDefinition } from "../../types";

/**
 * Connected story beats.  Their tags are deliberately stateful: a promise,
 * bond, or public slight survives the modal that created it and can unlock a
 * later consequence.  A player can recover from a bad choice, but not every
 * branch gives them a clean win.
 */
export const CONTINUITY_EVENTS: GameEventDefinition[] = [
  {
    id: "continuity_coach_promise",
    category: "personal",
    title: "A Promise to Your Coach",
    description: "Your coach asks for an extra film session before a tough opponent. Saying yes creates an expectation, not a guaranteed reward.",
    conditions: { probability: 0.07, tagsAbsent: ["promise:coach:film", "promise:coach:kept", "promise:coach:broken"] },
    cooldownWeeks: 30,
    once: true,
    tags: ["arc:coach-promise", "continuity"],
    choices: [
      { id: "make_promise", label: "Promise to be there", description: "Build trust now, then carry the obligation into a later week.", consequences: { addTags: ["promise:coach:film"], relationshipDeltas: [{ targetTag: "coach", delta: 2 }] } },
      { id: "be_honest", label: "Set a boundary", description: "Protect your schedule, but give up a chance to prove your reliability.", consequences: { addTags: ["coach:boundary"], relationshipDeltas: [{ targetTag: "coach", delta: -2 }], attributeDeltas: [{ path: "general.composure", delta: 1 }] } },
    ],
  },
  {
    id: "continuity_coach_promise_due",
    category: "personal",
    title: "The Film Session Is Here",
    description: "Your coach has held the room. The earlier promise is now a real choice between preparation and everything else asking for your time.",
    conditions: { tagsPresent: ["promise:coach:film"], probability: 0.3 },
    cooldownWeeks: 8,
    once: true,
    tags: ["arc:coach-promise", "continuity"],
    choices: [
      { id: "keep_it", label: "Keep the promise", description: "Earn trust and preparation, while accepting the cost to recovery.", consequences: { removeTags: ["promise:coach:film"], addTags: ["promise:coach:kept"], relationshipDeltas: [{ targetTag: "coach", delta: 8 }], attributeDeltas: [{ path: "mental.footballIQ", delta: 1 }, { path: "general.morale", delta: -1 }] } },
      { id: "miss_it", label: "Miss the session", description: "Recover tonight, but leave a promise broken in your coach's memory.", consequences: { removeTags: ["promise:coach:film"], addTags: ["promise:coach:broken"], relationshipDeltas: [{ targetTag: "coach", delta: -9 }], attributeDeltas: [{ path: "general.morale", delta: -2 }], news: { headline: "Coach questions a young player's preparation", body: "A missed film commitment has become a quiet concern inside the program.", tone: "negative" } } },
    ],
  },
  {
    id: "continuity_agent_promise",
    category: "personal",
    title: "Your Agent Wants a Promise",
    description: "Morgan Hale wants you to commit to an off-season media plan. It could build your profile, but the expectations will follow you.",
    conditions: { minAge: 17, probability: 0.06, tagsAbsent: ["promise:agent:media", "agent:trusted", "agent:fractured"] },
    cooldownWeeks: 30,
    once: true,
    tags: ["arc:agent-promise", "continuity"],
    choices: [
      { id: "commit", label: "Commit to the plan", description: "Give your agent leverage with the public, then live up to the commitment.", consequences: { addTags: ["promise:agent:media"], relationshipDeltas: [{ targetTag: "agent", delta: 3 }], attributeDeltas: [{ path: "general.reputation", delta: 1 }] } },
      { id: "decline", label: "Stay focused on football", description: "Keep your time, but risk creating distance with the person selling your future.", consequences: { addTags: ["agent:guarded"], relationshipDeltas: [{ targetTag: "agent", delta: -3 }], attributeDeltas: [{ path: "general.discipline", delta: 1 }] } },
    ],
  },
  {
    id: "continuity_agent_reckoning",
    category: "media",
    title: "The Media Plan Comes Due",
    description: "The campaign is booked and your energy is low. Following through can help your agent's trust; cancelling protects recovery but strains the relationship.",
    conditions: { tagsPresent: ["promise:agent:media"], probability: 0.3 },
    cooldownWeeks: 8,
    once: true,
    tags: ["arc:agent-promise", "continuity"],
    choices: [
      { id: "show_up", label: "Show up exhausted", description: "Keep your word and build visibility, with a small hit to recovery.", consequences: { removeTags: ["promise:agent:media"], addTags: ["agent:trusted"], relationshipDeltas: [{ targetTag: "agent", delta: 7 }, { targetTag: "media", delta: 3 }], attributeDeltas: [{ path: "general.reputation", delta: 2 }, { path: "general.morale", delta: -2 }] } },
      { id: "cancel", label: "Cancel the appearance", description: "Protect the next game, but Morgan will remember the lost opportunity.", consequences: { removeTags: ["promise:agent:media"], addTags: ["agent:fractured"], relationshipDeltas: [{ targetTag: "agent", delta: -8 }, { targetTag: "media", delta: -2 }], attributeDeltas: [{ path: "general.morale", delta: 1 }], news: { headline: "Player pulls out of scheduled appearance", body: "The cancellation has cooled a small but growing media push.", tone: "negative" } } },
    ],
  },
  {
    id: "continuity_teammate_bond",
    category: "personal",
    title: "A Teammate Needs Cover",
    description: "A teammate asks you to cover a missed meeting. It could deepen trust in the locker room, or put your standing with the coach at risk.",
    conditions: { probability: 0.07, tagsAbsent: ["teammate:covered", "teammate:reported"] },
    cooldownWeeks: 28,
    once: true,
    tags: ["arc:locker-room", "continuity"],
    choices: [
      { id: "cover", label: "Cover for them", description: "Back a teammate and accept the chance that your coach notices the gap.", consequences: { addTags: ["teammate:covered"], relationshipDeltas: [{ targetTag: "team", delta: 7 }, { targetTag: "coach", delta: -3 }], attributeDeltas: [{ path: "general.leadership", delta: 1 }] } },
      { id: "report", label: "Tell the truth", description: "Protect your standing, but the locker room may see the decision differently.", consequences: { addTags: ["teammate:reported"], relationshipDeltas: [{ targetTag: "team", delta: -7 }, { targetTag: "coach", delta: 2 }], attributeDeltas: [{ path: "general.discipline", delta: 1 }] } },
    ],
  },
  {
    id: "continuity_teammate_consequence",
    category: "personal",
    title: "The Locker Room Remembers",
    description: "The earlier meeting choice comes up before practice. There is no answer that makes everyone happy.",
    conditions: { tagsPresent: ["teammate:covered"], probability: 0.28 },
    cooldownWeeks: 8,
    once: true,
    tags: ["arc:locker-room", "continuity"],
    choices: [
      { id: "own_it", label: "Own your decision", description: "Keep your teammate's respect while accepting your coach's concern.", consequences: { removeTags: ["teammate:covered"], relationshipDeltas: [{ targetTag: "team", delta: 4 }, { targetTag: "coach", delta: -2 }], attributeDeltas: [{ path: "general.composure", delta: 1 }] } },
      { id: "walk_it_back", label: "Walk it back", description: "Repair some trust with the coach, but make the locker room colder.", consequences: { removeTags: ["teammate:covered"], relationshipDeltas: [{ targetTag: "team", delta: -4 }, { targetTag: "coach", delta: 3 }], attributeDeltas: [{ path: "general.morale", delta: -1 }] } },
    ],
  },
  {
    id: "continuity_rival_challenge",
    category: "media",
    title: "A Rival Calls You Out",
    description: "Dante Cole says your last performance was luck. The clip is spreading, and a public response can turn a rivalry into a distraction.",
    conditions: { probability: 0.07, tagsAbsent: ["rival:called_out", "rival:ignored"] },
    cooldownWeeks: 32,
    once: true,
    tags: ["arc:rivalry", "continuity"],
    choices: [
      { id: "answer", label: "Answer publicly", description: "Raise the stakes and your visibility, but carry the pressure into the next matchup.", consequences: { addTags: ["rival:called_out"], relationshipDeltas: [{ targetTag: "rival", delta: -8 }, { targetTag: "media", delta: 3 }], attributeDeltas: [{ path: "general.confidence", delta: 1 }, { path: "general.composure", delta: -1 }] } },
      { id: "ignore", label: "Let the tape talk", description: "Avoid the headline, but give your rival an opening to own the conversation.", consequences: { addTags: ["rival:ignored"], relationshipDeltas: [{ targetTag: "rival", delta: -2 }], attributeDeltas: [{ path: "general.composure", delta: 1 }] } },
    ],
  },
  {
    id: "continuity_rival_rematch",
    category: "media",
    title: "The Rivalry Follows You",
    description: "The next matchup is close enough for every camera to mention Dante. Chasing the moment may create a highlight — or a mistake people replay.",
    conditions: { tagsPresent: ["rival:called_out"], probability: 0.3 },
    cooldownWeeks: 8,
    once: true,
    tags: ["arc:rivalry", "continuity"],
    choices: [
      { id: "play_controlled", label: "Play controlled", description: "Lower the drama and keep your coach's confidence, even if the story cools down.", consequences: { removeTags: ["rival:called_out"], relationshipDeltas: [{ targetTag: "coach", delta: 3 }, { targetTag: "rival", delta: -1 }], attributeDeltas: [{ path: "general.composure", delta: 2 }] } },
      { id: "chase_moment", label: "Chase the moment", description: "Lean into the rivalry for a reputation boost, with real risk if emotion takes over.", consequences: { removeTags: ["rival:called_out"], relationshipDeltas: [{ targetTag: "rival", delta: -5 }, { targetTag: "media", delta: 3 }], attributeDeltas: [{ path: "general.reputation", delta: 2 }, { path: "general.composure", delta: -2 }], injuryChance: 0.09, news: { headline: "Rivalry turns heated before a key game", body: "A public challenge has added pressure to a matchup neither player can fully control.", tone: "controversial" } } },
    ],
  },
];
