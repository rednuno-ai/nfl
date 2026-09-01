import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A small, self-contained account-controls dialog. It owns its keyboard
 * contract so every entry point (currently the global footer) behaves the
 * same: focus enters the dialog, stays there, Escape closes it, then focus
 * returns to the control that opened it. */
export function PrivacyAccountControlsDialog({
  username,
  storageSummary,
  returnFocusRef,
  onClose,
  onOpenSettings,
}: {
  username: string | undefined;
  storageSummary: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Wait until the portal is in the document, then put the user on a
    // named control inside the dialog. This is reliable for keyboard and
    // screen-reader users, including when the dialog was opened from footer.
    const frame = window.requestAnimationFrame(() => (closeButtonRef.current ?? dialog?.querySelector<HTMLElement>(FOCUSABLE))?.focus());

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
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="modal privacy-controls-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-controls-title" aria-describedby="privacy-controls-description">
        <div className="modal-eyebrow">ACCOUNT & PRIVACY</div>
        <h2 id="privacy-controls-title" className="modal-title">Privacy & account controls</h2>
        <p id="privacy-controls-description" className="modal-body">You are signed in as <strong>{username ?? "your account"}</strong>. {storageSummary}</p>
        <ul className="privacy-controls-list">
          <li>Review your recovery code, sign out, reset the demo profile, or delete saved data in Profile settings.</li>
          <li>Deleting a career or account always asks for confirmation.</li>
          <li>No personal analytics are sent by this build; gameplay counters stay on this device.</li>
        </ul>
        <div className="modal-actions">
          <button ref={closeButtonRef} type="button" className="btn btn-ghost" aria-label="Close privacy and account controls" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={onOpenSettings}>Open Profile Settings</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
