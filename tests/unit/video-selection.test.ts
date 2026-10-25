import { describe, expect, it } from "vitest";

import { selectVideoRecommendations } from "../../lib/content/video-selection";
import type { VideoRecommendation } from "../../lib/content/types";

function video(
  videoId: string,
  channelId: string,
  overrides: Partial<VideoRecommendation> = {},
): VideoRecommendation {
  return {
    videoId,
    title: `Video ${videoId}`,
    channelId,
    channelName: `Channel ${channelId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    durationSeconds: 120,
    topicId: "anxiety",
    source: "youtube",
    ...overrides,
  };
}

describe("selectVideoRecommendations", () => {
  it("deduplicates videos, filters unusable results, and keeps channel diversity", () => {
    const selected = selectVideoRecommendations(
      [
        video("a-1", "channel-a"),
        video("a-1", "channel-a", { title: "Duplicate" }),
        video("a-2", "channel-a"),
        video("b-1", "channel-b"),
        video("empty-title", "channel-b", { title: "   " }),
        video("missing-thumbnail", "channel-c", { thumbnailUrl: "" }),
        video("c-1", "channel-c"),
        video("d-1", "channel-d"),
        video("e-1", "channel-e"),
      ],
      10,
    );

    expect(selected).toHaveLength(4);
    expect(selected.map((item) => item.videoId)).toEqual([
      "a-1",
      "b-1",
      "a-2",
      "c-1",
    ]);
    expect(new Set(selected.map((item) => item.channelId)).size).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("returns fewer than the requested limit when only valid videos are available", () => {
    const selected = selectVideoRecommendations(
      [video("a-1", "channel-a"), video("a-2", "channel-a")],
      4,
    );

    expect(selected.map((item) => item.videoId)).toEqual(["a-1", "a-2"]);
  });

  it("returns no results for a non-positive limit", () => {
    expect(selectVideoRecommendations([video("a-1", "channel-a")], 0)).toEqual(
      [],
    );
    expect(selectVideoRecommendations([video("a-1", "channel-a")], -1)).toEqual(
      [],
    );
  });
});
