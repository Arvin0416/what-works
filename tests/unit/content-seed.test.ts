import { describe, expect, it } from "vitest";

import { FAITH_CATEGORIES } from "../../lib/content/categories";
import { APPROVED_CHANNELS } from "../../lib/content/channels";
import {
  getSeedPublishedArticle,
  SEED_PUBLISHED_ARTICLE,
} from "../../lib/content/seed";
import { PublishedArticleSchema } from "../../lib/content/types";

describe("content seed", () => {
  it("is a publishable article with original, safety-aware content", () => {
    const article = getSeedPublishedArticle();

    expect(PublishedArticleSchema.parse(article)).toEqual(article);
    expect(article.status).toBe("published");
    expect(article.content.title).toBe(
      "What Works When You Feel Far From God",
    );
    expect(article.content.sections.length).toBeGreaterThanOrEqual(2);
    expect(article.content.scriptureRefs.length).toBeGreaterThan(0);
    expect(article.content.prayer.length).toBeGreaterThan(0);
    expect(article.content.safetyNote).toMatch(/not a substitute/i);
  });

  it("keeps seeded video records YouTube-only and ready for artwork fallback", () => {
    expect(SEED_PUBLISHED_ARTICLE.videos).toHaveLength(3);
    expect(
      SEED_PUBLISHED_ARTICLE.videos.every(
        (video) => video.thumbnailUrl === "",
      ),
    ).toBe(true);

    for (const video of SEED_PUBLISHED_ARTICLE.videos) {
      expect(video.source).toBe("youtube");
      expect(
        video.watchUrl.startsWith("https://www.youtube.com/") ||
          video.watchUrl.startsWith("https://youtu.be/"),
      ).toBe(true);
    }
  });

  it("defines the requested faith categories and approved source channels", () => {
    expect(FAITH_CATEGORIES.map((category) => category.id)).toEqual([
      "temptation",
      "family",
      "anxiety",
      "doubt",
      "loneliness",
      "forgiveness",
      "prayer",
      "spiritual-growth",
    ]);

    expect(APPROVED_CHANNELS.map((channel) => channel.name)).toEqual([
      "Pastor Vlad",
      "Victory",
      "Every Nation",
    ]);
    expect(APPROVED_CHANNELS.every((channel) => channel.active)).toBe(true);
    expect(
      APPROVED_CHANNELS.every((channel) =>
        channel.canonicalUrl.startsWith("https://www.youtube.com/"),
      ),
    ).toBe(true);
  });
});
