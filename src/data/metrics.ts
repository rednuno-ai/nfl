/**
 * Small, local-only product counters. These deliberately contain no account,
 * player, device, IP, or free-form text data and are never sent anywhere.
 * They answer only whether key flows were reached on this browser.
 */
const METRICS_KEY = "gridiron-life:internal-metrics:v1";

export type OnboardingStage = "bio" | "attributes";
export type InternalMetricEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "onboarding_abandoned"
  | "first_game_started"
  | "first_game_completed"
  | "returned_next_day";

export interface InternalMetricsSnapshot {
  version: 1;
  counts: Record<string, number>;
  lastActiveDay?: string;
  pendingOnboardingStage?: OnboardingStage;
  firstGameStarted?: boolean;
  firstGameCompleted?: boolean;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function dayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function emptySnapshot(): InternalMetricsSnapshot {
  return { version: 1, counts: {} };
}

export function readInternalMetrics(): InternalMetricsSnapshot {
  const store = storage();
  if (!store) return emptySnapshot();
  try {
    const saved = JSON.parse(store.getItem(METRICS_KEY) ?? "") as Partial<InternalMetricsSnapshot>;
    return saved?.version === 1 && saved.counts && typeof saved.counts === "object"
      ? { version: 1, counts: saved.counts, lastActiveDay: saved.lastActiveDay, pendingOnboardingStage: saved.pendingOnboardingStage, firstGameStarted: saved.firstGameStarted, firstGameCompleted: saved.firstGameCompleted }
      : emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

function save(snapshot: InternalMetricsSnapshot): void {
  try {
    storage()?.setItem(METRICS_KEY, JSON.stringify(snapshot));
  } catch {
    // Metrics must never block the game when storage is unavailable.
  }
}

function countKey(event: InternalMetricEvent, stage?: OnboardingStage): string {
  return stage ? `${event}:${stage}` : event;
}

function increment(snapshot: InternalMetricsSnapshot, event: InternalMetricEvent, stage?: OnboardingStage): void {
  const key = countKey(event, stage);
  snapshot.counts[key] = (snapshot.counts[key] ?? 0) + 1;
}

export function startOnboarding(): void {
  const snapshot = readInternalMetrics();
  increment(snapshot, "onboarding_started", "bio");
  snapshot.pendingOnboardingStage = "bio";
  save(snapshot);
}

export function setOnboardingStage(stage: OnboardingStage): void {
  const snapshot = readInternalMetrics();
  if (!snapshot.pendingOnboardingStage) return;
  snapshot.pendingOnboardingStage = stage;
  save(snapshot);
}

export function abandonOnboarding(): void {
  const snapshot = readInternalMetrics();
  if (!snapshot.pendingOnboardingStage) return;
  increment(snapshot, "onboarding_abandoned", snapshot.pendingOnboardingStage);
  delete snapshot.pendingOnboardingStage;
  save(snapshot);
}

export function completeOnboarding(): void {
  const snapshot = readInternalMetrics();
  increment(snapshot, "onboarding_completed");
  delete snapshot.pendingOnboardingStage;
  save(snapshot);
}

export function recordFirstGameStarted(): void {
  const snapshot = readInternalMetrics();
  if (snapshot.firstGameStarted) return;
  increment(snapshot, "first_game_started");
  snapshot.firstGameStarted = true;
  save(snapshot);
}

export function recordFirstGameCompleted(): void {
  const snapshot = readInternalMetrics();
  if (snapshot.firstGameCompleted) return;
  increment(snapshot, "first_game_completed");
  snapshot.firstGameCompleted = true;
  save(snapshot);
}

/** Called once after a successful sign-in. A next-day return also records an
 * unfinished onboarding at its last explicit stage, with no identity attached. */
export function recordDailyReturn(now = new Date()): void {
  const snapshot = readInternalMetrics();
  const today = dayStamp(now);
  if (snapshot.lastActiveDay && snapshot.lastActiveDay !== today) {
    increment(snapshot, "returned_next_day");
    if (snapshot.pendingOnboardingStage) increment(snapshot, "onboarding_abandoned", snapshot.pendingOnboardingStage);
  }
  snapshot.lastActiveDay = today;
  save(snapshot);
}

export const __metricsTestOnly = { METRICS_KEY };
