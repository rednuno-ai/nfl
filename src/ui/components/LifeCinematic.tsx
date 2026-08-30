import { useEffect } from "react";
import type { CinematicScene } from "@store/gameStore";

const SCENE_COPY: Record<CinematicScene, { eyebrow: string; action: string }> = {
  contract: { eyebrow: "CAREER REEL · SIGNING DAY", action: "Enter the next chapter" },
  garage: { eyebrow: "CAREER REEL · THE GARAGE", action: "Take the keys" },
  home: { eyebrow: "CAREER REEL · HOME BASE", action: "Make it home" },
  press: { eyebrow: "CAREER REEL · AFTER THE WHISTLE", action: "Keep moving" },
  relationship: { eyebrow: "CAREER REEL · OFF THE CLOCK", action: "Back to your story" },
  training: { eyebrow: "CAREER REEL · PUT IN THE WORK", action: "Get after it" },
  film: { eyebrow: "CAREER REEL · FILM ROOM", action: "Trust the read" },
  recovery: { eyebrow: "CAREER REEL · RECOVERY", action: "Reset and return" },
  team: { eyebrow: "CAREER REEL · THE LOCKER ROOM", action: "Stay connected" },
  tunnel: { eyebrow: "CAREER REEL · GAME NIGHT", action: "Take the field" },
  draft: { eyebrow: "CAREER REEL · THE CALL", action: "Keep the moment" },
  interview: { eyebrow: "CAREER REEL · IN THE SPOTLIGHT", action: "Own your voice" },
  travel: { eyebrow: "CAREER REEL · ON THE ROAD", action: "Arrive ready" },
};

/** A short, first-person cinematic beat built from original art and lightweight
 * camera, grain and flash animation. It deliberately avoids third-party clips
 * and large video downloads while retaining a cutscene-like feel. */
export function LifeCinematic({ scene, title, body, onClose }: { scene: CinematicScene; title: string; body: string; onClose: () => void }) {
  const copy = SCENE_COPY[scene];
  const isGameIntro = scene === "tunnel" || scene === "travel";
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="life-cinematic-backdrop" role="presentation">
      <section className={`life-cinematic life-cinematic--${scene}`} role="dialog" aria-modal="true" aria-labelledby="life-cinematic-title" aria-describedby="life-cinematic-description">
        <div className="life-cinematic-art" aria-hidden="true" />
        <div className="life-cinematic-grain" aria-hidden="true" />
        <div className="life-cinematic-reel" aria-hidden="true"><span /></div>
        <div className="life-cinematic-copy">
          <div className="life-cinematic-eyebrow">{copy.eyebrow}</div>
          <h2 id="life-cinematic-title">{title}</h2>
          <p id="life-cinematic-description">{body}</p>
          <div className="life-cinematic-actions">
            {isGameIntro && <button type="button" className="btn btn-ghost life-cinematic-skip" onClick={onClose}>Skip intro</button>}
            <button className="btn btn-primary life-cinematic-action" onClick={onClose} autoFocus>
              {copy.action} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
