// =============================================================================
// Local authentication + subscription gate.
// -----------------------------------------------------------------------------
// NFL LIFE requires an account to play (registration wall) and an active
// subscription (paywall) once logged in. This module is a client-side,
// localStorage-backed implementation so that requirement works TODAY with no
// backend — see GAME_DESIGN.md §5/§8 for why this sandbox can't reach a live
// Supabase/Stripe project directly.
//
// This is NOT a substitute for real server-side auth: anyone with browser
// devtools can inspect or edit localStorage. It exists behind the same small
// surface (register/login/logout/getSession) that a real backend would
// expose, specifically so it's a drop-in swap later:
//   - Auth  -> replace this file with Supabase Auth (email/password or OAuth).
//   - Billing -> replace `activateSubscriptionDemo` with a real Stripe
//     Checkout redirect + webhook that flips `subscriptionActive` server-side.
// Nothing outside src/data/auth.ts and the two screens that call it needs to
// change when that swap happens.
//
// Pricing: NFL LIFE is $5/month (SUBSCRIPTION_PRICE_USD below). No payment
// processor is connected in this build (no Stripe/PayPal account authorized
// for this session), so `activateSubscriptionDemo` simulates a successful
// payment instead of collecting a real card — the paywall screen says this
// explicitly. We do not collect or store card details anywhere in this repo.
// =============================================================================

export const SUBSCRIPTION_PRICE_USD = 5;
export const SUBSCRIPTION_PERIOD_LABEL = "mês";

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
const DEFAULT_ADMIN_USERNAME = "adm";
const DEFAULT_ADMIN_PASSWORD = "adm";

function loadUsers(): Record<string, AuthUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");
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

function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
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
export function findUserByReferralCode(codeRaw: string): AuthUser | null {
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

export function getSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const session = getSession();
  if (!session) return null;
  return loadUsers()[session.username] ?? null;
}

export async function register(usernameRaw: string, password: string, referralCodeRaw?: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  if (username.length < 2) return { ok: false, error: "Nome de utilizador demasiado curto (mínimo 2 caracteres)." };
  if (password.length < 3) return { ok: false, error: "Password demasiado curta (mínimo 3 caracteres)." };
  const users = loadUsers();
  if (users[username]) return { ok: false, error: "Esse nome de utilizador já está registado." };

  // A referral only counts if it points at a real, different account — a
  // stale/typo'd/self-referral code is silently ignored rather than
  // blocking registration, since it's a bonus, not a requirement.
  let referrer: AuthUser | null = null;
  if (referralCodeRaw && referralCodeRaw.trim()) {
    const candidate = findUserByReferralCode(referralCodeRaw);
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
  };
  if (referrer) {
    users[referrer.username] = { ...referrer, referralCount: referrer.referralCount + 1 };
  }
  saveUsers(users);
  startSession(username);
  return { ok: true };
}

export async function login(usernameRaw: string, password: string): Promise<AuthResult> {
  const username = normalizeUsername(usernameRaw);
  const users = loadUsers();
  const user = users[username];
  if (!user) return { ok: false, error: "Não existe nenhuma conta com esse nome de utilizador." };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: "Password incorreta." };
  startSession(username);
  return { ok: true };
}

/** Simulates a successful $5/month subscription payment. See module header:
 *  no real payment processor is wired into this build. */
export function activateSubscriptionDemo(usernameRaw: string): void {
  const username = normalizeUsername(usernameRaw);
  const users = loadUsers();
  const user = users[username];
  if (!user) return;
  users[username] = { ...user, subscriptionActive: true, subscriptionStartedAt: Date.now() };
  saveUsers(users);
}

export function cancelSubscription(usernameRaw: string): void {
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
export async function seedDefaultAccounts(): Promise<void> {
  const users = loadUsers();
  if (Object.keys(users).length > 0) return;
  const result = await register(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD);
  if (result.ok) {
    activateSubscriptionDemo(DEFAULT_ADMIN_USERNAME);
    logout(); // don't auto-login; the seeded account still goes through the normal login screen
  }
}
