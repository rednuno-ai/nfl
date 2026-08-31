import type { PendingDecision } from "@engine/types";
import { useDialogFocus } from "@ui/hooks/useDialogFocus";

export function DecisionModal({ decision, onChoose }: { decision: PendingDecision; onChoose: (choiceId: string) => void }) {
  const dialogRef = useDialogFocus();
  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title" aria-describedby="decision-modal-description">
        <div className="modal-eyebrow">Decision · Week {decision.week}</div>
        <h2 id="decision-modal-title" className="modal-title">{decision.title}</h2>
        <p id="decision-modal-description" className="modal-body">{decision.description}</p>
        <div className="choice-list">
          {decision.choices.map((choice) => (
            <button key={choice.id} type="button" className="choice-btn" onClick={() => onChoose(choice.id)}>
              <div className="choice-label">{choice.label}</div>
              {choice.description && <div className="choice-desc">{choice.description}</div>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
