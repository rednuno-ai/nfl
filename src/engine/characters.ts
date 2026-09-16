import type { GameEventDefinition, Relationship } from "./types";
import type { CareerState } from "./career";

export function hasMetCharacter(state: Pick<CareerState, "tags">, person: Relationship): boolean {
  return person.type === "partner" || state.tags.includes(`met:${person.type}`);
}

const introductions = [
  ["coach", "Your first team meeting", "Your coach introduces the program: preparation earns trust, and trust opens opportunities."],
  ["family", "Before you leave home", "Your family asks how they can support you. Making time for them helps morale but competes with training."],
  ["teammate", "Meet Jordan Reed", "Jordan Reed offers to show you around practice. Supporting each other can build trust in the locker room."],
  ["rival", "Meet Dante Cole", "After a school matchup, Dante Cole introduces himself. He wants the same opportunities you do. Competition need not mean hostility."],
  ["agent", "Meet Morgan Hale", "With the draft approaching, agent Morgan Hale explains representation. Trust must be earned before promises or negotiations."],
] as const;

export const CHARACTER_INTRODUCTIONS: GameEventDefinition[] = introductions.map(([type, title, description]) => ({
  id: `intro_${type}`, category: "personal", title, description,
  conditions: {
    stage: type === "agent" ? ["draft", "nfl_offseason", "nfl_season", "free_agency"] : ["high_school", "recruiting", "college", "draft", "nfl_offseason", "nfl_season", "free_agency"],
    minAge: type === "agent" ? 20 : 15,
    minGamesPlayed: type === "rival" ? 2 : 0,
    tagsAbsent: [`met:${type}`], probability: 1,
  },
  once: true, cooldownWeeks: 52, tags: ["introduction"],
  choices: [
    { id: "engage", label: "Make time to talk", description: "Build trust; give the conversation your attention.", consequences: { addTags: [`met:${type}`], relationshipDeltas: [{ targetTag: type === "teammate" ? "team" : type, delta: 3 }], attributeDeltas: [{ path: "general.morale", delta: 1 }] } },
    { id: "reserved", label: "Keep it brief", description: "Meet them, but keep some distance for now.", consequences: { addTags: [`met:${type}`], relationshipDeltas: [{ targetTag: type === "teammate" ? "team" : type, delta: -1 }] } },
  ],
}));

// Keep stable choice IDs so already-saved introductions remain resolvable.
CHARACTER_INTRODUCTIONS[0].choices = [
  { id: "engage", label: "Ask what earns a starting spot", description: "Coach trust +3, football IQ +1. Learn the standard.", consequences: { addTags: ["met:coach"], relationshipDeltas: [{ targetTag: "coach", delta: 3 }], attributeDeltas: [{ path: "mental.footballIQ", delta: 1 }] } },
  { id: "reserved", label: "Let my practice speak", description: "Discipline +2, coach trust −1. Prove yourself over time.", consequences: { addTags: ["met:coach"], relationshipDeltas: [{ targetTag: "coach", delta: -1 }], attributeDeltas: [{ path: "general.discipline", delta: 2 }] } },
];
CHARACTER_INTRODUCTIONS[1].choices = [
  { id: "engage", label: "Tell them what worries me", description: "Family trust +4 and morale +2; confidence −1 while admitting your doubts.", consequences: { addTags: ["met:family"], relationshipDeltas: [{ targetTag: "family", delta: 4 }], attributeDeltas: [{ path: "general.morale", delta: 2 }, { path: "general.confidence", delta: -1 }] } },
  { id: "reserved", label: "Ask for space to focus", description: "Discipline +2, family trust −2. Independence has a cost.", consequences: { addTags: ["met:family"], relationshipDeltas: [{ targetTag: "family", delta: -2 }], attributeDeltas: [{ path: "general.discipline", delta: 2 }] } },
];
CHARACTER_INTRODUCTIONS[2].choices = [
  { id: "engage", label: "Study the playbook with Jordan", description: "Team trust +3, football IQ +1 and leadership +1.", consequences: { addTags: ["met:teammate"], relationshipDeltas: [{ targetTag: "team", delta: 3 }], attributeDeltas: [{ path: "mental.footballIQ", delta: 1 }, { path: "general.leadership", delta: 1 }] } },
  { id: "reserved", label: "Compete for reps on my own", description: "Confidence +2, team trust −2. Competition before friendship.", consequences: { addTags: ["met:teammate"], relationshipDeltas: [{ targetTag: "team", delta: -2 }], attributeDeltas: [{ path: "general.confidence", delta: 2 }] } },
];
CHARACTER_INTRODUCTIONS.push({ ...CHARACTER_INTRODUCTIONS[0], id: "intro_college_coach", title: "Your college coaching staff", conditions: { stage: ["college"], minAge: 17, tagsAbsent: ["met:coach"], probability: 1 } });

/** Shared dependency gate includes both prose references and affected people. */
export function characterRequirements(event: GameEventDefinition): string[] {
  if (event.id.startsWith("intro_")) return [];
  const text = `${event.title} ${event.description}`.toLowerCase();
  const types = new Set<string>();
  for (const [type, pattern] of Object.entries({ agent: /\bagent\b|morgan hale/, rival: /dante cole/, teammate: /jordan reed/, coach: /\bcoach\b/, family: /\bfamily\b/ })) if (pattern.test(text)) types.add(type);
  for (const choice of event.choices) for (const delta of choice.consequences.relationshipDeltas ?? []) {
    const type = delta.targetTag === "team" ? "teammate" : delta.targetTag;
    if (["agent", "rival", "coach", "family", "teammate"].includes(type)) types.add(type);
  }
  return [...types].map(type => `met:${type}`);
}
