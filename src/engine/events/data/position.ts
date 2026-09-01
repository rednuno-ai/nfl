import type { GameEventDefinition } from "../../types";

// Position stories are deliberately data-only. Their `positions` gates keep
// a career's narrative tied to the craft the player actually practices.
export const POSITION_EVENTS: GameEventDefinition[] = [
  {
    id: "position_qb_film_install",
    category: "college",
    title: "The Full Install",
    description: "The coordinator gives you the entire third-down package and asks whether you want to own the protection calls this week.",
    conditions: { stage: ["college", "nfl_season"], positions: ["QB"], probability: 0.16 },
    cooldownWeeks: 20,
    tags: ["position_story"],
    choices: [
      { id: "master_calls", label: "Master every protection", description: "More command at the line, with less recovery time.", consequences: { attributeDeltas: [{ path: "position.QB.awareness", delta: 3 }, { path: "mental.footballIQ", delta: 2 }, { path: "physical.stamina", delta: -2 }], relationshipDeltas: [{ targetTag: "coach", delta: 3 }] } },
      { id: "simplify_qb", label: "Keep the menu concise", description: "Protect your timing and trust the core calls.", consequences: { attributeDeltas: [{ path: "mental.composure", delta: 2 }, { path: "position.QB.shortAccuracy", delta: 1 }] } },
    ],
  },
  {
    id: "position_rb_ball_security",
    category: "college",
    title: "The Ball-Security Circuit",
    description: "After a strip in practice, the running backs coach offers extra contact drills before the next game.",
    conditions: { stage: ["college", "nfl_season"], positions: ["RB"], probability: 0.16 },
    cooldownWeeks: 20,
    tags: ["position_story"],
    choices: [
      { id: "take_contact_reps", label: "Take every contact rep", description: "Improve ball security and power, but accept a real workload cost.", consequences: { attributeDeltas: [{ path: "position.RB.carrying", delta: 3 }, { path: "position.RB.breakTackle", delta: 2 }], injuryChance: 0.025 } },
      { id: "vision_walkthrough", label: "Study run fits instead", description: "Read the crease earlier and avoid unnecessary contact.", consequences: { attributeDeltas: [{ path: "position.RB.vision", delta: 3 }, { path: "mental.decisionMaking", delta: 1 }] } },
    ],
  },
  {
    id: "position_wr_release_lab",
    category: "college",
    title: "Release Lab",
    description: "A veteran corner offers an after-hours session devoted to beating press coverage at the line.",
    conditions: { stage: ["college", "nfl_season"], positions: ["WR"], probability: 0.16 },
    cooldownWeeks: 20,
    tags: ["position_story"],
    choices: [
      { id: "work_press", label: "Work the press releases", description: "Sharpen the first two steps that decide whether a route can develop.", consequences: { attributeDeltas: [{ path: "position.WR.release", delta: 3 }, { path: "position.WR.routeRunning", delta: 2 }], relationshipDeltas: [{ targetTag: "team", delta: 2 }] } },
      { id: "attack_catch_point", label: "Train the catch point", description: "Focus on contested catches and the high-leverage finish.", consequences: { attributeDeltas: [{ path: "position.WR.catching", delta: 2 }, { path: "position.WR.spectacularCatch", delta: 2 }] } },
    ],
  },
  {
    id: "position_te_role_tension",
    category: "nfl",
    title: "Receiver or Sixth Lineman?",
    description: "The staff wants you to stay in protection more often. You can embrace the dirty work or push to be featured in the route tree.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], positions: ["TE"], probability: 0.15 },
    cooldownWeeks: 24,
    tags: ["position_story"],
    choices: [
      { id: "embrace_blocking", label: "Own the blocking role", description: "Earn trust on the edge and make the offense more flexible.", consequences: { attributeDeltas: [{ path: "position.TE.runBlock", delta: 3 }, { path: "position.TE.passBlock", delta: 2 }], relationshipDeltas: [{ targetTag: "coach", delta: 4 }] } },
      { id: "request_routes", label: "Ask for more routes", description: "Bet on your receiving upside, with a small risk to the coach relationship.", consequences: { attributeDeltas: [{ path: "position.TE.catching", delta: 2 }, { path: "position.TE.routeRunning", delta: 2 }], relationshipDeltas: [{ targetTag: "coach", delta: -1 }] } },
    ],
  },
  {
    id: "position_lb_green_dot",
    category: "nfl",
    title: "The Green Dot",
    description: "The defense is considering you for the helmet communicator. It means more responsibility before every snap.",
    conditions: { stage: ["nfl_season", "nfl_offseason"], positions: ["LB"], minAttribute: { path: "mental.footballIQ", value: 48 }, probability: 0.15 },
    cooldownWeeks: 24,
    tags: ["position_story"],
    choices: [
      { id: "call_defense", label: "Call the defense", description: "Take command of checks and alignments under pressure.", consequences: { attributeDeltas: [{ path: "mental.footballIQ", delta: 3 }, { path: "position.LB.coverage", delta: 2 }, { path: "general.leadership", delta: 2 }], relationshipDeltas: [{ targetTag: "coach", delta: 3 }] } },
      { id: "focus_assignment", label: "Focus on your assignment", description: "Keep your reads fast and attack the ball with less mental load.", consequences: { attributeDeltas: [{ path: "position.LB.pursuit", delta: 2 }, { path: "position.LB.tackling", delta: 2 }] } },
    ],
  },
  {
    id: "position_cb_island_challenge",
    category: "nfl",
    title: "Island Challenge",
    description: "Your coordinator asks if you want to shadow the opponent's featured receiver without regular safety help.",
    conditions: { stage: ["nfl_season"], positions: ["CB"], probability: 0.15 },
    cooldownWeeks: 20,
    tags: ["position_story"],
    choices: [
      { id: "take_shadow", label: "Take the shadow assignment", description: "A high-visibility test of press and man coverage, with a tougher matchup.", consequences: { attributeDeltas: [{ path: "position.CB.manCoverage", delta: 3 }, { path: "position.CB.press", delta: 2 }, { path: "general.fame", delta: 1 }], injuryChance: 0.015 } },
      { id: "play_scheme", label: "Trust the scheme", description: "Use route recognition and team leverage to create a takeaway chance.", consequences: { attributeDeltas: [{ path: "position.CB.zoneCoverage", delta: 3 }, { path: "position.CB.ballHawk", delta: 2 }], relationshipDeltas: [{ targetTag: "coach", delta: 2 }] } },
    ],
  },
];
