export const CLIENT_SIGNALS = new Set(["landing_opened", "register_opened", "register_clicked", "invalid_username", "invalid_password", "demo_selected", "register_client_error"]);
export function validClientSignal(body) {
  return body && typeof body === "object" && Object.keys(body).length === 1 && CLIENT_SIGNALS.has(body.event);
}
export function funnelSummary(rows, startedAt) {
  const counts = {};
  for (const row of rows) counts[row.event] = (counts[row.event] ?? 0) + Number(row.count);
  return { startedAt, counts };
}
