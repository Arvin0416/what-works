import type { ApprovedChannel, Topic, VideoRecommendation } from "../content/types";
import {
  getYouTubeVideoId,
  isLiveYouTubeBroadcast,
  mapYouTubeVideo,
  YouTubeMappingError,
  type YouTubeVideoApiItem,
} from "./youtube-mappers";
import { selectVideoRecommendations } from "../content/video-selection";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const SEARCH_MAX_RESULTS = 5;
const RECOMMENDATION_LIMIT = 4;

export type YouTubeIntegrationErrorCode =
  | "MISSING_YOUTUBE_API_KEY"
  | "NETWORK_ERROR"
  | "API_REQUEST_FAILED"
  | "INVALID_API_RESPONSE";

export class YouTubeIntegrationError extends Error {
  readonly code: YouTubeIntegrationErrorCode;
  readonly status?: number;

  constructor(
    code: YouTubeIntegrationErrorCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "YouTubeIntegrationError";
    this.code = code;
    this.status = status;
  }
}

export type YouTubeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SearchApprovedVideosInput = {
  topic: Topic;
  channels: readonly ApprovedChannel[];
  fetchImpl?: YouTubeFetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isYouTubeVideoApiItem(value: unknown): value is YouTubeVideoApiItem {
  if (!isRecord(value) || !isRecord(value.snippet)) {
    return false;
  }

  if (!("id" in value)) {
    return false;
  }

  return (
    typeof value.id === "string" ||
    (isRecord(value.id) && typeof value.id.videoId === "string")
  );
}

function getItems(payload: unknown, requestName: string): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new YouTubeIntegrationError(
      "INVALID_API_RESPONSE",
      `YouTube ${requestName} response did not contain an items array`,
    );
  }

  return payload.items;
}

function getApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    throw new YouTubeIntegrationError(
      "MISSING_YOUTUBE_API_KEY",
      "YOUTUBE_API_KEY is required for YouTube discovery",
    );
  }

  return apiKey;
}

function createApiUrl(
  endpoint: "search" | "videos",
  params: Record<string, string>,
): string {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function fetchApiJson(
  fetchImpl: YouTubeFetch,
  url: string,
  requestName: string,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch {
    throw new YouTubeIntegrationError(
      "NETWORK_ERROR",
      `YouTube ${requestName} request failed`,
    );
  }

  if (!response.ok) {
    throw new YouTubeIntegrationError(
      "API_REQUEST_FAILED",
      `YouTube ${requestName} request returned HTTP ${response.status}`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new YouTubeIntegrationError(
      "INVALID_API_RESPONSE",
      `YouTube ${requestName} response was not valid JSON`,
    );
  }
}

function mergeSearchAndDetails(
  searchItem: YouTubeVideoApiItem,
  detailItem: YouTubeVideoApiItem,
): YouTubeVideoApiItem {
  const searchThumbnails = searchItem.snippet.thumbnails;
  const detailThumbnails = detailItem.snippet.thumbnails;

  return {
    ...searchItem,
    ...detailItem,
    snippet: {
      ...searchItem.snippet,
      ...detailItem.snippet,
      channelId:
        detailItem.snippet.channelId ?? searchItem.snippet.channelId,
      channelTitle:
        detailItem.snippet.channelTitle ?? searchItem.snippet.channelTitle,
      title: detailItem.snippet.title ?? searchItem.snippet.title,
      liveBroadcastContent:
        detailItem.snippet.liveBroadcastContent ??
        searchItem.snippet.liveBroadcastContent,
      thumbnails: {
        ...searchThumbnails,
        ...detailThumbnails,
      },
    },
    contentDetails: {
      ...searchItem.contentDetails,
      ...detailItem.contentDetails,
    },
  };
}

/**
 * Discover only videos returned for the configured active channel IDs. The
 * API responses remain untrusted until the channel and video fields are
 * checked, mapped, and passed through the shared selection boundary.
 */
export async function searchApprovedVideos({
  topic,
  channels,
  fetchImpl = globalThis.fetch,
}: SearchApprovedVideosInput): Promise<VideoRecommendation[]> {
  const apiKey = getApiKey();
  const activeChannels = channels.filter((channel) => channel.active);
  const approvedChannelIds = new Set(activeChannels.map((channel) => channel.id));
  const searchItemsByVideoId = new Map<string, YouTubeVideoApiItem>();

  for (const channel of activeChannels) {
    const searchUrl = createApiUrl("search", {
      part: "snippet",
      type: "video",
      channelId: channel.id,
      q: topic.label,
      order: "relevance",
      maxResults: String(SEARCH_MAX_RESULTS),
      key: apiKey,
    });
    const payload = await fetchApiJson(fetchImpl, searchUrl, "search.list");

    for (const value of getItems(payload, "search.list")) {
      if (!isYouTubeVideoApiItem(value)) {
        continue;
      }

      const videoId = getYouTubeVideoId(value.id);
      const channelId =
        typeof value.snippet.channelId === "string"
          ? value.snippet.channelId.trim()
          : "";

      if (
        !videoId ||
        !channelId ||
        !approvedChannelIds.has(channelId) ||
        isLiveYouTubeBroadcast(value)
      ) {
        continue;
      }

      if (!searchItemsByVideoId.has(videoId)) {
        searchItemsByVideoId.set(videoId, value);
      }
    }
  }

  if (searchItemsByVideoId.size === 0) {
    return [];
  }

  const detailUrl = createApiUrl("videos", {
    part: "snippet,contentDetails",
    id: [...searchItemsByVideoId.keys()].join(","),
    key: apiKey,
  });
  const detailPayload = await fetchApiJson(fetchImpl, detailUrl, "videos.list");
  const detailItemsByVideoId = new Map<string, YouTubeVideoApiItem>();

  for (const value of getItems(detailPayload, "videos.list")) {
    if (!isYouTubeVideoApiItem(value)) {
      continue;
    }

    const videoId = getYouTubeVideoId(value.id);

    if (videoId) {
      detailItemsByVideoId.set(videoId, value);
    }
  }

  const mappedVideos: VideoRecommendation[] = [];

  for (const [videoId, searchItem] of searchItemsByVideoId) {
    const detailItem = detailItemsByVideoId.get(videoId);

    if (!detailItem) {
      continue;
    }

    const mergedItem = mergeSearchAndDetails(searchItem, detailItem);
    const detailChannelId =
      typeof mergedItem.snippet.channelId === "string"
        ? mergedItem.snippet.channelId.trim()
        : "";

    if (
      !detailChannelId ||
      !approvedChannelIds.has(detailChannelId) ||
      typeof mergedItem.snippet.title !== "string" ||
      !mergedItem.snippet.title.trim() ||
      typeof mergedItem.snippet.channelTitle !== "string" ||
      !mergedItem.snippet.channelTitle.trim() ||
      !mergedItem.snippet.thumbnails ||
      !Object.values(mergedItem.snippet.thumbnails).some(
        (thumbnail) =>
          typeof thumbnail?.url === "string" && thumbnail.url.trim(),
      ) ||
      isLiveYouTubeBroadcast(mergedItem)
    ) {
      continue;
    }

    try {
      mappedVideos.push(mapYouTubeVideo(mergedItem, topic.id));
    } catch (error) {
      if (error instanceof YouTubeMappingError) {
        continue;
      }

      throw error;
    }
  }

  return selectVideoRecommendations(mappedVideos, RECOMMENDATION_LIMIT);
}

export {
  canonicalYouTubeWatchUrl,
  parseIso8601Duration,
  parseIsoDuration,
  parseYouTubeDuration,
  mapYouTubeVideo,
} from "./youtube-mappers";

export type {
  YouTubeThumbnail,
  YouTubeVideoApiId,
  YouTubeVideoApiItem,
  YouTubeVideoApiSnippet,
} from "./youtube-mappers";
