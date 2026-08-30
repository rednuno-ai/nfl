import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_ACCOUNT_USERNAME, getSession, isDemoAccount, login, register, resetDemoAccount, seedDefaultAccounts } from "../auth";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });

beforeEach(async () => {
  storage.clear();
  await seedDefaultAccounts();
});

describe("demo account reset", () => {
  it("is available only to the seeded demo account", async () => {
    assert.equal(isDemoAccount(DEMO_ACCOUNT_USERNAME), true);
    assert.equal(isDemoAccount("player-one"), false);
    assert.deepEqual(await resetDemoAccount("player-one"), { ok: false, error: "Only the demo account can be reset." });
  });

  it("removes only demo careers and leaves a normal account intact", async () => {
    const normalRegistration = await register("player-one", "safe-password");
    assert.equal(normalRegistration.ok, true);
    storage.setItem("nfl-life:index:adm", JSON.stringify(["demo-career"]));
    storage.setItem("nfl-life:career:demo-career", "demo-state");
    storage.setItem("nfl-life:career-updated:demo-career", "1");
    storage.setItem("nfl-life:index:player-one", JSON.stringify(["normal-career"]));
    storage.setItem("nfl-life:career:normal-career", "normal-state");

    const result = await resetDemoAccount(DEMO_ACCOUNT_USERNAME);
    assert.deepEqual(result, { ok: true });
    assert.equal(getSession(), null, "reset signs out so the clean demo is deliberately re-entered");
    assert.equal(storage.getItem("nfl-life:index:adm"), null);
    assert.equal(storage.getItem("nfl-life:career:demo-career"), null);
    assert.equal(storage.getItem("nfl-life:index:player-one"), JSON.stringify(["normal-career"]));
    assert.equal(storage.getItem("nfl-life:career:normal-career"), "normal-state");
    assert.equal((await login("player-one", "safe-password")).ok, true, "normal credentials stay usable");
  });
});
