import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { getGameDayObjective, isGameDayObjectiveComplete, objectiveProgress } from "../gameObjectives";
import { emptyStatLine } from "../types";

describe("game day objectives", () => {
  it("creates a position-specific quarterback mission with bounded progress", () => {
    const mission = getGameDayObjective("QB", 0);
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

  it("gives every MVP-depth position a distinct three-week objective rotation", () => {
    const positions = ["QB", "RB", "WR", "TE", "LB", "CB"] as const;
    const ids = positions.flatMap((position) => [0, 1, 2].map((week) => getGameDayObjective(position, week).id));

    assert.equal(new Set(ids).size, ids.length, "objectives should not be silently shared between MVP positions");
    assert.deepEqual(
      [getGameDayObjective("TE", 0).id, getGameDayObjective("TE", 1).id, getGameDayObjective("TE", 2).id],
      ["te_chain_mover", "te_red_zone", "te_edge"]
    );
    assert.deepEqual(
      [getGameDayObjective("CB", 0).id, getGameDayObjective("CB", 1).id, getGameDayObjective("CB", 2).id],
      ["cb_lockdown", "cb_takeaway", "cb_erasure"]
    );
  });
});
