import type { VideoRecommendation } from "./types";

const MAX_VIDEO_RECOMMENDATIONS = 4;

type VideoSelectionCandidate = VideoRecommendation & {
  isLive?: boolean;
  liveBroadcastContent?: string;
};

function isEligibleVideo(video: VideoRecommendation): boolean {
  const candidate = video as VideoSelectionCandidate;
  const videoId =
    typeof candidate.videoId === "string" ? candidate.videoId.trim() : "";
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const thumbnailUrl =
    typeof candidate.thumbnailUrl === "string"
      ? candidate.thumbnailUrl.trim()
      : "";
  const channelId =
    typeof candidate.channelId === "string" ? candidate.channelId.trim() : "";
  const channelName =
    typeof candidate.channelName === "string" ? candidate.channelName.trim() : "";

  if (!videoId || !title || !channelId || !channelName || !thumbnailUrl) {
    return false;
  }

  if (candidate.isLive === true) {
    return false;
  }

  const liveBroadcastContent =
    typeof candidate.liveBroadcastContent === "string"
      ? candidate.liveBroadcastContent.toLowerCase()
      : undefined;
  return (
    liveBroadcastContent !== "live" && liveBroadcastContent !== "upcoming"
  );
}

/**
 * Keep the most relevant candidates in their provider-supplied order while
 * ensuring duplicate IDs and unusable API results never reach content.
 */
export function selectVideoRecommendations(
  videos: VideoRecommendation[],
  limit: number,
): VideoRecommendation[] {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 0), MAX_VIDEO_RECOMMENDATIONS)
    : 0;

  if (normalizedLimit === 0) {
    return [];
  }

  const seenVideoIds = new Set<string>();
  const uniqueVideos = videos.filter((video) => {
    if (!isEligibleVideo(video)) {
      return false;
    }

    const videoId = video.videoId.trim();

    if (seenVideoIds.has(videoId)) {
      return false;
    }

    seenVideoIds.add(videoId);
    return true;
  });

  if (uniqueVideos.length <= normalizedLimit) {
    return uniqueVideos;
  }

  const selected: VideoRecommendation[] = [uniqueVideos[0]];

  if (normalizedLimit > 1) {
    const firstChannelId = uniqueVideos[0].channelId;
    const differentChannelVideo = uniqueVideos.find(
      (video) => video.channelId !== firstChannelId,
    );

    if (differentChannelVideo) {
      selected.push(differentChannelVideo);
    }
  }

  for (const video of uniqueVideos) {
    if (selected.length >= normalizedLimit) {
      break;
    }

    if (!selected.includes(video)) {
      selected.push(video);
    }
  }

  return selected;
}

export { MAX_VIDEO_RECOMMENDATIONS };
