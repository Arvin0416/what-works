import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { seedArticle } from "../../lib/content/seed";
import {
  validateArticleContent,
  VideoRecommendationSchema,
} from "../../lib/content/validation";

describe("content validation", () => {
  it("parses the seeded article content", () => {
    expect(validateArticleContent(seedArticle.content)).toEqual(
      seedArticle.content,
    );
  });

  it("reports a field path when the title is missing", () => {
    const contentWithoutTitle = {
      ...seedArticle.content,
    } as Record<string, unknown>;
    delete contentWithoutTitle.title;

    expect(() => validateArticleContent(contentWithoutTitle)).toThrow(
      ZodError,
    );

    try {
      validateArticleContent(contentWithoutTitle);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["title"] }),
        ]),
      );
    }
  });

  it("rejects an article without Scripture references", () => {
    expect(() =>
      validateArticleContent({
        ...seedArticle.content,
        scriptureRefs: [],
      }),
    ).toThrow(ZodError);
  });

  it("rejects a non-YouTube watch URL", () => {
    expect(() =>
      VideoRecommendationSchema.parse({
        ...seedArticle.videos[0],
        watchUrl: "https://example.com/watch/seed-prayer-01",
      }),
    ).toThrow(ZodError);
  });

  it("rejects a video with an empty channel name", () => {
    expect(() =>
      VideoRecommendationSchema.parse({
        ...seedArticle.videos[0],
        channelName: "",
      }),
    ).toThrow(ZodError);
  });
});
