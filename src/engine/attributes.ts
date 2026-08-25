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
