import { useEffect } from 'react';

/** Counts foreground career activity only; never records input contents. */
export function usePlaytime(enabled: boolean) {
  useEffect(() => {
    if (!enabled || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    let activity = performance.now();
    let previous = 0;
    let pending = false;
    const active = () => { activity = performance.now(); };
    const reset = () => { previous = 0; };
    const tick = async () => {
      const now = performance.now();
      if (document.hidden || !document.hasFocus() || now - activity > 60000) { reset(); return; }
      if (pending) return;
      const seconds = previous ? Math.min(30, Math.floor((now - previous) / 1000)) : 0;
      previous = now;
      pending = true;
      try {
        const response = await fetch('/api/playtime', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seconds }), signal: AbortSignal.timeout(5000) });
        if (!response.ok) reset();
      } catch { reset(); } finally { pending = false; }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach(event => window.addEventListener(event, active, { passive: true }));
    document.addEventListener('visibilitychange', reset);
    window.addEventListener('blur', reset);
    void tick();
    const timer = window.setInterval(() => { void tick(); }, 15000);
    return () => { clearInterval(timer); events.forEach(event => window.removeEventListener(event, active)); document.removeEventListener('visibilitychange', reset); window.removeEventListener('blur', reset); };
  }, [enabled]);
}
