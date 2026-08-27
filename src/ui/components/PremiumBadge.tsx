// A generated "unlock everything" badge for the subscription paywall — the
// screen was previously all text and a price tag. Reuses the app's orange
// brand gradient so it reads as part of the same visual family as the crest
// system rather than a bolted-on icon.

export function PremiumBadge({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Premium access">
      <defs>
        <linearGradient id="premium-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8a5b" />
          <stop offset="100%" stopColor="#b8431f" />
        </linearGradient>
        <radialGradient id="premium-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(255,138,91,0.45)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="48" fill="url(#premium-glow)" />

      <path
        d="M50 6 L88 20 V48 C88 72 72 88 50 96 C28 88 12 72 12 48 V20 Z"
        fill="url(#premium-grad)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
      />

      <path
        d="M50 14 L80 25.5 V47.5 C80 67 67 80 50 87 C33 80 20 67 20 47.5 V25.5 Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.2}
      />

      {/* Unlocked padlock, centered */}
      <g transform="translate(50 50)" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <rect x="-14" y="-4" width="28" height="22" rx="4" fill="#fff" stroke="none" />
        <path d="M-8 -4 V-12 C-8 -19 8 -19 8 -12" />
      </g>
    </svg>
  );
}
