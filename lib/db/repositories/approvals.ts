import { and, eq } from "drizzle-orm";
import {
  ReviewPackageSchema,
  ValidationReportSchema,
  type ArticleStatus,
  type ReviewPackage,
} from "../../content/types";
import type { Database, DatabaseExecutor } from "../client";
import { articleVersions, articles } from "../schema";
import { getArticleVersionSnapshot } from "./articles";

export const LEGAL_ARTICLE_STATUS_TRANSITIONS: Readonly<
  Record<ArticleStatus, readonly ArticleStatus[]>
> = {
  queued: ["researching"],
  researching: ["drafted", "failed"],
  drafted: ["needs_review", "failed"],
  needs_review: ["approved", "rejected", "drafted"],
  approved: ["published"],
  published: [],
  rejected: [],
  failed: [],
};

export class ArticleVersionNotFoundError extends Error {
  constructor(versionId: string) {
    super(`Article version not found: ${versionId}`);
    this.name = "ArticleVersionNotFoundError";
  }
}

export class InvalidArticleStatusTransitionError extends Error {
  readonly from: ArticleStatus;
  readonly to: ArticleStatus;

  constructor(from: ArticleStatus, to: ArticleStatus) {
    super(`Illegal article status transition: ${from} -> ${to}`);
    this.name = "InvalidArticleStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function isLegalArticleStatusTransition(
  from: ArticleStatus,
  to: ArticleStatus,
): boolean {
  return LEGAL_ARTICLE_STATUS_TRANSITIONS[from].includes(to);
}

export async function getReviewPackage(
  db: DatabaseExecutor,
  versionId: string,
): Promise<ReviewPackage | null> {
  const snapshot = await getArticleVersionSnapshot(db, versionId);

  if (!snapshot) {
    return null;
  }

  const validation = ValidationReportSchema.parse(
    snapshot.version.validationReport,
  );

  return ReviewPackageSchema.parse({
    versionId,
    article: {
      slug: snapshot.article.slug,
      content: snapshot.version.content,
      sources: snapshot.sources,
      videos: snapshot.videos,
      status: snapshot.version.status,
      model: snapshot.version.model,
      promptVersion: snapshot.version.promptVersion,
      validationReport: validation,
    },
    validation,
  });
}

export async function transitionArticleStatus(
  db: Database,
  input: {
    versionId: string;
    from: ArticleStatus;
    to: ArticleStatus;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        articleId: articleVersions.articleId,
        status: articleVersions.status,
      })
      .from(articleVersions)
      .where(eq(articleVersions.id, input.versionId))
      .limit(1);

    if (!current) {
      throw new ArticleVersionNotFoundError(input.versionId);
    }

    if (current.status === input.to) {
      return;
    }

    if (
      current.status !== input.from ||
      !isLegalArticleStatusTransition(input.from, input.to)
    ) {
      throw new InvalidArticleStatusTransitionError(
        current.status,
        input.to,
      );
    }

    const now = new Date();
    const updated = await tx
      .update(articleVersions)
      .set({
        status: input.to,
        publishedAt: input.to === "published" ? now : undefined,
      })
      .where(
        and(
          eq(articleVersions.id, input.versionId),
          eq(articleVersions.status, input.from),
        ),
      )
      .returning({ id: articleVersions.id });

    if (updated.length === 0) {
      const [latest] = await tx
        .select({ status: articleVersions.status })
        .from(articleVersions)
        .where(eq(articleVersions.id, input.versionId))
        .limit(1);

      if (latest?.status === input.to) {
        return;
      }

      throw new InvalidArticleStatusTransitionError(
        latest?.status ?? input.from,
        input.to,
      );
    }

    await tx
      .update(articles)
      .set({
        status: input.to,
        updatedAt: now,
        publishedAt: input.to === "published" ? now : undefined,
      })
      .where(eq(articles.id, current.articleId));
  });
}
