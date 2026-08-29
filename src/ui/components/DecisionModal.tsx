import type { PendingDecision } from "@engine/types";

export function DecisionModal({ decision, onChoose }: { decision: PendingDecision; onChoose: (choiceId: string) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="decision-modal-title" aria-describedby="decision-modal-description">
        <div className="modal-eyebrow">Decision · Week {decision.week}</div>
        <div id="decision-modal-title" className="modal-title">{decision.title}</div>
        <div id="decision-modal-description" className="modal-body">{decision.description}</div>
        <div className="choice-list">
          {decision.choices.map((choice) => (
            <button key={choice.id} className="choice-btn" onClick={() => onChoose(choice.id)}>
              <div className="choice-label">{choice.label}</div>
              {choice.description && <div className="choice-desc">{choice.description}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
