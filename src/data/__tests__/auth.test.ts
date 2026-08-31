import { beforeEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { changePassword, DEMO_ACCOUNT_USERNAME, getSession, isDemoAccount, login, register, resetDemoAccount, seedDefaultAccounts } from "../auth";
import { createAccountExport } from "../accountExport";
import { LocalRepository } from "../localRepository";

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

describe("local account controls", () => {
  it("requires the current password before replacing it", async () => {
    assert.equal((await register("player-one", "safe-password")).ok, true);
    assert.equal((await changePassword("player-one", "wrong-password", "new-safe-password")).ok, false);
    assert.equal((await changePassword("player-one", "safe-password", "new-safe-password")).ok, true);
    assert.equal((await login("player-one", "safe-password")).ok, false);
    assert.equal((await login("player-one", "new-safe-password")).ok, true);
  });

  it("exports player data without credential material", async () => {
    assert.equal((await register("player-one", "safe-password")).ok, true);
    storage.setItem("nfl-life:index:player-one", JSON.stringify(["normal-career"]));
    storage.setItem("nfl-life:career:normal-career", JSON.stringify({ id: "normal-career", player: { bio: { firstName: "Player" } } }));

    const exported = await createAccountExport("player-one");
    assert.ok(exported);
    const parsed = JSON.parse(exported!);
    assert.equal(parsed.account.username, "player-one");
    assert.equal(parsed.careers.length, 1);
    assert.equal("passwordHash" in parsed.account, false);
    assert.equal("salt" in parsed.account, false);
    assert.equal("recoveryKey" in parsed.account, false);
  });

  it("does not load or delete a career outside the signed-in account index", async () => {
    const repository = new LocalRepository();
    storage.setItem("nfl-life:index:player-one", JSON.stringify(["owned-career"]));
    storage.setItem("nfl-life:career:owned-career", JSON.stringify({ id: "owned-career" }));

    assert.equal(await repository.loadCareer("player-two", "owned-career"), null);
    await repository.deleteCareer("player-two", "owned-career");
    assert.equal(storage.getItem("nfl-life:career:owned-career"), JSON.stringify({ id: "owned-career" }));
  });
});
