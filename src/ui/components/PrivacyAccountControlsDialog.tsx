import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A small, self-contained account-controls dialog. It owns its keyboard
 * contract so every entry point (currently the global footer) behaves the
 * same: focus enters the dialog, stays there, Escape closes it, then focus
 * returns to the control that opened it. */
export function PrivacyAccountControlsDialog({
  username,
  returnFocusRef,
  onClose,
  onOpenSettings,
}: {
  username: string | undefined;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="modal privacy-controls-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-controls-title" aria-describedby="privacy-controls-description">
        <div className="modal-eyebrow">ACCOUNT & PRIVACY</div>
        <h2 id="privacy-controls-title" className="modal-title">Privacy & account controls</h2>
        <p id="privacy-controls-description" className="modal-body">You are signed in as <strong>{username ?? "your account"}</strong>. Career saves and the demo profile are stored in this browser unless a server-backed account is configured.</p>
        <ul className="privacy-controls-list">
          <li>Review your recovery code, sign out, reset the demo profile, or remove local data in Profile settings.</li>
          <li>Deleting a career or account always asks for confirmation.</li>
          <li>No personal analytics are sent by this build; gameplay counters stay on this device.</li>
        </ul>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={onOpenSettings}>Open Profile Settings</button>
        </div>
      </section>
    </div>
  );
}
