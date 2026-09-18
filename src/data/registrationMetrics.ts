export type RegistrationSignal = "landing_opened" | "register_opened" | "register_clicked" | "invalid_username" | "invalid_password" | "demo_selected" | "register_client_error";
const seen = new Set<string>();
/** Best-effort aggregate counters: no account, URL, password or device identifier. */
export function registrationSignal(event: RegistrationSignal, once = false): void {
  if (typeof window === "undefined" || window.location.hostname === "localhost" || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  if (once && seen.has(event)) return;
  seen.add(event);
  void fetch("/api/telemetry", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }), keepalive: true, signal: AbortSignal.timeout(5000) }).catch(() => {});
}
