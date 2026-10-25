import { describe, expect, it } from "vitest";
import { seedArticle } from "../../lib/content/seed";
import type {
  ArticleStatus,
  ArticleVersionInput,
  GenerationRunInput,
  PublishedArticle,
  ReviewPackage,
} from "../../lib/content/types";
import {
  getPublishedArticleBySlug,
  getPublishedArticles,
} from "../../lib/content/public-content";
import {
  getRepositoryMode,
  type ContentRepository,
} from "../../lib/db/repositories";
import {
  isLegalArticleStatusTransition,
} from "../../lib/db/repositories/approvals";

class InMemoryRepository implements ContentRepository {
  private readonly versions = new Map<
    string,
    { articleId: string; input: ArticleVersionInput }
  >();

  private readonly articleIds = new Map<string, string>();

  private nextId(prefix: string): string {
    return `${prefix}-${this.versions.size + this.articleIds.size + 1}`;
  }

  async getPublishedArticles(): Promise<PublishedArticle[]> {
    return [...this.versions.values()]
      .filter(({ input }) => input.status === "published")
      .map(({ articleId, input }) => this.toPublishedArticle(articleId, input));
  }

  async getPublishedArticleBySlug(
    slug: string,
  ): Promise<PublishedArticle | null> {
    const record = [...this.versions.values()].find(
      ({ input }) => input.slug === slug && input.status === "published",
    );

    return record
      ? this.toPublishedArticle(record.articleId, record.input)
      : null;
  }

  async createArticleVersion(
    input: ArticleVersionInput,
  ): Promise<{ articleId: string; versionId: string }> {
    const articleId =
      this.articleIds.get(input.slug) ?? this.nextId("article");
    const versionId = this.nextId("version");
    this.articleIds.set(input.slug, articleId);
    this.versions.set(versionId, {
      articleId,
      input: structuredClone(input),
    });
    return { articleId, versionId };
  }

  async getReviewPackage(versionId: string): Promise<ReviewPackage | null> {
    const record = this.versions.get(versionId);
    return record
      ? {
          versionId,
          article: structuredClone(record.input),
          validation: structuredClone(record.input.validationReport),
        }
      : null;
  }

  async transitionArticleStatus(input: {
    versionId: string;
    from: ArticleStatus;
    to: ArticleStatus;
  }): Promise<void> {
    const record = this.versions.get(input.versionId);

    if (!record) {
      throw new Error(`Article version not found: ${input.versionId}`);
    }

    if (record.input.status === input.to) {
      return;
    }

    if (
      record.input.status !== input.from ||
      !isLegalArticleStatusTransition(input.from, input.to)
    ) {
      throw new Error(`Illegal article status transition`);
    }

    record.input = { ...record.input, status: input.to };
  }

  async saveGenerationRun(input: GenerationRunInput): Promise<string> {
    return `${input.trigger}-${input.topicId}-${input.status}`;
  }

  private toPublishedArticle(
    articleId: string,
    input: ArticleVersionInput,
  ): PublishedArticle {
    return {
      id: articleId,
      slug: input.slug,
      status: "published",
      publishedAt: "2026-10-25T00:00:00.000Z",
      content: input.content,
      sources: input.sources,
      videos: input.videos,
    };
  }
}

function versionInput(status: ArticleStatus): ArticleVersionInput {
  return {
    slug: seedArticle.slug,
    content: seedArticle.content,
    sources: seedArticle.sources,
    videos: seedArticle.videos,
    status,
    model: "test-model",
    promptVersion: "test-prompt",
    validationReport: {
      passed: true,
      warnings: [],
      blockedReasons: [],
    },
  };
}

describe("repository contracts", () => {
  it("keeps private versions out of published reads and resolves published slugs", async () => {
    const repository = new InMemoryRepository();
    const draft = await repository.createArticleVersion(versionInput("drafted"));

    expect(await repository.getPublishedArticles()).toEqual([]);
    expect(await repository.getPublishedArticleBySlug(seedArticle.slug)).toBeNull();

    await repository.transitionArticleStatus({
      versionId: draft.versionId,
      from: "drafted",
      to: "needs_review",
    });
    await repository.transitionArticleStatus({
      versionId: draft.versionId,
      from: "needs_review",
      to: "approved",
    });
    await repository.transitionArticleStatus({
      versionId: draft.versionId,
      from: "approved",
      to: "published",
    });

    await expect(
      repository.getPublishedArticleBySlug(seedArticle.slug),
    ).resolves.toMatchObject({
      slug: seedArticle.slug,
      status: "published",
    });
  });

  it("stores a review package and allows only the documented transitions", async () => {
    const repository = new InMemoryRepository();
    const created = await repository.createArticleVersion(versionInput("queued"));

    expect(created.articleId).toContain("article-");
    await expect(repository.getReviewPackage(created.versionId)).resolves.toMatchObject({
      versionId: created.versionId,
      validation: { passed: true },
    });

    await repository.transitionArticleStatus({
      versionId: created.versionId,
      from: "queued",
      to: "researching",
    });
    await repository.transitionArticleStatus({
      versionId: created.versionId,
      from: "researching",
      to: "drafted",
    });
    await repository.transitionArticleStatus({
      versionId: created.versionId,
      from: "drafted",
      to: "needs_review",
    });

    await expect(
      repository.transitionArticleStatus({
        versionId: created.versionId,
        from: "needs_review",
        to: "published",
      }),
    ).rejects.toThrow("Illegal article status transition");

    await repository.transitionArticleStatus({
      versionId: created.versionId,
      from: "needs_review",
      to: "approved",
    });
    await repository.transitionArticleStatus({
      versionId: created.versionId,
      from: "approved",
      to: "published",
    });

    await expect(
      repository.transitionArticleStatus({
        versionId: created.versionId,
        from: "approved",
        to: "published",
      }),
    ).resolves.toBeUndefined();

    await expect(
      repository.transitionArticleStatus({
        versionId: created.versionId,
        from: "published",
        to: "approved",
      }),
    ).rejects.toThrow("Illegal article status transition");
  });

  it("returns the seed article without a database URL", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(getRepositoryMode()).toBe("seed");
      await expect(getPublishedArticles()).resolves.toEqual([seedArticle]);
      await expect(getPublishedArticleBySlug(seedArticle.slug)).resolves.toEqual(
        seedArticle,
      );
      await expect(getPublishedArticleBySlug("not-found")).resolves.toBeNull();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
