import { describe, expect, it } from "vitest";
import { validateRegistrationInput } from "../authValidation";

describe("registration input guidance", () => {
  it("accepts a valid new player account", () => {
    expect(validateRegistrationInput("Jordan_23", "eight-plus", "adm")).toEqual({ username: null, password: null, valid: true });
  });

  it("explains invalid usernames before a request is made", () => {
    expect(validateRegistrationInput("A", "eight-plus", "adm").username).toContain("2–31");
    expect(validateRegistrationInput("Jordan Smith", "eight-plus", "adm").username).toContain("2–31");
  });

  it("keeps the public demo username unavailable for registration", () => {
    expect(validateRegistrationInput("ADM", "eight-plus", "adm").username).toContain("reserved");
  });

  it("explains password length failures", () => {
    expect(validateRegistrationInput("player-one", "short", "adm").password).toContain("at least 8");
    expect(validateRegistrationInput("player-one", "x".repeat(129), "adm").password).toContain("no more than 128");
  });
});
