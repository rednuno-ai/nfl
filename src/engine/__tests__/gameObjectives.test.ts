import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getGameDayObjective, isGameDayObjectiveComplete, objectiveProgress } from "../gameObjectives";
import { emptyStatLine } from "../types";

describe("game day objectives", () => {
  it("creates a position-specific quarterback mission with bounded progress", () => {
    const mission = getGameDayObjective("QB", 2);
    const stat = { ...emptyStatLine(2026, "nfl", "team"), passCompletions: 20 };
    assert.equal(mission.id, "qb_precision");
    assert.equal(objectiveProgress(mission, stat), mission.target);
    assert.equal(isGameDayObjectiveComplete(mission, stat, "win"), true);
  });

  it("only completes a team-finish mission after a win", () => {
    const mission = getGameDayObjective("OL", 1);
    const stat = emptyStatLine(2026, "nfl", "team");
    assert.equal(mission.id, "team_finish");
    assert.equal(isGameDayObjectiveComplete(mission, stat, "loss"), false);
    assert.equal(isGameDayObjectiveComplete(mission, stat, "win"), true);
  });
});
