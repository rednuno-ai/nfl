import type { CinematicScene } from "@store/gameStore";

const SCENE_COPY: Record<CinematicScene, { eyebrow: string; action: string }> = {
  contract: { eyebrow: "CAREER REEL · SIGNING DAY", action: "Enter the next chapter" },
  garage: { eyebrow: "CAREER REEL · THE GARAGE", action: "Take the keys" },
  home: { eyebrow: "CAREER REEL · HOME BASE", action: "Make it home" },
  press: { eyebrow: "CAREER REEL · AFTER THE WHISTLE", action: "Keep moving" },
};

/** A short, cinematic beat built from original still art and CSS camera motion.
 * It intentionally behaves like a game cutscene without shipping heavy video
 * files or relying on third-party footage. */
export function LifeCinematic({ scene, title, body, onClose }: { scene: CinematicScene; title: string; body: string; onClose: () => void }) {
  const copy = SCENE_COPY[scene];
  return (
    <div className="life-cinematic-backdrop" role="presentation">
      <section className={`life-cinematic life-cinematic--${scene}`} role="dialog" aria-modal="true" aria-labelledby="life-cinematic-title">
        <div className="life-cinematic-art" aria-hidden="true" />
        <div className="life-cinematic-grain" aria-hidden="true" />
        <div className="life-cinematic-copy">
          <div className="life-cinematic-eyebrow">{copy.eyebrow}</div>
          <h2 id="life-cinematic-title">{title}</h2>
          <p>{body}</p>
          <button className="btn btn-primary life-cinematic-action" onClick={onClose} autoFocus>
            {copy.action} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
