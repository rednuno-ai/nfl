// =============================================================================
// Deterministic visual identity for teams/schools that don't have hand-authored
// art. Every id (team, college, high school, opponent label) hashes to a
// stable color pair + shape + motif, so the same seed always renders the same
// crest — no external image assets, no network calls, nothing to license.
// =============================================================================

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface CrestPalette {
  primary: string;
  primaryDark: string;
  secondary: string;
  glow: string;
}

export function crestPalette(seed: string): CrestPalette {
  const h = hashSeed(seed);
  const hue = h % 360;
  const satBoost = 62 + (h % 13); // 62-74
  const secondaryHue = (hue + 150 + (h % 60)) % 360; // split-complementary-ish
  return {
    primary: `hsl(${hue}, ${satBoost}%, 52%)`,
    primaryDark: `hsl(${hue}, ${satBoost}%, 22%)`,
    secondary: `hsl(${secondaryHue}, ${satBoost - 10}%, 38%)`,
    glow: `hsl(${hue}, ${satBoost}%, 62%)`,
  };
}

export function crestShape(seed: string): number {
  return hashSeed(seed + "::shape") % 4;
}

export function crestMotif(seed: string): number {
  return hashSeed(seed + "::motif") % 3;
}

/** Short 2-3 letter label for a crest when no real abbreviation exists. */
export function initialsFrom(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}
