import { useEffect, useMemo, useRef } from 'react';
import type { PossessionLogEntry } from '@engine/simulation/gameSim';
import { buildReplay } from './replayScene';
import { createReplayRenderer } from './replayRenderer';
import './playReplay.css';

export function PlayReplay({ entry, paused, duration, home, away, playerName, playerPosition }: {
  entry?: PossessionLogEntry; paused: boolean; duration: number; home: string; away: string; playerName: string; playerPosition: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useMemo(() => buildReplay(entry), [entry]);
  const playback = useRef({ scene, progress: 0 });
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    if (playback.current.scene !== scene) playback.current = { scene, progress: 0 };
    const draw = createReplayRenderer(context);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, last = 0, width = 0, height = 0;
    const paint = () => draw(scene, reducedMotion.matches ? 1 : playback.current.progress, width, height, home, away, playerPosition, playerName);
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      element.width = Math.round(width*dpr); element.height = Math.round(height*dpr);
      context.setTransform(dpr,0,0,dpr,0,0); paint();
    };
    const frame = (now: number) => {
      raf = 0;
      if (paused || document.hidden || reducedMotion.matches || !entry) return;
      if (last) playback.current.progress = Math.min(1, playback.current.progress + Math.min(100,now-last)/duration);
      last = now; paint();
      if (playback.current.progress < 1) raf = requestAnimationFrame(frame);
    };
    const resume = () => { cancelAnimationFrame(raf); last=0; paint(); if (!document.hidden) raf=requestAnimationFrame(frame); };
    const observer = new ResizeObserver(resize);
    observer.observe(element); resize(); resume();
    document.addEventListener('visibilitychange',resume);
    reducedMotion.addEventListener('change',resume);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange',resume); reducedMotion.removeEventListener('change',resume); };
  }, [scene, paused, duration, home, away, entry, playerPosition, playerName]);
  return <figure className="play-replay">
    <canvas ref={canvas} role="img" aria-label={`Play illustration: ${entry?.text ?? 'Teams lined up before kickoff.'}`}>Play illustration. {entry?.text}</canvas>
    <figcaption><span><i className="replay-home" />{home}</span><span><i className="replay-away" />{away}</span><small>Illustrated replay · official outcome in the play log</small></figcaption>
  </figure>;
}
