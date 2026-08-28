import type { TrainingFocusChoice } from "@engine/career";
import type { TrainingSelection } from "@engine/career";

export function TrainingModal({ week, options, onChoose }: { week: number; options: TrainingFocusChoice[]; onChoose: (focusId: TrainingSelection) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-eyebrow">Training · Week {week}</div>
        <div className="modal-title">How do you want to spend this training week?</div>
        <div className="modal-body">Pick a focus, or take a week for life away from the field. Every option has a real trade-off.</div>
        <div className="choice-list">
          {options.map((option) => (
            <button key={option.id} className="choice-btn" onClick={() => onChoose(option.id)}>
              <div className="choice-label">{option.label}</div>
              <div className="choice-desc">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
