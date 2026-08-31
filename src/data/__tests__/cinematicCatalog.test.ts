import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { CINEMATIC_BEATS, cinematicForDecision, cinematicForGameResult, cinematicForGameStart, cinematicForTraining } from "../cinematicCatalog";

describe("cinematic catalogue", () => {
  it("contains thirty original career moments with unique ids", () => {
    assert.equal(CINEMATIC_BEATS.length, 30);
    assert.equal(new Set(CINEMATIC_BEATS.map((beat) => beat.id)).size, 30);
  });

  it("connects meaningful game, training and narrative triggers to a cinematic", () => {
    assert.equal(cinematicForTraining("position_specific")?.scene, "training");
    assert.equal(cinematicForGameStart(true)?.scene, "tunnel");
    assert.equal(cinematicForGameResult("win")?.scene, "team");
    assert.equal(cinematicForDecision("draft_night_call")?.scene, "draft");
    assert.equal(cinematicForDecision("media_podcast_invite")?.scene, "interview");
  });
});
