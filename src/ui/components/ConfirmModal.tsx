import { useDialogFocus } from "@ui/hooks/useDialogFocus";

// =============================================================================
// A themed replacement for window.confirm() — destructive actions (deleting a
// career, signing out mid-flow, etc.) used to fall back to the browser's own
// native confirm() dialog, which looks jarringly out of place in an app that
// otherwise has a fully custom dark, card-based modal system (see
// DecisionModal/TrainingModal). This reuses the same .modal-backdrop/.modal
// classes so a confirmation prompt feels like part of the game, not like the
// browser interrupting it.
// =============================================================================

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action (red) instead of the default accent. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialogFocus(onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <section ref={dialogRef} className="modal" style={{ width: "min(420px, 100%)" }} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-description" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-modal-title" className="modal-title">{title}</h2>
        <p id="confirm-modal-description" className="modal-body" style={{ marginBottom: 22 }}>
          {body}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn"
            style={danger ? { background: "#e5484d", borderColor: "transparent", color: "#fff" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
