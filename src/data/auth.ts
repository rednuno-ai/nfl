// =============================================================================
// Authentication + subscription gate.
// -----------------------------------------------------------------------------
// GRIDIRON LIFE uses the published Worker's server-side API when it is
// available. It deliberately retains a local implementation only for Vite
// development and offline previews, so the public game never treats browser
// storage as its source of truth for credentials or careers.
//
// The Worker stores only a PBKDF2 hash and an opaque, HttpOnly session cookie
// is used on the public site. Nothing outside this module needs to know which
// persistence backend is active.
//
// Pricing: GRIDIRON LIFE is $5/month (SUBSCRIPTION_PRICE_USD below). No payment
// processor is connected in this build (no Stripe/PayPal account authorized
// for this session), so `activateSubscriptionDemo` simulates a successful
// payment instead of collecting a real card — the paywall screen says this
// explicitly. We do not collect or store card details anywhere in this repo.
// =============================================================================

export const SUBSCRIPTION_PRICE_USD = 5;
export const SUBSCRIPTION_PERIOD_LABEL = "month";

export interface AuthUser {
  username: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  subscriptionActive: boolean;
  subscriptionStartedAt: number | null;
  /** Short shareable code identifying this account as a referrer. */
  referralCode: string;
  /** Username of whoever referred this account in, if any. */
  referredBy: string | null;
  /** How many other accounts registered using this account's referral code. */
  referralCount: number;
  /** One-time recovery code shown to the player in Profile. */
  recoveryKey: string;
}

export interface AuthSession {
  username: string;
  token: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

const USERS_KEY = "nfl-life:auth:users";
const SESSION_KEY = "nfl-life:auth:session";
export const DEMO_ACCOUNT_USERNAME = "adm";
const DEFAULT_ADMIN_PASSWORD = "adm";
const DEFAULT_ADMIN_RECOVERY_KEY = "DEMO-2026";
const MIN_PASSWORD_LENGTH = 8;

type BackendMode = "unknown" | "remote" | "local";
let backendMode: BackendMode = "unknown";
let remoteSession: AuthSession | null = null;
let remoteUser: AuthUser | null = null;

interface RemoteResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

function canUseRemoteApi(): boolean {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

function isPublishedHost(): boolean {
  if (typeof window === "undefined") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

async function remoteRequest<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<RemoteResponse<T> | null> {
  if (!canUseRemoteApi()) return null;
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      if (!isPublishedHost()) backendMode = "local";
      return null;
    }
    const data = (await response.json()) as T & { error?: string; ok?: boolean };
    backendMode = "remote";
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    // A published app must fail closed if its API is unavailable; falling
    // back to a stale local account would reintroduce the persistence bug.
    if (isPublishedHost()) return { ok: false, status: 503, data: { error: "The secure account service is temporarily unavailable." } as T & { error?: string } };
    backendMode = "local";
    return null;
  }
}

function cacheRemoteUser(user: AuthUser | null): void {
  remoteUser = user;
  remoteSession = user ? { username: user.username, token: "http-only-cookie" } : null;
}

function remoteUserFrom(data: { user?: AuthUser | null }): AuthUser | null {
  return data.user ?? null;
}

function passwordIsLongEnough(username: string, password: string): boolean {
  // The intentionally public demo keeps its short, documented credentials so
  // it remains frictionless to test. New player accounts require a stronger
  // password, while existing local accounts can still sign in and upgrade it.
  return isDemoAccount(username) ? password.length >= 3 : password.length >= MIN_PASSWORD_LENGTH;
}

function loadUsers(): Record<string, AuthUser> {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}") as Record<string, AuthUser>;
    let migrated = false;
    for (const user of Object.values(users)) {
      if (!user.recoveryKey) {
        user.recoveryKey = createRecoveryKey();
        migrated = true;
      }
    }
    if (migrated) saveUsers(users);
    return users;
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, AuthUser>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Only this seeded account is allowed to use the destructive demo reset. */
export function isDemoAccount(username: string | null | undefined): boolean {
  return normalizeUsername(username ?? "") === DEMO_ACCOUNT_USERNAME;
}

function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeRecoveryKey(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid ambiguity

/** Generates a short, human-typeable referral code (e.g. "MARCU-7K2"),
 *  retrying on the rare collision against existing codes. */
function generateReferralCode(username: string, existing: Record<string, AuthUser>): string {
  const takenCodes = new Set(Object.values(existing).map((u) => u.referralCode));
  const base = username.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "PLYR";
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes)
      .map((b) => REFERRAL_CODE_ALPHABET[b % REFERRAL_CODE_ALPHABET.length])
      .join("");
    const code = `${base}-${suffix}`;
    if (!takenCodes.has(code)) return code;
  }
  return `${base}-${randomToken(4)}`.toUpperCase();
}

/** Finds the account owning a given referral code, if any. */
function localFindUserByReferralCode(codeRaw: string): AuthUser | null {
  const code = normalizeReferralCode(codeRaw);
  const users = loadUsers();
  return Object.values(users).find((u) => u.referralCode === code) ?? null;
}

/** Builds a full shareable invite link for a user's referral code. */
export function buildReferralLink(referralCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  return `${origin}?ref=${referralCode}`;
}

function randomToken(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createRecoveryKey(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const fragment = Array.from(bytes)
    .map((byte) => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length])
    .join("");
  return `GL-${fragment.slice(0, 2)}${fragment.slice(2)}`;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" }, keyMaterial, 256);
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function startSession(username: string): void {
  const session: AuthSession = { username, token: randomToken() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function localGetSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function localLogout(): void {
  localStorage.removeItem(SESSION_KEY);
}

function localGetCurrentUser(): AuthUser | null {
  const session = localGetSession();
  if (!session) return null;
  return loadUsers()[session.username] ?? null;
}

async function localRegister(usernameRaw: string, password: string, referralCodeRaw?: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (username.length < 2) return { ok: false, error: "Username too short (minimum 2 characters)." };
  if (!passwordIsLongEnough(username, password)) return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  const users = loadUsers();
  if (users[username]) return { ok: false, error: "That username is already registered." };

  // A referral only counts if it points at a real, different account — a
  // stale/typo'd/self-referral code is silently ignored rather than
  // blocking registration, since it's a bonus, not a requirement.
  let referrer: AuthUser | null = null;
  if (referralCodeRaw && referralCodeRaw.trim()) {
    const candidate = localFindUserByReferralCode(referralCodeRaw);
    if (candidate && candidate.username !== username) referrer = candidate;
  }

  const salt = randomToken();
  const passwordHash = await hashPassword(password, salt);
  const referralCode = generateReferralCode(username, users);
  users[username] = {
    username,
    salt,
    passwordHash,
    createdAt: Date.now(),
    subscriptionActive: false,
    subscriptionStartedAt: null,
    referralCode,
    referredBy: referrer?.username ?? null,
    referralCount: 0,
    recoveryKey: createRecoveryKey(),
  };
  if (referrer) {
    users[referrer.username] = { ...referrer, referralCount: referrer.referralCount + 1 };
  }
  saveUsers(users);
  startSession(username);
  return { ok: true };
}

async function localLogin(usernameRaw: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  const users = loadUsers();
  const user = users[username];
  if (!user) return { ok: false, error: "Incorrect username or password." };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: "Incorrect username or password." };
  startSession(username);
  return { ok: true };
}

/** Resets a password only when the player provides the recovery key they were
 * shown in Profile. A production build must replace this local-only flow with
 * verified email recovery. */
async function localRecoverPassword(usernameRaw: string, recoveryKeyRaw: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (!passwordIsLongEnough(username, password)) return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.` };
  const users = loadUsers();
  const user = users[username];
  if (!user || normalizeRecoveryKey(user.recoveryKey) !== normalizeRecoveryKey(recoveryKeyRaw)) {
    return { ok: false, error: "That username and recovery code do not match." };
  }
  const salt = randomToken();
  users[username] = { ...user, salt, passwordHash: await hashPassword(password, salt) };
  saveUsers(users);
  startSession(username);
  return { ok: true };
}

/** Local development fallback for password changes. The published route is
 * server-authenticated by the Worker below. */
async function localChangePassword(usernameRaw: string, currentPassword: string, nextPassword: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (!passwordIsLongEnough(username, nextPassword)) return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.` };
  const users = loadUsers();
  const user = users[username];
  if (!user) return { ok: false, error: "Your account is no longer available on this device." };
  const currentHash = await hashPassword(currentPassword, user.salt);
  if (currentHash !== user.passwordHash) return { ok: false, error: "Your current password is incorrect." };
  const salt = randomToken();
  users[username] = { ...user, salt, passwordHash: await hashPassword(nextPassword, salt) };
  saveUsers(users);
  return { ok: true };
}

/** Deletes an account and every career stored for it on this device. The UI
 * always confirms this destructive action before calling it. */
function localDeleteAccount(usernameRaw: string): void {
  const username = normalizeUsername(usernameRaw);
  const careerIds = (() => {
    try {
      return JSON.parse(localStorage.getItem(`nfl-life:index:${username}`) ?? "[]") as string[];
    } catch {
      return [] as string[];
    }
  })();
  for (const careerId of careerIds) {
    localStorage.removeItem(`nfl-life:career:${careerId}`);
    localStorage.removeItem(`nfl-life:career-updated:${careerId}`);
  }
  localStorage.removeItem(`nfl-life:index:${username}`);
  const users = loadUsers();
  delete users[username];
  saveUsers(users);
  localLogout();
}

/** Rebuilds the professional demo profile from scratch, including deleting its
 * saves. It is deliberately explicit: visitors can safely replay the sample
 * flow without silently losing their own account data. */
async function localResetDemoAccount(usernameRaw: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (!isDemoAccount(username)) return { ok: false, error: "Only the demo account can be reset." };
  const careerIds = (() => {
    try {
      return JSON.parse(localStorage.getItem(`nfl-life:index:${username}`) ?? "[]") as string[];
    } catch {
      return [] as string[];
    }
  })();
  for (const careerId of careerIds) {
    localStorage.removeItem(`nfl-life:career:${careerId}`);
    localStorage.removeItem(`nfl-life:career-updated:${careerId}`);
  }
  localStorage.removeItem(`nfl-life:index:${username}`);

  const users = loadUsers();
  const salt = randomToken();
  users[username] = {
    username,
    salt,
    passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD, salt),
    createdAt: Date.now(),
    subscriptionActive: true,
    subscriptionStartedAt: Date.now(),
    referralCode: "DEMO-GL",
    referredBy: null,
    referralCount: 0,
    recoveryKey: DEFAULT_ADMIN_RECOVERY_KEY,
  };
  saveUsers(users);
  localLogout();
  return { ok: true };
}

/** Simulates a successful $5/month subscription payment. See module header:
 *  no real payment processor is wired into this build. */
function localActivateSubscriptionDemo(usernameRaw: string): void {
  const username = normalizeUsername(usernameRaw);
  const users = loadUsers();
  const user = users[username];
  if (!user) return;
  users[username] = { ...user, subscriptionActive: true, subscriptionStartedAt: Date.now() };
  saveUsers(users);
}

function localCancelSubscription(usernameRaw: string): void {
  const username = normalizeUsername(usernameRaw);
  const users = loadUsers();
  const user = users[username];
  if (!user) return;
  users[username] = { ...user, subscriptionActive: false };
  saveUsers(users);
}

/** Ensures a ready-to-use demo/admin account exists (adm/adm), pre-subscribed
 *  so testing doesn't require registering + clicking through the paywall
 *  every time. Only runs once, when there are no accounts yet. Awaited at
 *  app startup (see main.tsx) so it's guaranteed to exist before the login
 *  screen is interactive. */
async function localSeedDefaultAccounts(): Promise<void> {
  const users = loadUsers();
  if (users[DEMO_ACCOUNT_USERNAME]) return;
  const result = await localRegister(DEMO_ACCOUNT_USERNAME, DEFAULT_ADMIN_PASSWORD);
  if (result.ok) {
    localActivateSubscriptionDemo(DEMO_ACCOUNT_USERNAME);
    const updatedUsers = loadUsers();
    updatedUsers[DEMO_ACCOUNT_USERNAME] = { ...updatedUsers[DEMO_ACCOUNT_USERNAME], recoveryKey: DEFAULT_ADMIN_RECOVERY_KEY, referralCode: "DEMO-GL" };
    saveUsers(updatedUsers);
    localLogout(); // don't auto-login; the seeded account still goes through the normal login screen
  }
}

/** Hydrates the browser-only cache from the Worker's HttpOnly session. This
 * runs before React renders, so a refresh keeps a signed-in player signed in
 * without storing a bearer token in the page. */
export async function hydrateAuthSession(): Promise<void> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/session", { method: "GET" });
  if (response) {
    cacheRemoteUser(response.ok ? remoteUserFrom(response.data) : null);
    return;
  }
  if (backendMode === "unknown") backendMode = "local";
}

export function usesRemoteAuth(): boolean {
  return backendMode === "remote";
}

export function getSession(): AuthSession | null {
  return backendMode === "remote" ? remoteSession : localGetSession();
}

export function getCurrentUser(): AuthUser | null {
  return backendMode === "remote" ? remoteUser : localGetCurrentUser();
}

export function findUserByReferralCode(codeRaw: string): AuthUser | null {
  // Referral lookups are only a convenience in local development. The
  // production Worker resolves and validates referral codes during signup.
  return backendMode === "remote" ? null : localFindUserByReferralCode(codeRaw);
}

export async function register(username: string, password: string, referralCode?: string): Promise<AuthResult> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, referralCode }),
  });
  if (response) {
    if (!response.ok) return { ok: false, error: response.data.error ?? "Couldn't create the account." };
    cacheRemoteUser(remoteUserFrom(response.data));
    return { ok: true };
  }
  return localRegister(username, password, referralCode);
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (response) {
    if (!response.ok) return { ok: false, error: response.data.error ?? "Couldn't sign in." };
    cacheRemoteUser(remoteUserFrom(response.data));
    return { ok: true };
  }
  return localLogin(username, password);
}

export async function recoverPassword(username: string, recoveryKey: string, password: string): Promise<AuthResult> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/recover", {
    method: "POST",
    body: JSON.stringify({ username, recoveryKey, password }),
  });
  if (response) {
    if (!response.ok) return { ok: false, error: response.data.error ?? "Couldn't reset the password." };
    cacheRemoteUser(remoteUserFrom(response.data));
    return { ok: true };
  }
  return localRecoverPassword(username, recoveryKey, password);
}

export async function changePassword(username: string, currentPassword: string, nextPassword: string): Promise<AuthResult> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ username, currentPassword, nextPassword }),
  });
  if (response) {
    if (!response.ok) return { ok: false, error: response.data.error ?? "Couldn't change the password." };
    cacheRemoteUser(remoteUserFrom(response.data));
    return { ok: true };
  }
  return localChangePassword(username, currentPassword, nextPassword);
}

export async function resetDemoAccount(username: string): Promise<AuthResult> {
  const response = await remoteRequest("/api/auth/reset-demo", { method: "POST", body: JSON.stringify({ username }) });
  if (response) {
    if (!response.ok) return { ok: false, error: response.data.error ?? "Couldn't reset the demo profile." };
    cacheRemoteUser(null);
    return { ok: true };
  }
  return localResetDemoAccount(username);
}

export function logout(): void {
  if (backendMode === "remote" || (backendMode === "unknown" && isPublishedHost())) {
    cacheRemoteUser(null);
    void remoteRequest("/api/auth/logout", { method: "POST", body: "{}" });
    return;
  }
  localLogout();
}

export function deleteAccount(username: string): void {
  if (backendMode === "remote" || (backendMode === "unknown" && isPublishedHost())) {
    cacheRemoteUser(null);
    void remoteRequest("/api/auth/account", { method: "DELETE" });
    return;
  }
  localDeleteAccount(username);
}

export async function activateSubscriptionDemo(username: string): Promise<void> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/subscribe", { method: "POST", body: JSON.stringify({ username }) });
  if (response) {
    if (response.ok) cacheRemoteUser(remoteUserFrom(response.data));
    return;
  }
  localActivateSubscriptionDemo(username);
}

export async function cancelSubscription(username: string): Promise<void> {
  const response = await remoteRequest<{ user?: AuthUser | null }>("/api/auth/cancel-subscription", { method: "POST", body: JSON.stringify({ username }) });
  if (response) {
    if (response.ok) cacheRemoteUser(remoteUserFrom(response.data));
    return;
  }
  localCancelSubscription(username);
}

/** Ensures the demo profile exists locally only when a Worker API is not
 * present. In production the Durable Object creates it atomically. */
export async function seedDefaultAccounts(): Promise<void> {
  await hydrateAuthSession();
  if (backendMode === "remote" || isPublishedHost()) return;
  await localSeedDefaultAccounts();
}

/** Fetches a server-side data export when authenticated remotely. */
export async function fetchRemoteAccountExport(): Promise<string | null> {
  if (backendMode !== "remote") return null;
  const response = await remoteRequest("/api/account/export", { method: "GET" });
  if (!response?.ok) return null;
  return JSON.stringify(response.data, null, 2);
}
