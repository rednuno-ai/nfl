import type { LegacyTier } from "@engine/types";

// A generated medal/trophy graphic for the career "final verdict" moment —
// replaces a plain emoji with real per-tier art (color, rays, laurel wreath)
// so the biggest emotional beat in the game (retirement) gets a payoff that
// looks designed rather than typed. Pure SVG, no external assets.

interface TierLook {
  base: string;
  baseDark: string;
  ring: string;
  glow: string;
  rays: boolean;
  laurel: boolean;
}

const TIER_LOOK: Record<LegacyTier, TierLook> = {
  bust: { base: "#5b6472", baseDark: "#3a414c", ring: "#7a8391", glow: "transparent", rays: false, laurel: false },
  solid_career: { base: "#b8763f", baseDark: "#8a5527", ring: "#dd9a5f", glow: "rgba(184,118,63,0.35)", rays: false, laurel: false },
  star: { base: "#c3c9d4", baseDark: "#8d94a1", ring: "#eef1f5", glow: "rgba(195,201,212,0.35)", rays: false, laurel: true },
  superstar: { base: "#e8b94a", baseDark: "#b8892a", ring: "#ffd873", glow: "rgba(232,185,74,0.4)", rays: true, laurel: true },
  legend: { base: "#f0c355", baseDark: "#c4922a", ring: "#ffe08a", glow: "rgba(240,195,85,0.55)", rays: true, laurel: true },
  hall_of_fame: { base: "#ffd873", baseDark: "#d9a233", ring: "#fff2c4", glow: "rgba(255,216,115,0.7)", rays: true, laurel: true },
};

export function LegacyMedal({ tier, size = 76 }: { tier: LegacyTier; size?: number }) {
  const look = TIER_LOOK[tier];
  const gradId = `medal-grad-${tier}`;
  const glowId = `medal-glow-${tier}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${tier} medal`}>
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={look.ring} />
          <stop offset="55%" stopColor={look.base} />
          <stop offset="100%" stopColor={look.baseDark} />
        </radialGradient>
        {look.glow !== "transparent" && (
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={look.glow} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        )}
      </defs>

      {look.glow !== "transparent" && <circle cx="50" cy="52" r="48" fill={`url(#${glowId})`} />}

      {look.rays && (
        <g opacity={0.55} stroke={look.ring} strokeWidth={2} strokeLinecap="round">
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const x1 = 50 + Math.cos(angle) * 30;
            const y1 = 52 + Math.sin(angle) * 30;
            const x2 = 50 + Math.cos(angle) * 44;
            const y2 = 52 + Math.sin(angle) * 44;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      )}

      {look.laurel && (
        <g fill="none" stroke={look.ring} strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
          <path d="M22 62 C16 50, 18 36, 28 28" />
          <path d="M78 62 C84 50, 82 36, 72 28" />
          {[0, 1, 2, 3].map((i) => (
            <g key={`l${i}`}>
              <path d={`M${24 + i * 1.5} ${58 - i * 8} l-6 -3`} />
              <path d={`M${76 - i * 1.5} ${58 - i * 8} l6 -3`} />
            </g>
          ))}
        </g>
      )}

      {/* Ribbon */}
      <path d="M40 30 L34 6 L46 12 L50 4 L54 12 L66 6 L60 30 Z" fill={look.baseDark} opacity={0.9} />

      {/* Medal disc */}
      <circle cx="50" cy="56" r="26" fill={`url(#${gradId})`} stroke={look.ring} strokeWidth={2} />
      <circle cx="50" cy="56" r="19" fill="none" stroke={look.ring} strokeWidth={1.4} opacity={0.6} />

      {/* Star */}
      <path
        d="M50 45 L53.4 52.3 L61.4 53.2 L55.5 58.7 L57.2 66.6 L50 62.6 L42.8 66.6 L44.5 58.7 L38.6 53.2 L46.6 52.3 Z"
        fill={look.ring}
      />
    </svg>
  );
}
