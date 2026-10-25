import { and, eq, gt, isNull } from "drizzle-orm";
import {
  ReviewPackageSchema,
  ValidationReportSchema,
  type ArticleStatus,
  type ReviewPackage,
} from "../../content/types";
import type {
  ApprovalTokenAction,
  PersistedApprovalToken,
} from "../../notifications/approval-tokens";
import type { Database, DatabaseExecutor } from "../client";
import { approvalTokens, articleVersions, articles } from "../schema";
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

/**
 * Persist only the SHA-256 digest of a bearer token. The raw value belongs
 * solely in the generated email link and is never stored in PostgreSQL.
 */
export async function createApprovalTokenRecord(
  db: Database,
  input: Omit<PersistedApprovalToken, "consumedAt">,
): Promise<void> {
  await db
    .insert(approvalTokens)
    .values({
      tokenHash: input.tokenHash,
      versionId: input.versionId,
      action: input.action,
      expiresAt: input.expiresAt,
    })
    .onConflictDoNothing({ target: approvalTokens.tokenHash });
}

export async function getApprovalTokenRecord(
  db: DatabaseExecutor,
  tokenHash: string,
): Promise<PersistedApprovalToken | null> {
  const [record] = await db
    .select({
      tokenHash: approvalTokens.tokenHash,
      versionId: approvalTokens.versionId,
      action: approvalTokens.action,
      expiresAt: approvalTokens.expiresAt,
      consumedAt: approvalTokens.consumedAt,
    })
    .from(approvalTokens)
    .where(eq(approvalTokens.tokenHash, tokenHash))
    .limit(1);

  return record
    ? {
        tokenHash: record.tokenHash,
        versionId: record.versionId,
        action: record.action as ApprovalTokenAction,
        expiresAt: record.expiresAt,
        consumedAt: record.consumedAt,
      }
    : null;
}

/**
 * Atomically claim a still-live token. The WHERE clause makes concurrent
 * approval requests single-use even when both requests pass cryptographic
 * verification at the same time.
 */
export async function consumeApprovalToken(
  db: Database,
  tokenHash: string,
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const consumed = await tx
      .update(approvalTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(approvalTokens.tokenHash, tokenHash),
          isNull(approvalTokens.consumedAt),
          gt(approvalTokens.expiresAt, now),
        ),
      )
      .returning({ id: approvalTokens.id });

    return consumed.length > 0;
  });
}
