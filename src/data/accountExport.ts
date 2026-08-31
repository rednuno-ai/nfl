import type { CareerState } from "@engine/career";
import { getCurrentUser } from "./auth";

const INDEX_KEY = (username: string) => `nfl-life:index:${username}`;
const CAREER_KEY = (careerId: string) => `nfl-life:career:${careerId}`;

function safeCareerIds(username: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY(username)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function safeCareer(careerId: string): CareerState | null {
  try {
    return JSON.parse(localStorage.getItem(CAREER_KEY(careerId)) ?? "null") as CareerState | null;
  } catch {
    return null;
  }
}

/** Creates a portable copy of the signed-in player's local data. Credentials,
 * password hashes, salts and recovery keys are intentionally never exported. */
export function createAccountExport(username: string): string | null {
  const user = getCurrentUser();
  if (!user || user.username !== username) return null;
  const { passwordHash: _passwordHash, salt: _salt, recoveryKey: _recoveryKey, ...account } = user;
  const careers = safeCareerIds(username).map(safeCareer).filter((career): career is CareerState => career !== null);
  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      storage: "local-browser-only",
      account,
      careers,
    },
    null,
    2
  );
}
