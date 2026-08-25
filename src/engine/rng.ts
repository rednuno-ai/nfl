// =============================================================================
// Deterministic seeded RNG (mulberry32) — every career stores its seed so the
// exact sequence of "random" outcomes can be reproduced for debugging/QA, and
// so two careers with the same seed + same decisions play out identically.
// =============================================================================

export type RNGState = { seed: number; calls: number };

export function createSeed(): number {
  // 32-bit unsigned seed derived from current time + a random salt.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** mulberry32: small, fast, decent-quality PRNG. Not cryptographic — that's fine, it's a game. */
export class RNG {
  private state: number;
  public callCount = 0;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  static fromState(state: RNGState): RNG {
    const rng = new RNG(state.seed);
    // Fast-forward isn't stored per-call for performance reasons; instead we
    // persist the *current* internal state as the "seed" on every save, so
    // resuming a save continues the exact sequence.
    rng.callCount = state.calls;
    return rng;
  }

  getState(): RNGState {
    return { seed: this.state, calls: this.callCount };
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.callCount++;
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** True with probability p (0-1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Gaussian-ish sample via sum of uniforms (Irwin-Hall approx), mean 0, roughly std 1. */
  gaussian(): number {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += this.next();
    return sum - 3;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Weighted pick: items paired with non-negative weights. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) return items[0].item;
    let roll = this.next() * total;
    for (const entry of items) {
      roll -= Math.max(0, entry.weight);
      if (roll <= 0) return entry.item;
    }
    return items[items.length - 1].item;
  }
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
