import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalYouTubeWatchUrl,
  mapYouTubeVideo,
  parseIso8601Duration,
  type YouTubeVideoApiItem,
} from "../../lib/research/youtube-mappers";
import {
  searchApprovedVideos,
} from "../../lib/research/youtube";
import type { ApprovedChannel, Topic } from "../../lib/content/types";

const topic: Topic = {
  id: "anxiety",
  label: "Anxiety",
  prompt: "How can Christians respond to anxiety?",
  categoryId: "anxiety",
};

const channels: ApprovedChannel[] = [
  {
    id: "channel-approved",
    name: "Approved Channel",
    handle: "@approved",
    canonicalUrl: "https://www.youtube.com/@approved",
    active: true,
  },
];

function videoItem(
  overrides: Partial<YouTubeVideoApiItem> = {},
): YouTubeVideoApiItem {
  return {
    id: "video-123",
    snippet: {
      title: "A faithful next step",
      channelId: "channel-approved",
      channelTitle: "Approved Channel",
      liveBroadcastContent: "none",
      thumbnails: {
        high: {
          url: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
    },
    contentDetails: {
      duration: "PT1H2M3S",
    },
    ...overrides,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("YouTube mappers", () => {
  it("maps API metadata to a canonical video recommendation", () => {
    const mapped = mapYouTubeVideo(videoItem(), topic.id);

    expect(mapped).toEqual({
      videoId: "video-123",
      title: "A faithful next step",
      channelId: "channel-approved",
      channelName: "Approved Channel",
      thumbnailUrl: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=video-123",
      durationSeconds: 3_723,
      topicId: "anxiety",
      source: "youtube",
    });
  });

  it("parses YouTube ISO 8601 durations and rejects invalid values", () => {
    expect(parseIso8601Duration("PT15M42S")).toBe(942);
    expect(parseIso8601Duration("P1DT1H")).toBe(90_000);
    expect(parseIso8601Duration("PT0S")).toBe(0);
    expect(parseIso8601Duration("not-a-duration")).toBeNull();
    expect(parseIso8601Duration(undefined)).toBeNull();
  });

  it("creates the canonical watch URL from a video ID", () => {
    expect(canonicalYouTubeWatchUrl("abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123",
    );
  });

  it("requires a non-empty title while mapping untrusted API data", () => {
    expect(() =>
      mapYouTubeVideo(
        videoItem({
          snippet: { ...videoItem().snippet, title: "   " },
        }),
        topic.id,
      ),
    ).toThrow("missing a title");
  });
});

describe("approved YouTube discovery", () => {
  it("filters unapproved and live search results before returning mapped videos", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            videoItem(),
            videoItem({
              id: "outside-video",
              snippet: {
                ...videoItem().snippet,
                channelId: "channel-outside",
              },
            }),
            videoItem({
              id: "live-video",
              snippet: {
                ...videoItem().snippet,
                liveBroadcastContent: "live",
              },
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [videoItem({ contentDetails: { duration: "PT9M" } })] }),
      );

    const result = await searchApprovedVideos({
      topic,
      channels,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      videoId: "video-123",
      durationSeconds: 540,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const searchRequest = String(fetchImpl.mock.calls[0][0]);
    expect(new URL(searchRequest).searchParams.get("channelId")).toBe(
      "channel-approved",
    );
    expect(new URL(searchRequest).searchParams.get("q")).toBe("Anxiety");
  });

  it("throws a typed error when the API key is absent", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");

    await expect(
      searchApprovedVideos({
        topic,
        channels,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      name: "YouTubeIntegrationError",
      code: "MISSING_YOUTUBE_API_KEY",
    });
  });
});
