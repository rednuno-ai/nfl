// Original, fully procedural SVG athlete silhouette — no photography, no real
// team or player likeness. This is the "giant player art in the background"
// piece for the cinematic homepage/career-select hero, built with the same
// gradient-silhouette language as PositionBadge/TeamCrest so the whole app's
// art stays consistent and 100% fictional.
export function PlayerHeroArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 640 760"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="hero-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1c2130" />
          <stop offset="100%" stopColor="#05060a" />
        </linearGradient>
        <linearGradient id="hero-rim-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,90,54,0)" />
          <stop offset="100%" stopColor="rgba(255,90,54,0.55)" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="72%" cy="28%" r="55%">
          <stop offset="0%" stopColor="rgba(255,90,54,0.28)" />
          <stop offset="100%" stopColor="rgba(255,90,54,0)" />
        </radialGradient>
      </defs>

      <circle cx="460" cy="210" r="260" fill="url(#hero-glow)" />

      {/* shoulders / torso, shoulder-pad silhouette */}
      <path
        d="M120 760 L120 560 C120 460 180 420 230 400 C210 380 200 352 200 326 C200 300 214 280 232 280 L242 300 C246 288 258 280 272 280 L272 320 C300 300 340 288 380 288 C420 288 460 300 488 320 L488 280 C502 280 514 300 518 326 L528 300 C546 300 560 320 560 346 C560 372 550 400 530 400 C580 420 640 460 640 560 L640 760 Z"
        fill="url(#hero-body-grad)"
        stroke="url(#hero-rim-grad)"
        strokeWidth={3}
      />

      {/* helmet */}
      <path
        d="M320 90 C400 90 452 142 452 210 C452 262 424 300 384 320 L384 280 C384 258 356 244 320 244 C284 244 256 258 256 280 L256 320 C216 300 188 262 188 210 C188 142 240 90 320 90 Z"
        fill="url(#hero-body-grad)"
        stroke="url(#hero-rim-grad)"
        strokeWidth={3}
      />
      {/* facemask hint */}
      <path
        d="M256 280 C256 306 284 328 320 328 C356 328 384 306 384 280"
        fill="none"
        stroke="rgba(255,90,54,0.4)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M300 300 L300 350 M320 306 L320 356 M340 300 L340 350"
        stroke="rgba(255,90,54,0.25)"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  );
}
