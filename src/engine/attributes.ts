import type { Attributes, GenericPositionAttributes, Position } from "./types";
import { clamp, RNG } from "./rng";

// =============================================================================
// Attribute generation, weighted "overall" computation, and a generic
// dotted-path get/set used by the data-driven event engine so events can
// say `{ path: "physical.speed", delta: +2 }` without engine changes.
// =============================================================================

function genericBlock(v: number): GenericPositionAttributes {
  return { blocking: v, tackling: v, technique: v, specialTeams: v };
}

/** Creates a fresh attribute set for a newly created high-school player.
 *  `talent` (0-1) biases starting attributes and potential; personality-free. */
export function generateInitialAttributes(position: Position, talent: number, rng: RNG): Attributes {
  const base = 35 + talent * 25; // 35-60 range for a HS freshman/sophomore
  const jitter = () => clamp(base + rng.gaussian() * 6, 20, 75);

  return {
    general: {
      overall: 0, // computed on demand
      potential: clamp(55 + talent * 40 + rng.gaussian() * 5, 40, 99),
      fame: clamp(5 + rng.gaussian() * 3, 0, 100),
      reputation: clamp(30 + rng.gaussian() * 5, 0, 100),
      confidence: clamp(55 + rng.gaussian() * 8, 10, 90),
      morale: clamp(65 + rng.gaussian() * 8, 20, 95),
      discipline: clamp(50 + rng.gaussian() * 12, 10, 95),
      leadership: clamp(35 + rng.gaussian() * 10, 5, 90),
    },
    physical: {
      speed: jitter(),
      acceleration: jitter(),
      strength: jitter(),
      agility: jitter(),
      stamina: jitter(),
      durability: clamp(55 + rng.gaussian() * 10, 20, 95),
    },
    mental: {
      decisionMaking: clamp(30 + talent * 20 + rng.gaussian() * 8, 10, 90),
      pressure: clamp(35 + rng.gaussian() * 10, 10, 90),
      composure: clamp(35 + rng.gaussian() * 10, 10, 90),
      footballIQ: clamp(30 + talent * 20 + rng.gaussian() * 8, 10, 90),
    },
    position: {
      QB: {
        throwPower: jitter(),
        shortAccuracy: jitter(),
        mediumAccuracy: jitter(),
        deepAccuracy: jitter(),
        throwOnRun: jitter(),
        awareness: jitter(),
      },
      RB: {
        vision: jitter(),
        carrying: jitter(),
        elusiveness: jitter(),
        breakTackle: jitter(),
        passBlock: jitter(),
      },
      WR: {
        catching: jitter(),
        routeRunning: jitter(),
        release: jitter(),
        spectacularCatch: jitter(),
      },
      TE: {
        catching: jitter(),
        routeRunning: jitter(),
        runBlock: jitter(),
        passBlock: jitter(),
      },
      LB: {
        tackling: jitter(),
        blockShedding: jitter(),
        coverage: jitter(),
        pursuit: jitter(),
      },
      CB: {
        manCoverage: jitter(),
        zoneCoverage: jitter(),
        press: jitter(),
        ballHawk: jitter(),
      },
      S: genericBlock(jitter()),
      OL: genericBlock(jitter()),
      DL: genericBlock(jitter()),
      K: genericBlock(jitter()),
      P: genericBlock(jitter()),
    },
  };
}

/** Position-weighted overall rating, 0-99. This is the headline number shown in the UI. */
export function computeOverall(attrs: Attributes, position: Position): number {
  const { physical, mental, position: pos } = attrs;
  let score = 0;

  switch (position) {
    case "QB":
      score =
        pos.QB.shortAccuracy * 0.16 +
        pos.QB.mediumAccuracy * 0.16 +
        pos.QB.deepAccuracy * 0.12 +
        pos.QB.throwPower * 0.12 +
        pos.QB.awareness * 0.14 +
        mental.decisionMaking * 0.14 +
        mental.pressure * 0.08 +
        physical.agility * 0.08;
      break;
    case "RB":
      score =
        pos.RB.vision * 0.2 +
        pos.RB.elusiveness * 0.18 +
        pos.RB.breakTackle * 0.16 +
        physical.speed * 0.18 +
        physical.acceleration * 0.14 +
        pos.RB.carrying * 0.14;
      break;
    case "WR":
      score =
        pos.WR.catching * 0.24 +
        pos.WR.routeRunning * 0.22 +
        physical.speed * 0.22 +
        pos.WR.release * 0.12 +
        physical.agility * 0.12 +
        pos.WR.spectacularCatch * 0.08;
      break;
    case "TE":
      score =
        pos.TE.catching * 0.22 +
        pos.TE.routeRunning * 0.18 +
        pos.TE.runBlock * 0.2 +
        pos.TE.passBlock * 0.14 +
        physical.strength * 0.14 +
        physical.speed * 0.12;
      break;
    case "LB":
      score =
        pos.LB.tackling * 0.24 +
        pos.LB.pursuit * 0.2 +
        pos.LB.blockShedding * 0.18 +
        pos.LB.coverage * 0.14 +
        physical.strength * 0.14 +
        mental.footballIQ * 0.1;
      break;
    case "CB":
      score =
        pos.CB.manCoverage * 0.24 +
        pos.CB.zoneCoverage * 0.2 +
        pos.CB.press * 0.14 +
        pos.CB.ballHawk * 0.14 +
        physical.speed * 0.2 +
        physical.agility * 0.08;
      break;
    default: {
      const g = pos[position] as GenericPositionAttributes;
      score = g.blocking * 0.3 + g.tackling * 0.3 + g.technique * 0.25 + g.specialTeams * 0.15;
      break;
    }
  }

  return Math.round(clamp(score, 20, 99));
}

/** Get a numeric value from an Attributes object by dotted path, e.g. "physical.speed". */
export function getAttributeByPath(attrs: Attributes, path: string): number {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = attrs;
  for (const part of parts) {
    if (node == null) return 0;
    node = node[part];
  }
  return typeof node === "number" ? node : 0;
}

/** Immutably apply a delta to an attribute by dotted path, clamped to [0,100]
 *  (position attributes are conventionally kept in the same 0-100 space). */
export function applyAttributeDelta(attrs: Attributes, path: string, delta: number): Attributes {
  const parts = path.split(".");
  const clone: Attributes = JSON.parse(JSON.stringify(attrs));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node[parts[i]];
  }
  const key = parts[parts.length - 1];
  const current = node[key] as number;
  node[key] = clamp(current + delta, 0, 100);
  return clone;
}

export function applyAttributeDeltas(attrs: Attributes, deltas: { path: string; delta: number }[]): Attributes {
  return deltas.reduce((acc, d) => applyAttributeDelta(acc, d.path, d.delta), attrs);
}

/** Immutably sets an attribute by dotted path to an absolute value (clamped
 *  to [0,100]), rather than applying a relative delta. Used by the point-buy
 *  character creator to pin a curated set of attributes to the player's
 *  chosen values regardless of what the random roll would have produced. */
export function setAttributeByPath(attrs: Attributes, path: string, value: number): Attributes {
  const parts = path.split(".");
  const clone: Attributes = JSON.parse(JSON.stringify(attrs));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = clamp(value, 0, 100);
  return clone;
}

// -----------------------------------------------------------------------------
// Point-buy character creation
// -----------------------------------------------------------------------------

export interface PointBuySlot {
  path: string;
  label: string;
}

/** Baseline every point-buy attribute starts from before points are spent. */
export const POINT_BUY_BASELINE = 50;
/** Total points a new player has to distribute across their curated slots. */
export const POINT_BUY_POOL = 24;
/** Ceiling a single point-buy attribute can reach (baseline + all spent there). */
export const POINT_BUY_MAX = 85;

/** The six headline attributes exposed to the point-buy creator for each
 *  creatable position (see MVP_POSITIONS) — a curated subset of the full
 *  attribute tree chosen to read clearly to a new player and to visibly move
 *  the position's `computeOverall` score. */
export const POINT_BUY_SLOTS: Partial<Record<Position, PointBuySlot[]>> = {
  QB: [
    { path: "position.QB.shortAccuracy", label: "Short Accuracy" },
    { path: "position.QB.deepAccuracy", label: "Deep Accuracy" },
    { path: "position.QB.throwPower", label: "Arm Strength" },
    { path: "position.QB.awareness", label: "Awareness" },
    { path: "mental.decisionMaking", label: "Decision Making" },
    { path: "physical.agility", label: "Agility" },
  ],
  RB: [
    { path: "physical.speed", label: "Speed" },
    { path: "physical.acceleration", label: "Acceleration" },
    { path: "position.RB.vision", label: "Vision" },
    { path: "position.RB.elusiveness", label: "Elusiveness" },
    { path: "position.RB.breakTackle", label: "Break Tackle" },
    { path: "position.RB.carrying", label: "Ball Security" },
  ],
  WR: [
    { path: "physical.speed", label: "Speed" },
    { path: "physical.agility", label: "Agility" },
    { path: "position.WR.catching", label: "Catching" },
    { path: "position.WR.routeRunning", label: "Route Running" },
    { path: "position.WR.release", label: "Release" },
    { path: "position.WR.spectacularCatch", label: "Spectacular Catch" },
  ],
  TE: [
    { path: "position.TE.catching", label: "Catching" },
    { path: "position.TE.routeRunning", label: "Route Running" },
    { path: "position.TE.runBlock", label: "Run Blocking" },
    { path: "position.TE.passBlock", label: "Pass Blocking" },
    { path: "physical.strength", label: "Strength" },
    { path: "physical.speed", label: "Speed" },
  ],
  LB: [
    { path: "position.LB.tackling", label: "Tackling" },
    { path: "position.LB.pursuit", label: "Pursuit" },
    { path: "position.LB.blockShedding", label: "Block Shedding" },
    { path: "position.LB.coverage", label: "Coverage" },
    { path: "physical.strength", label: "Strength" },
    { path: "mental.footballIQ", label: "Football IQ" },
  ],
  CB: [
    { path: "position.CB.manCoverage", label: "Man Coverage" },
    { path: "position.CB.zoneCoverage", label: "Zone Coverage" },
    { path: "position.CB.press", label: "Press" },
    { path: "position.CB.ballHawk", label: "Ball Hawk" },
    { path: "physical.speed", label: "Speed" },
    { path: "physical.agility", label: "Agility" },
  ],
};

/** Applies a point-buy allocation (path -> extra points, each 0..pool) on top
 *  of POINT_BUY_BASELINE, pinning those specific attributes to an absolute
 *  value. Any position without curated slots (not in MVP_POSITIONS) is a
 *  no-op. */
export function applyPointBuy(attrs: Attributes, position: Position, allocations: Record<string, number>): Attributes {
  const slots = POINT_BUY_SLOTS[position];
  if (!slots) return attrs;
  return slots.reduce((acc, slot) => {
    const points = allocations[slot.path] ?? 0;
    return setAttributeByPath(acc, slot.path, POINT_BUY_BASELINE + points);
  }, attrs);
}

/** Builds a synthetic, fully-populated Attributes object at POINT_BUY_BASELINE
 *  for every field, with the curated slots overridden by the given
 *  allocation — used purely to preview OVR live in the creator UI before the
 *  real (partly random) attribute roll happens at career creation. */
export function previewPointBuyOverall(position: Position, allocations: Record<string, number>): number {
  const flat = (v: number) => ({ blocking: v, tackling: v, technique: v, specialTeams: v });
  const b = POINT_BUY_BASELINE;
  const baseline: Attributes = {
    general: { overall: 0, potential: b, fame: 0, reputation: b, confidence: b, morale: b, discipline: b, leadership: b },
    physical: { speed: b, acceleration: b, strength: b, agility: b, stamina: b, durability: b },
    mental: { decisionMaking: b, pressure: b, composure: b, footballIQ: b },
    position: {
      QB: { throwPower: b, shortAccuracy: b, mediumAccuracy: b, deepAccuracy: b, throwOnRun: b, awareness: b },
      RB: { vision: b, carrying: b, elusiveness: b, breakTackle: b, passBlock: b },
      WR: { catching: b, routeRunning: b, release: b, spectacularCatch: b },
      TE: { catching: b, routeRunning: b, runBlock: b, passBlock: b },
      LB: { tackling: b, blockShedding: b, coverage: b, pursuit: b },
      CB: { manCoverage: b, zoneCoverage: b, press: b, ballHawk: b },
      S: flat(b),
      OL: flat(b),
      DL: flat(b),
      K: flat(b),
      P: flat(b),
    },
  };
  return computeOverall(applyPointBuy(baseline, position, allocations), position);
}
