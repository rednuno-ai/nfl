import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { generatePerformanceNews, generateControversyNews, generateSocialPost } from "../news";
import { RNG } from "../rng";

describe("news", () => {
  describe("generatePerformanceNews", () => {
    it("tags a strong performance as positive news", () => {
      // rng.next() > 0.15 branch is skipped because |score| >= 0.35, so this is deterministic.
      const item = generatePerformanceNews(3, "Reed", "The Comets", 0.8, new RNG(1));
      assert.ok(item);
      assert.equal(item!.tone, "positive");
      assert.ok(item!.headline.includes("Reed"));
      assert.equal(item!.requiresResponse, false, "positive news should never require a response");
    });

    it("tags a poor performance as negative news", () => {
      const item = generatePerformanceNews(3, "Reed", "The Comets", -0.8, new RNG(1));
      assert.ok(item);
      assert.equal(item!.tone, "negative");
    });

    it("builds ids from (prefix, week, call counter) instead of Date.now(), so ids stay reproducible across replays", () => {
      const item = generatePerformanceNews(5, "Reed", "The Comets", 0.9, new RNG(1))!;
      assert.match(item.id, /^news_5_\d+$/, `id "${item.id}" should be news_<week>_<counter>, not wall-clock-based`);
    });

    it("can produce a mediocre-performance story only on the low-probability neutral-news roll", () => {
      // score below the 0.35 threshold: only produced when rng.next() <= 0.15 on the first roll.
      let sawNull = false;
      let sawNeutral = false;
      for (let seed = 1; seed <= 50; seed++) {
        const item = generatePerformanceNews(1, "Reed", "The Comets", 0.1, new RNG(seed));
        if (item === null) sawNull = true;
        else {
          assert.equal(item.tone, "neutral");
          sawNeutral = true;
        }
      }
      assert.ok(sawNull, "most mediocre performances should produce no news");
      assert.ok(sawNeutral, "some mediocre performances should still sneak through as neutral news");
    });
  });

  it("generateControversyNews always requires a response", () => {
    const item = generateControversyNews(2, "Reed", new RNG(1));
    assert.equal(item.tone, "controversial");
    assert.equal(item.requiresResponse, true);
    assert.ok(item.headline.includes("Reed"));
  });

  describe("generateSocialPost", () => {
    it("produces 1-3 comments and a like count within bounds", () => {
      for (let seed = 1; seed <= 20; seed++) {
        const post = generateSocialPost(1, "positive", new RNG(seed));
        assert.ok(post.comments.length >= 1 && post.comments.length <= 3);
        assert.ok(post.likes >= 0 && post.likes < 5000);
        assert.equal(post.tone, "positive");
      }
    });

    it("pulls from the tone-appropriate comment pool", () => {
      const positive = generateSocialPost(1, "positive", new RNG(2));
      const negative = generateSocialPost(1, "negative", new RNG(2));
      assert.notEqual(positive.body, negative.body, "positive/negative bodies come from disjoint pools");
    });
  });
});
