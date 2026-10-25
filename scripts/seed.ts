import { APPROVED_CHANNELS } from "../lib/content/channels";
import { seedArticle } from "../lib/content/seed";
import {
  closeDatabase,
  getDatabase,
  getDatabaseUrl,
} from "../lib/db/client";
import {
  articleVersions,
  articles,
  channelAllowlist,
  sourceCitations,
  videoRecommendations,
} from "../lib/db/schema";

const SEED_MODEL = "seed";
const SEED_PROMPT_VERSION = "task-9-seed-v1";
const SEED_VALIDATION_REPORT = {
  passed: true,
  warnings: [] as string[],
  blockedReasons: [] as string[],
};

/**
 * Seed the review database without activating unverified YouTube discovery.
 * Existing channel rows and the article slug are left untouched on reruns.
 */
async function seedDatabase(): Promise<{
  channels: number;
  article: "inserted" | "existing";
}> {
  const db = getDatabase();
  let articleResult: "inserted" | "existing" = "existing";

  await db.transaction(async (tx) => {
    await tx
      .insert(channelAllowlist)
      .values(
        APPROVED_CHANNELS.map((channel) => ({
          id: channel.id,
          name: channel.name,
          handle: channel.handle,
          canonicalUrl: channel.canonicalUrl,
          // The checked-in entries are a review allowlist, not proof that an
          // ID or handle has been verified for YouTube API discovery.
          active: false,
          notes:
            "Seeded inactive. Verify the official YouTube channel ID and handle before enabling discovery.",
        })),
      )
      .onConflictDoNothing({ target: channelAllowlist.id });

    const [article] = await tx
      .insert(articles)
      .values({
        slug: seedArticle.slug,
        title: seedArticle.content.title,
        categoryId: seedArticle.content.categoryId,
        status: "published",
        publishedAt: new Date(seedArticle.publishedAt),
      })
      .onConflictDoNothing({ target: articles.slug })
      .returning({ id: articles.id });

    if (!article) {
      return;
    }

    const [version] = await tx
      .insert(articleVersions)
      .values({
        articleId: article.id,
        status: "published",
        content: seedArticle.content,
        validationReport: SEED_VALIDATION_REPORT,
        model: SEED_MODEL,
        promptVersion: SEED_PROMPT_VERSION,
        publishedAt: new Date(seedArticle.publishedAt),
      })
      .returning({ id: articleVersions.id });

    if (!version) {
      throw new Error("The initial seed article version could not be created.");
    }

    if (seedArticle.sources.length > 0) {
      await tx.insert(sourceCitations).values(
        seedArticle.sources.map((source) => ({
          versionId: version.id,
          url: source.url,
          title: source.title,
          publisher: source.publisher,
          retrievedAt: new Date(source.retrievedAt),
          claimUse: source.claimUse,
        })),
      );
    }

    if (seedArticle.videos.length > 0) {
      await tx.insert(videoRecommendations).values(
        seedArticle.videos.map((video) => ({
          versionId: version.id,
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

    articleResult = "inserted";
  });

  return {
    channels: APPROVED_CHANNELS.length,
    article: articleResult,
  };
}

async function main(): Promise<void> {
  if (!getDatabaseUrl()) {
    console.info(
      "DATABASE_URL is not set; skipping database seed. The public site will use its checked-in seed content.",
    );
    return;
  }

  try {
    const result = await seedDatabase();
    console.info(
      `Database seed complete: ${result.channels} channel records checked, initial article ${result.article}.`,
    );
  } finally {
    await closeDatabase();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
