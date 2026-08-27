import { useEffect } from "react";

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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ width: "min(420px, 100%)" }} role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body" style={{ marginBottom: 22 }}>
          {body}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className="btn"
            style={danger ? { background: "#e5484d", borderColor: "transparent", color: "#fff" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
