import type { TrainingFocusChoice } from "@engine/career";
import type { TrainingSelection } from "@engine/career";
import { useDialogFocus } from "@ui/hooks/useDialogFocus";

export function TrainingModal({ week, options, onChoose }: { week: number; options: TrainingFocusChoice[]; onChoose: (focusId: TrainingSelection) => void }) {
  const dialogRef = useDialogFocus();
  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="training-modal-title" aria-describedby="training-modal-description">
        <div className="modal-eyebrow">Training · Week {week}</div>
        <h2 id="training-modal-title" className="modal-title">How do you want to spend this training week?</h2>
        <p id="training-modal-description" className="modal-body">Pick a focus, or take a week for life away from the field. Every option has a real trade-off.</p>
        <div className="choice-list">
          {options.map((option) => (
            <button key={option.id} type="button" className="choice-btn" onClick={() => onChoose(option.id)}>
              <div className="choice-label">{option.label}</div>
              <div className="choice-desc">{option.description}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
