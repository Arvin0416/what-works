import { asc, eq } from "drizzle-orm";
import {
  VideoRecommendationSchema,
  type VideoRecommendation,
} from "../../content/types";
import type { DatabaseExecutor } from "../client";
import { videoRecommendations } from "../schema";

export async function insertVideoRecommendations(
  db: DatabaseExecutor,
  versionId: string,
  videos: VideoRecommendation[],
): Promise<void> {
  if (videos.length === 0) {
    return;
  }

  await db.insert(videoRecommendations).values(
    videos.map((video) => ({
      versionId,
      videoId: video.videoId,
      title: video.title,
      channelId: video.channelId,
      channelName: video.channelName,
      thumbnailUrl: video.thumbnailUrl,
      watchUrl: video.watchUrl,
      durationSeconds: video.durationSeconds,
      topicId: video.topicId,
      source: video.source,
    })),
  );
}

export async function getVideosForVersion(
  db: DatabaseExecutor,
  versionId: string,
): Promise<VideoRecommendation[]> {
  const rows = await db
    .select()
    .from(videoRecommendations)
    .where(eq(videoRecommendations.versionId, versionId))
    .orderBy(asc(videoRecommendations.createdAt));

  return rows.map((row) =>
    VideoRecommendationSchema.parse({
      videoId: row.videoId,
      title: row.title,
      channelId: row.channelId,
      channelName: row.channelName,
      thumbnailUrl: row.thumbnailUrl,
      watchUrl: row.watchUrl,
      durationSeconds: row.durationSeconds,
      topicId: row.topicId,
      source: row.source,
    }),
  );
}
