import { getSeedPublishedArticle } from "../../content/seed";
import type {
  ArticleStatus,
  ArticleVersionInput,
  GenerationRunInput,
  PublishedArticle,
  ReviewPackage,
} from "../../content/types";
import type { Database } from "../client";
import {
  createArticleVersion as createArticleVersionInDatabase,
  getPublishedArticleBySlug as getPublishedArticleBySlugInDatabase,
  getPublishedArticles as getPublishedArticlesInDatabase,
} from "./articles";
import {
  getReviewPackage as getReviewPackageInDatabase,
  transitionArticleStatus as transitionArticleStatusInDatabase,
} from "./approvals";
import {
  saveGenerationRun as saveGenerationRunInDatabase,
} from "./generation-runs";

export interface ContentRepository {
  getPublishedArticles(): Promise<PublishedArticle[]>;
  getPublishedArticleBySlug(slug: string): Promise<PublishedArticle | null>;
  createArticleVersion(
    input: ArticleVersionInput,
  ): Promise<{ articleId: string; versionId: string }>;
  getReviewPackage(versionId: string): Promise<ReviewPackage | null>;
  transitionArticleStatus(input: {
    versionId: string;
    from: ArticleStatus;
    to: ArticleStatus;
  }): Promise<void>;
  saveGenerationRun(input: GenerationRunInput): Promise<string>;
}

export class DatabaseRepositoryUnavailableError extends Error {
  constructor() {
    super(
      "The database repository requires DATABASE_URL for private workflow operations.",
    );
    this.name = "DatabaseRepositoryUnavailableError";
  }
}

export function getRepositoryMode(): "database" | "seed" {
  return process.env.DATABASE_URL?.trim() ? "database" : "seed";
}

export function createDatabaseRepository(db: Database): ContentRepository {
  return {
    getPublishedArticles: () => getPublishedArticlesInDatabase(db),
    getPublishedArticleBySlug: (slug) =>
      getPublishedArticleBySlugInDatabase(db, slug),
    createArticleVersion: (input) =>
      createArticleVersionInDatabase(db, input),
    getReviewPackage: (versionId) => getReviewPackageInDatabase(db, versionId),
    transitionArticleStatus: (input) =>
      transitionArticleStatusInDatabase(db, input),
    saveGenerationRun: (input) => saveGenerationRunInDatabase(db, input),
  };
}

export async function getPublishedArticles(): Promise<PublishedArticle[]> {
  if (getRepositoryMode() === "seed") {
    return [getSeedPublishedArticle()];
  }

  return (await getConfiguredDatabaseRepository()).getPublishedArticles();
}

export async function getPublishedArticleBySlug(
  slug: string,
): Promise<PublishedArticle | null> {
  if (getRepositoryMode() === "seed") {
    const seedArticle = getSeedPublishedArticle();
    return seedArticle.slug === slug ? seedArticle : null;
  }

  return (await getConfiguredDatabaseRepository()).getPublishedArticleBySlug(
    slug,
  );
}

export async function createArticleVersion(
  input: ArticleVersionInput,
): Promise<{ articleId: string; versionId: string }> {
  return (await getConfiguredDatabaseRepository()).createArticleVersion(input);
}

export async function getReviewPackage(
  versionId: string,
): Promise<ReviewPackage | null> {
  return (await getConfiguredDatabaseRepository()).getReviewPackage(versionId);
}

export async function transitionArticleStatus(input: {
  versionId: string;
  from: ArticleStatus;
  to: ArticleStatus;
}): Promise<void> {
  return (await getConfiguredDatabaseRepository()).transitionArticleStatus(
    input,
  );
}

export async function saveGenerationRun(
  input: GenerationRunInput,
): Promise<string> {
  return (await getConfiguredDatabaseRepository()).saveGenerationRun(input);
}

async function getConfiguredDatabaseRepository(): Promise<ContentRepository> {
  if (getRepositoryMode() === "seed") {
    throw new DatabaseRepositoryUnavailableError();
  }

  const { getDatabase } = await import("../client");
  return createDatabaseRepository(getDatabase());
}
