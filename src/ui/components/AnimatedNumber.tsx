import { useEffect, useRef, useState } from "react";

// =============================================================================
// Makes a changing number feel alive instead of just snapping to a new value:
// counts up/down over a short ease, and pops a floating "+2" / "-1" delta
// badge next to it. Optionally celebrates a new session-best with a small
// "NEW PERSONAL BEST" badge (e.g. overall rating climbing past its previous
// high this session) — this is a per-mount, in-session high, not a
// server-persisted all-time record, so it resets on page reload.
// =============================================================================

export function AnimatedNumber({
  value,
  format,
  celebrate = false,
  celebrateLabel = "🏆 New Personal Best",
  className,
}: {
  value: number;
  /** Formats the (rounded, mid-animation) numeric value for display, e.g. moneyCompact. */
  format?: (n: number) => string;
  /** When true, flashes a "new personal best" badge the first time `value` rises above every value seen so far. */
  celebrate?: boolean;
  celebrateLabel?: string;
  className?: string;
}) {
  const prevRef = useRef(value);
  const bestRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const diff = to - from;
    setDelta(diff);
    if (celebrate && to > bestRef.current) {
      bestRef.current = to;
      setCelebrating(true);
    }

    const duration = 550;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    const deltaTimer = setTimeout(() => setDelta(null), 1800);
    const bestTimer = setTimeout(() => setCelebrating(false), 2400);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(deltaTimer);
      clearTimeout(bestTimer);
    };
    // Only the target value should retrigger the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`animated-number ${className ?? ""}`}>
      {format ? format(display) : display}
      {delta !== null && delta !== 0 && (
        <span className={`animated-number-delta ${delta > 0 ? "is-up" : "is-down"}`}>{delta > 0 ? `+${delta}` : delta}</span>
      )}
      {celebrating && <span className="animated-number-best">{celebrateLabel}</span>}
    </span>
  );
}
