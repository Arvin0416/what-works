import type { VideoRecommendation } from "../content/types";

export type YouTubeThumbnail = {
  url?: string;
  width?: number;
  height?: number;
};

export type YouTubeVideoApiId =
  | string
  | {
      kind?: string;
      videoId?: string;
    };

export type YouTubeVideoApiSnippet = {
  channelId?: string;
  channelTitle?: string;
  description?: string;
  liveBroadcastContent?: string;
  publishedAt?: string;
  title?: string;
  thumbnails?: {
    default?: YouTubeThumbnail;
    medium?: YouTubeThumbnail;
    high?: YouTubeThumbnail;
    standard?: YouTubeThumbnail;
    maxres?: YouTubeThumbnail;
  };
};

export type YouTubeVideoApiItem = {
  id: YouTubeVideoApiId;
  snippet: YouTubeVideoApiSnippet;
  contentDetails?: {
    duration?: string;
  };
};

export class YouTubeMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeMappingError";
  }
}

/**
 * Convert a YouTube ISO 8601 duration to whole seconds. YouTube normally
 * returns hours, minutes, and seconds, but days are accepted as valid ISO
 * duration components as well. Invalid or absent durations are represented
 * by null so callers can keep the optional duration contract.
 */
export function parseIso8601Duration(duration: string | undefined): number | null {
  if (!duration) {
    return null;
  }

  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      duration,
    );

  if (
    !match ||
    ![match[1], match[2], match[3], match[4]].some((component) => component)
  ) {
    return null;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);

  if (![days, hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return Math.round(days * 86_400 + hours * 3_600 + minutes * 60 + seconds);
}

export const parseYouTubeDuration = parseIso8601Duration;
export const parseIsoDuration = parseIso8601Duration;

export function getYouTubeVideoId(id: YouTubeVideoApiId): string | null {
  if (typeof id === "string") {
    const videoId = id.trim();
    return videoId || null;
  }

  const videoId = typeof id.videoId === "string" ? id.videoId.trim() : "";
  return videoId || null;
}

export function getYouTubeThumbnailUrl(
  thumbnails: YouTubeVideoApiSnippet["thumbnails"],
): string {
  const candidates = [
    thumbnails?.maxres,
    thumbnails?.standard,
    thumbnails?.high,
    thumbnails?.medium,
    thumbnails?.default,
  ];

  for (const thumbnail of candidates) {
    const url = typeof thumbnail?.url === "string" ? thumbnail.url.trim() : "";

    if (url) {
      return url;
    }
  }

  return "";
}

export function isLiveYouTubeBroadcast(
  item: Pick<YouTubeVideoApiItem, "snippet">,
): boolean {
  const liveBroadcastContent =
    typeof item.snippet.liveBroadcastContent === "string"
      ? item.snippet.liveBroadcastContent.toLowerCase()
      : undefined;

  return (
    liveBroadcastContent === "live" || liveBroadcastContent === "upcoming"
  );
}

export function canonicalYouTubeWatchUrl(videoId: string): string {
  const normalizedVideoId = videoId.trim();

  if (!normalizedVideoId) {
    throw new YouTubeMappingError("A YouTube video ID is required");
  }

  return `https://www.youtube.com/watch?v=${encodeURIComponent(normalizedVideoId)}`;
}

export function mapYouTubeVideo(
  item: YouTubeVideoApiItem,
  topicId: string,
): VideoRecommendation {
  const videoId = getYouTubeVideoId(item.id);
  const title =
    typeof item.snippet.title === "string" ? item.snippet.title.trim() : "";
  const channelId =
    typeof item.snippet.channelId === "string"
      ? item.snippet.channelId.trim()
      : "";
  const channelName =
    typeof item.snippet.channelTitle === "string"
      ? item.snippet.channelTitle.trim()
      : "";

  if (!videoId) {
    throw new YouTubeMappingError("YouTube video data is missing a video ID");
  }

  if (!title) {
    throw new YouTubeMappingError("YouTube video data is missing a title");
  }

  if (!channelId) {
    throw new YouTubeMappingError(
      "YouTube video data is missing a channel ID",
    );
  }

  if (!channelName) {
    throw new YouTubeMappingError(
      "YouTube video data is missing a channel name",
    );
  }

  if (isLiveYouTubeBroadcast(item)) {
    throw new YouTubeMappingError("Live YouTube broadcasts are not eligible");
  }

  if (!topicId.trim()) {
    throw new YouTubeMappingError("A topic ID is required for a video");
  }

  return {
    videoId,
    title,
    channelId,
    channelName,
    thumbnailUrl: getYouTubeThumbnailUrl(item.snippet.thumbnails),
    watchUrl: canonicalYouTubeWatchUrl(videoId),
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration),
    topicId: topicId.trim(),
    source: "youtube",
  };
}
