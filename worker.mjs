// GRIDIRON LIFE Worker
//
// Static files are served by Workers Assets. The small /api surface below is
// owned by a Durable Object so account credentials, sessions and careers
// never need to live in localStorage on the published game.

import { DurableObject } from "cloudflare:workers";

const DEMO_USERNAME = "adm";
const DEMO_PASSWORD = "adm";
const DEMO_RECOVERY_KEY = "DEMO-2026";
const SESSION_COOKIE = "gl_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MIN_PASSWORD_LENGTH = 8;
const MAX_CAREER_BYTES = 1_000_000;
const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function apiError(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s, 2))
      .filter(([name]) => Boolean(name))
  );
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return sessionCookie("", 0);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 210_000, hash: "SHA-256" },
    material,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeReferralCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeRecoveryKey(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function validUsername(username) {
  return /^[a-z0-9][a-z0-9_-]{1,30}$/.test(username);
}

function validPassword(username, password) {
  return username === DEMO_USERNAME ? String(password).length >= 3 : String(password).length >= MIN_PASSWORD_LENGTH;
}

function userForClient(row) {
  if (!row) return null;
  return {
    username: row.username,
    // Empty compatibility fields keep the existing UI type stable without
    // ever serializing server password material to browser code.
    salt: "",
    passwordHash: "",
    createdAt: Number(row.created_at),
    subscriptionActive: Boolean(row.subscription_active),
    subscriptionStartedAt: row.subscription_started_at === null ? null : Number(row.subscription_started_at),
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    referralCount: Number(row.referral_count),
    recoveryKey: row.recovery_key,
  };
}

/**
 * A single SQLite-backed Durable Object is sufficient for this game. It gives
 * the public Worker durable server-side accounts and careers without a
 * separately provisioned Supabase project.
 */
export class AccountStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ready = ctx.blockConcurrencyWhile(() => this.initialize());
  }

  async initialize() {
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS accounts (
      username TEXT PRIMARY KEY,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      subscription_active INTEGER NOT NULL DEFAULT 0,
      subscription_started_at INTEGER,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by TEXT,
      referral_count INTEGER NOT NULL DEFAULT 0
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)");
    sql.exec(`CREATE TABLE IF NOT EXISTS careers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS careers_user_updated_idx ON careers(user_id, updated_at DESC)");

    const demo = this.one("SELECT username FROM accounts WHERE username = ?", DEMO_USERNAME);
    if (!demo) {
      const salt = randomToken(16);
      const now = Date.now();
      sql.exec(
        `INSERT INTO accounts (
          username, password_salt, password_hash, recovery_key, created_at,
          subscription_active, subscription_started_at, referral_code, referred_by, referral_count
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, NULL, 0)`,
        DEMO_USERNAME,
        salt,
        await hashPassword(DEMO_PASSWORD, salt),
        DEMO_RECOVERY_KEY,
        now,
        now,
        "DEMO-GL"
      );
    }
  }

  one(query, ...params) {
    return Array.from(this.ctx.storage.sql.exec(query, ...params))[0] ?? null;
  }

  all(query, ...params) {
    return Array.from(this.ctx.storage.sql.exec(query, ...params));
  }

  async body(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  async sessionFromRequest(request) {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (!token) return null;
    const tokenHash = await sha256(token);
    const session = this.one("SELECT username, expires_at FROM sessions WHERE token_hash = ?", tokenHash);
    if (!session) return null;
    if (Number(session.expires_at) <= Date.now()) {
      this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
      return null;
    }
    const account = this.one("SELECT * FROM accounts WHERE username = ?", session.username);
    return account ? { tokenHash, account } : null;
  }

  async newSession(username) {
    const token = randomToken(32);
    const tokenHash = await sha256(token);
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM sessions WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)",
      tokenHash,
      username,
      now + SESSION_MAX_AGE_SECONDS * 1000
    );
    return token;
  }

  unauthorized() {
    return apiError("Sign in to continue.", 401);
  }

  async fetch(request) {
    await this.ready;
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/api/auth/session") {
      const session = await this.sessionFromRequest(request);
      return json({ ok: true, user: session ? userForClient(session.account) : null });
    }

    if (request.method === "POST" && pathname === "/api/auth/register") {
      const body = await this.body(request);
      const username = normalizeUsername(body.username);
      const password = String(body.password ?? "");
      if (!validUsername(username)) return apiError("Use 2–31 lowercase letters, numbers, _ or - for your username.");
      if (!validPassword(username, password)) return apiError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      if (this.one("SELECT username FROM accounts WHERE username = ?", username)) return apiError("That username is already registered.");

      let referrer = null;
      const referralCode = normalizeReferralCode(body.referralCode);
      if (referralCode) referrer = this.one("SELECT username FROM accounts WHERE referral_code = ?", referralCode);
      const salt = randomToken(16);
      const now = Date.now();
      const playerReferralCode = await this.availableReferralCode(username);
      this.ctx.storage.sql.exec(
        `INSERT INTO accounts (
          username, password_salt, password_hash, recovery_key, created_at,
          subscription_active, subscription_started_at, referral_code, referred_by, referral_count
        ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, 0)`,
        username,
        salt,
        await hashPassword(password, salt),
        this.createRecoveryKey(),
        now,
        playerReferralCode,
        referrer?.username ?? null
      );
      if (referrer && referrer.username !== username) {
        this.ctx.storage.sql.exec("UPDATE accounts SET referral_count = referral_count + 1 WHERE username = ?", referrer.username);
      }
      const account = this.one("SELECT * FROM accounts WHERE username = ?", username);
      const token = await this.newSession(username);
      return json({ ok: true, user: userForClient(account) }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      const body = await this.body(request);
      const username = normalizeUsername(body.username);
      const account = this.one("SELECT * FROM accounts WHERE username = ?", username);
      if (!account || (await hashPassword(String(body.password ?? ""), account.password_salt)) !== account.password_hash) {
        return apiError("Incorrect username or password.", 401);
      }
      const token = await this.newSession(username);
      return json({ ok: true, user: userForClient(account) }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (request.method === "POST" && pathname === "/api/auth/recover") {
      const body = await this.body(request);
      const username = normalizeUsername(body.username);
      const password = String(body.password ?? "");
      const account = this.one("SELECT * FROM accounts WHERE username = ?", username);
      if (!account || normalizeRecoveryKey(account.recovery_key) !== normalizeRecoveryKey(body.recoveryKey)) {
        return apiError("That username and recovery code do not match.", 401);
      }
      if (!validPassword(username, password)) return apiError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      const salt = randomToken(16);
      this.ctx.storage.sql.exec("UPDATE accounts SET password_salt = ?, password_hash = ? WHERE username = ?", salt, await hashPassword(password, salt), username);
      const token = await this.newSession(username);
      return json({ ok: true, user: userForClient(this.one("SELECT * FROM accounts WHERE username = ?", username)) }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      const session = await this.sessionFromRequest(request);
      if (session) this.ctx.storage.sql.exec("DELETE FROM sessions WHERE token_hash = ?", session.tokenHash);
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    }

    const session = await this.sessionFromRequest(request);
    if (!session) return this.unauthorized();
    const username = session.account.username;

    if (request.method === "POST" && pathname === "/api/auth/change-password") {
      const body = await this.body(request);
      if ((await hashPassword(String(body.currentPassword ?? ""), session.account.password_salt)) !== session.account.password_hash) {
        return apiError("Your current password is incorrect.", 401);
      }
      const password = String(body.nextPassword ?? "");
      if (!validPassword(username, password)) return apiError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      const salt = randomToken(16);
      this.ctx.storage.sql.exec("UPDATE accounts SET password_salt = ?, password_hash = ? WHERE username = ?", salt, await hashPassword(password, salt), username);
      return json({ ok: true, user: userForClient(this.one("SELECT * FROM accounts WHERE username = ?", username)) });
    }

    if (request.method === "POST" && pathname === "/api/auth/reset-demo") {
      if (username !== DEMO_USERNAME) return apiError("Only the demo account can be reset.", 403);
      const salt = randomToken(16);
      const now = Date.now();
      this.ctx.storage.sql.exec("DELETE FROM careers WHERE user_id = ?", DEMO_USERNAME);
      this.ctx.storage.sql.exec("DELETE FROM sessions WHERE username = ?", DEMO_USERNAME);
      this.ctx.storage.sql.exec(
        `UPDATE accounts SET password_salt = ?, password_hash = ?, recovery_key = ?,
          subscription_active = 1, subscription_started_at = ?, referral_code = ?, referred_by = NULL, referral_count = 0
         WHERE username = ?`,
        salt,
        await hashPassword(DEMO_PASSWORD, salt),
        DEMO_RECOVERY_KEY,
        now,
        "DEMO-GL",
        DEMO_USERNAME
      );
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    }

    if (request.method === "POST" && pathname === "/api/auth/subscribe") {
      // The product currently presents a transparent test purchase rather
      // than collecting payment data. The entitlement is still persisted on
      // the server, never in browser storage.
      const now = Date.now();
      this.ctx.storage.sql.exec("UPDATE accounts SET subscription_active = 1, subscription_started_at = ? WHERE username = ?", now, username);
      return json({ ok: true, user: userForClient(this.one("SELECT * FROM accounts WHERE username = ?", username)) });
    }

    if (request.method === "POST" && pathname === "/api/auth/cancel-subscription") {
      this.ctx.storage.sql.exec("UPDATE accounts SET subscription_active = 0 WHERE username = ?", username);
      return json({ ok: true, user: userForClient(this.one("SELECT * FROM accounts WHERE username = ?", username)) });
    }

    if (request.method === "DELETE" && pathname === "/api/auth/account") {
      this.ctx.storage.sql.exec("DELETE FROM careers WHERE user_id = ?", username);
      this.ctx.storage.sql.exec("DELETE FROM sessions WHERE username = ?", username);
      this.ctx.storage.sql.exec("DELETE FROM accounts WHERE username = ?", username);
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
    }

    if (request.method === "GET" && pathname === "/api/account/export") {
      const careers = this.all("SELECT state_json FROM careers WHERE user_id = ? ORDER BY updated_at DESC", username)
        .flatMap((row) => {
          try { return [JSON.parse(row.state_json)]; } catch { return []; }
        });
      const { password_salt: _salt, password_hash: _hash, recovery_key: _recovery, ...account } = session.account;
      return json({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        storage: "cloudflare-durable-object",
        account: userForClient({ ...account, recovery_key: "" }),
        careers,
      });
    }

    if (request.method === "GET" && pathname === "/api/careers") {
      const careers = this.all("SELECT id, state_json, updated_at FROM careers WHERE user_id = ? ORDER BY updated_at DESC", username)
        .flatMap((row) => {
          try { return [{ id: row.id, state: JSON.parse(row.state_json), updatedAt: Number(row.updated_at) }]; } catch { return []; }
        });
      return json({ ok: true, careers });
    }

    const careerMatch = pathname.match(/^\/api\/careers\/([a-zA-Z0-9_-]{1,100})$/);
    if (careerMatch) {
      const careerId = careerMatch[1];
      if (request.method === "GET") {
        const row = this.one("SELECT state_json FROM careers WHERE id = ? AND user_id = ?", careerId, username);
        if (!row) return json({ ok: true, state: null });
        try { return json({ ok: true, state: JSON.parse(row.state_json) }); } catch { return apiError("This career save is invalid.", 500); }
      }
      if (request.method === "PUT") {
        const body = await this.body(request);
        const state = body.state;
        if (!state || state.id !== careerId) return apiError("Career payload does not match its save id.");
        const stateJson = JSON.stringify(state);
        if (new TextEncoder().encode(stateJson).byteLength > MAX_CAREER_BYTES) return apiError("This career save is too large.", 413);
        this.ctx.storage.sql.exec(
          `INSERT INTO careers (id, user_id, state_json, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             state_json = CASE WHEN careers.user_id = excluded.user_id THEN excluded.state_json ELSE careers.state_json END,
             updated_at = CASE WHEN careers.user_id = excluded.user_id THEN excluded.updated_at ELSE careers.updated_at END`,
          careerId,
          username,
          stateJson,
          Date.now()
        );
        return json({ ok: true });
      }
      if (request.method === "DELETE") {
        this.ctx.storage.sql.exec("DELETE FROM careers WHERE id = ? AND user_id = ?", careerId, username);
        return json({ ok: true });
      }
    }

    return apiError("Unknown API route.", 404);
  }

  createRecoveryKey() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const fragment = Array.from(bytes, (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length]).join("");
    return `GL-${fragment}`;
  }

  async availableReferralCode(username) {
    const base = username.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "PLYR";
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const bytes = new Uint8Array(3);
      crypto.getRandomValues(bytes);
      const suffix = Array.from(bytes, (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length]).join("");
      const code = `${base}-${suffix}`;
      if (!this.one("SELECT username FROM accounts WHERE referral_code = ?", code)) return code;
    }
    return `${base}-${randomToken(4)}`.toUpperCase();
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/healthz") {
      const id = env.ACCOUNT_STORE.idFromName("gridiron-life-account-store-v1");
      const probeUrl = new URL(request.url);
      probeUrl.pathname = "/api/auth/session";
      try {
        return await env.ACCOUNT_STORE.get(id).fetch(new Request(probeUrl, { method: "GET", headers: request.headers }));
      } catch (error) {
        return json({ ok: false, error: String(error?.stack ?? error) }, 500);
      }
    }
    if (pathname.startsWith("/api/")) {
      const id = env.ACCOUNT_STORE.idFromName("gridiron-life-account-store-v1");
      try {
        return await env.ACCOUNT_STORE.get(id).fetch(request);
      } catch (error) {
        // Retained only while wiring the first production release: a Durable
        // Object exception otherwise becomes an opaque 1101 with no way to
        // inspect it from this restricted local environment.
        return json({ ok: false, error: String(error?.stack ?? error) }, 500);
      }
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    const contentType = headers.get("content-type") ?? "";

    if (contentType.includes("text/html")) {
      headers.set("Cache-Control", "no-cache");
    } else if (pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\.(?:png|webm|svg|webmanifest)$/i.test(pathname)) {
      headers.set("Cache-Control", "public,max-age=604800");
    }

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
