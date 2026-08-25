import type { TrainingFocusChoice } from "@engine/career";
import type { TrainingFocus } from "@engine/aging";

export function TrainingModal({ week, options, onChoose }: { week: number; options: TrainingFocusChoice[]; onChoose: (focusId: TrainingFocus) => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-eyebrow">Treino · Semana {week}</div>
        <div className="modal-title">Como queres passar a semana de treinos?</div>
        <div className="modal-body">Escolhe um foco. Isto afeta que atributos evoluem, a tua fadiga e o risco de lesão esta semana.</div>
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
