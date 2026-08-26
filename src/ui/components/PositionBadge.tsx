import type { Position } from "@engine/types";

// Offense / defense / special-teams color families — a quick visual read on
// what kind of player this is, even before you know their name.
const GROUP_COLORS: Record<"offense" | "defense" | "special", { top: string; bottom: string; glow: string }> = {
  offense: { top: "#ff7a52", bottom: "#b8431f", glow: "#ff5a36" },
  defense: { top: "#5aa9ff", bottom: "#1f4d8b", glow: "#5aa9ff" },
  special: { top: "#8f9bb3", bottom: "#3a4258", glow: "#8f9bb3" },
};

const POSITION_GROUP: Record<Position, "offense" | "defense" | "special"> = {
  QB: "offense",
  RB: "offense",
  WR: "offense",
  TE: "offense",
  OL: "offense",
  DL: "defense",
  LB: "defense",
  CB: "defense",
  S: "defense",
  K: "special",
  P: "special",
};

/**
 * A stylized helmet-silhouette badge for a player position — used wherever we'd
 * otherwise just print the position letters in a plain box (career picker,
 * dashboard hero before a player has a team crest to show instead).
 *
 * Accepts a plain string (not just the `Position` union) because some sources
 * — e.g. CareerSummary, round-tripped through localStorage — only guarantee a
 * string at the type level even though the value is always a real position.
 */
export function PositionBadge({ position, size = 44 }: { position: Position | string; size?: number }) {
  const group = POSITION_GROUP[position as Position] ?? "offense";
  const colors = GROUP_COLORS[group];
  const gradId = `pos-grad-${position}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${position} (${group})`} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="100%" stopColor={colors.bottom} />
        </linearGradient>
      </defs>
      {/* helmet silhouette */}
      <path
        d="M50 6 C74 6 90 24 90 48 C90 64 82 76 68 82 L68 70 C68 62 60 58 50 58 C40 58 32 62 32 70 L32 82 C18 76 10 64 10 48 C10 24 26 6 50 6 Z"
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={2}
      />
      {/* facemask hint */}
      <path d="M32 70 C32 78 40 84 50 84 C60 84 68 78 68 70" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={4} strokeLinecap="round" />
      <text x="50" y="42" textAnchor="middle" fontWeight={800} fontSize={26} fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth={1} paintOrder="stroke">
        {position}
      </text>
    </svg>
  );
}
