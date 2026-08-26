import { crestPalette, crestShape, crestMotif } from "@ui/lib/crestVisuals";

const SHAPE_PATHS = [
  // shield
  "M50 4 L92 18 L92 46 C92 74 74 92 50 98 C26 92 8 74 8 46 L8 18 Z",
  // hexagon
  "M50 3 L93 26 L93 74 L50 97 L7 74 L7 26 Z",
  // rounded circle badge (drawn as a path so the same stroke/fill logic applies)
  "M50 4 C75.4 4 96 24.6 96 50 C96 75.4 75.4 96 50 96 C24.6 96 4 75.4 4 50 C4 24.6 24.6 4 50 4 Z",
  // diamond shield
  "M50 3 L88 30 L76 95 L50 97 L24 95 L12 30 Z",
];

function Motif({ variant, clipId, color }: { variant: number; clipId: string; color: string }) {
  if (variant === 0) {
    return (
      <g clipPath={`url(#${clipId})`} opacity={0.28}>
        <rect x={-20} y={30} width={160} height={14} fill={color} transform="rotate(-18 50 50)" />
        <rect x={-20} y={58} width={160} height={8} fill={color} transform="rotate(-18 50 50)" />
      </g>
    );
  }
  if (variant === 1) {
    return (
      <g clipPath={`url(#${clipId})`} opacity={0.3}>
        <path d="M-10 20 L50 55 L-10 90 Z" fill={color} />
        <path d="M110 20 L50 55 L110 90 Z" fill={color} />
      </g>
    );
  }
  return (
    <g clipPath={`url(#${clipId})`} opacity={0.32}>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * 34;
        const y = 50 + Math.sin(angle) * 34;
        return <circle key={i} cx={x} cy={y} r={5} fill={color} />;
      })}
    </g>
  );
}

/**
 * A deterministic, procedurally generated team/school crest — no external
 * image assets or licensing exposure, just a stable hash of `seed` (a team
 * id, college id, high school name, etc.) mapped to a shape + color pair +
 * decorative motif. Same seed always renders the same crest.
 */
export function TeamCrest({ seed, label, size = 44, title }: { seed: string; label: string; size?: number; title?: string }) {
  const palette = crestPalette(seed);
  const shapeIdx = crestShape(seed);
  const motifIdx = crestMotif(seed);
  const clipId = `crest-clip-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;
  const gradId = `crest-grad-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;
  const path = SHAPE_PATHS[shapeIdx];
  const text = label.slice(0, 3).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? label}
      style={{ flexShrink: 0, filter: `drop-shadow(0 2px 6px ${palette.primaryDark})` }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.primaryDark} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>
      <path d={path} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
      <Motif variant={motifIdx} clipId={clipId} color={palette.secondary} />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="inherit"
        fontWeight={800}
        fontSize={text.length > 2 ? 30 : 36}
        fill="#fff"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={1.5}
        paintOrder="stroke"
      >
        {text}
      </text>
    </svg>
  );
}
