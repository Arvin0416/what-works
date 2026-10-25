import { and, asc, desc, eq } from "drizzle-orm";
import {
  ArticleContentSchema,
  ArticleVersionInputSchema,
  PublishedArticleSchema,
  SourceCitationSchema,
  type ArticleVersionInput,
  type PublishedArticle,
  type SourceCitation,
} from "../../content/types";
import type { Database, DatabaseExecutor } from "../client";
import {
  articleVersions,
  articles,
  sourceCitations,
} from "../schema";
import {
  getVideosForVersion,
  insertVideoRecommendations,
} from "./videos";

export interface ArticleVersionSnapshot {
  article: typeof articles.$inferSelect;
  version: typeof articleVersions.$inferSelect;
  sources: SourceCitation[];
  videos: PublishedArticle["videos"];
}

export async function getPublishedArticles(
  db: DatabaseExecutor,
): Promise<PublishedArticle[]> {
  const rows = await db
    .select({ article: articles, version: articleVersions })
    .from(articles)
    .innerJoin(articleVersions, eq(articleVersions.articleId, articles.id))
    .where(eq(articleVersions.status, "published"))
    .orderBy(
      desc(articleVersions.publishedAt),
      desc(articleVersions.createdAt),
    );

  const latestPublishedVersionByArticle = new Map<
    string,
    (typeof rows)[number]
  >();

  for (const row of rows) {
    if (!latestPublishedVersionByArticle.has(row.article.id)) {
      latestPublishedVersionByArticle.set(row.article.id, row);
    }
  }

  return Promise.all(
    [...latestPublishedVersionByArticle.values()].map((row) =>
      toPublishedArticle(db, row.article, row.version),
    ),
  );
}

export async function getPublishedArticleBySlug(
  db: DatabaseExecutor,
  slug: string,
): Promise<PublishedArticle | null> {
  const rows = await db
    .select({ article: articles, version: articleVersions })
    .from(articles)
    .innerJoin(articleVersions, eq(articleVersions.articleId, articles.id))
    .where(
      and(eq(articles.slug, slug), eq(articleVersions.status, "published")),
    )
    .orderBy(
      desc(articleVersions.publishedAt),
      desc(articleVersions.createdAt),
    )
    .limit(1);

  const row = rows[0];

  return row
    ? toPublishedArticle(db, row.article, row.version)
    : null;
}

export async function createArticleVersion(
  db: Database,
  input: ArticleVersionInput,
): Promise<{ articleId: string; versionId: string }> {
  const parsedInput = ArticleVersionInputSchema.parse(input);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [article] = await tx
      .insert(articles)
      .values({
        slug: parsedInput.slug,
        title: parsedInput.content.title,
        categoryId: parsedInput.content.categoryId,
        status: parsedInput.status,
        publishedAt: parsedInput.status === "published" ? now : null,
      })
      .onConflictDoUpdate({
        target: articles.slug,
        set: {
          title: parsedInput.content.title,
          categoryId: parsedInput.content.categoryId,
          status: parsedInput.status,
          updatedAt: now,
          publishedAt: parsedInput.status === "published" ? now : undefined,
        },
      })
      .returning({ id: articles.id });

    if (!article) {
      throw new Error("The article record could not be created.");
    }

    const [version] = await tx
      .insert(articleVersions)
      .values({
        articleId: article.id,
        status: parsedInput.status,
        content: parsedInput.content,
        validationReport: parsedInput.validationReport,
        model: parsedInput.model,
        promptVersion: parsedInput.promptVersion,
        publishedAt: parsedInput.status === "published" ? now : null,
      })
      .returning({ id: articleVersions.id });

    if (!version) {
      throw new Error("The article version could not be created.");
    }

    if (parsedInput.sources.length > 0) {
      await tx.insert(sourceCitations).values(
        parsedInput.sources.map((source) => ({
          versionId: version.id,
          url: source.url,
          title: source.title,
          publisher: source.publisher,
          retrievedAt: new Date(source.retrievedAt),
          claimUse: source.claimUse,
        })),
      );
    }

    await insertVideoRecommendations(tx, version.id, parsedInput.videos);

    return { articleId: article.id, versionId: version.id };
  });
}

export async function getArticleVersionSnapshot(
  db: DatabaseExecutor,
  versionId: string,
): Promise<ArticleVersionSnapshot | null> {
  const rows = await db
    .select({ article: articles, version: articleVersions })
    .from(articleVersions)
    .innerJoin(articles, eq(articleVersions.articleId, articles.id))
    .where(eq(articleVersions.id, versionId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  const [sources, videos] = await Promise.all([
    getSourcesForVersion(db, versionId),
    getVideosForVersion(db, versionId),
  ]);

  return {
    article: row.article,
    version: row.version,
    sources,
    videos,
  };
}

async function getSourcesForVersion(
  db: DatabaseExecutor,
  versionId: string,
): Promise<SourceCitation[]> {
  const rows = await db
    .select()
    .from(sourceCitations)
    .where(eq(sourceCitations.versionId, versionId))
    .orderBy(asc(sourceCitations.createdAt));

  return rows.map((row) =>
    SourceCitationSchema.parse({
      url: row.url,
      title: row.title,
      publisher: row.publisher,
      retrievedAt: row.retrievedAt.toISOString(),
      claimUse: row.claimUse,
    }),
  );
}

async function toPublishedArticle(
  db: DatabaseExecutor,
  article: typeof articles.$inferSelect,
  version: typeof articleVersions.$inferSelect,
): Promise<PublishedArticle> {
  const [sources, videos] = await Promise.all([
    getSourcesForVersion(db, version.id),
    getVideosForVersion(db, version.id),
  ]);
  const publishedAt = article.publishedAt ?? version.publishedAt;

  if (!publishedAt) {
    throw new Error(
      `Published article ${article.slug} is missing a publication timestamp.`,
    );
  }

  return PublishedArticleSchema.parse({
    id: article.id,
    slug: article.slug,
    status: "published",
    publishedAt: publishedAt.toISOString(),
    content: ArticleContentSchema.parse(version.content),
    sources,
    videos,
  });
}
