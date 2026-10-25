import { afterEach, describe, expect, it, vi } from "vitest";

import { seedArticle } from "../../lib/content/seed";
import type {
  ArticleStatus,
  ArticleVersionInput,
  GenerationRunInput,
  PublishedArticle,
  ReviewPackage,
  Topic,
} from "../../lib/content/types";
import {
  isLegalArticleStatusTransition,
} from "../../lib/db/repositories/approvals";
import type { ContentRepository } from "../../lib/db/repositories";
import {
  createApprovalToken,
} from "../../lib/notifications/approval-tokens";
import {
  sendReviewEmail,
} from "../../lib/notifications/email-provider";
import {
  applyReviewAction,
} from "../../lib/workflows/approval";
import {
  DAILY_TOPIC_QUEUE,
  runDailyGeneration,
  type GenerationRunUpdate,
} from "../../lib/workflows/daily-generation";

const secret = "workflow-test-approval-secret";
const now = new Date("2026-10-25T08:00:00.000Z");
const topic: Topic = DAILY_TOPIC_QUEUE[7];

class InMemoryWorkflowRepository implements ContentRepository {
  readonly runs: GenerationRunInput[] = [];
  readonly runIds: string[] = [];
  private readonly versions = new Map<string, ArticleVersionInput>();
  private nextVersion = 1;

  async getPublishedArticles(): Promise<PublishedArticle[]> {
    return [];
  }

  async getPublishedArticleBySlug(): Promise<PublishedArticle | null> {
    return null;
  }

  async createArticleVersion(
    input: ArticleVersionInput,
  ): Promise<{ articleId: string; versionId: string }> {
    const versionId = `version-${this.nextVersion++}`;
    this.versions.set(versionId, structuredClone(input));
    return { articleId: "article-1", versionId };
  }

  async getReviewPackage(versionId: string): Promise<ReviewPackage | null> {
    const input = this.versions.get(versionId);

    return input
      ? {
          versionId,
          article: structuredClone(input),
          validation: structuredClone(input.validationReport),
        }
      : null;
  }

  async transitionArticleStatus(input: {
    versionId: string;
    from: ArticleStatus;
    to: ArticleStatus;
  }): Promise<void> {
    const version = this.versions.get(input.versionId);

    if (!version) {
      throw new Error("missing version");
    }

    if (version.status === input.to) {
      return;
    }

    if (
      version.status !== input.from ||
      !isLegalArticleStatusTransition(input.from, input.to)
    ) {
      throw new Error("illegal transition");
    }

    this.versions.set(input.versionId, { ...version, status: input.to });
  }

  async saveGenerationRun(input: GenerationRunInput): Promise<string> {
    const runId = `run-${this.runs.length + 1}`;
    this.runs.push(structuredClone(input));
    this.runIds.push(runId);
    return runId;
  }
}

function dossier() {
  return {
    topicId: topic.id,
    claims: ["A small, repeatable practice can help a person re-engage attention."],
    scriptureRefs: seedArticle.content.scriptureRefs,
    uncertaintyNotes: ["This is spiritual encouragement, not a diagnosis."],
    sources: seedArticle.sources,
  };
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

describe("daily generation and approval workflow", () => {
  const previousSecret = process.env.APPROVAL_SECRET;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousSecret === undefined) {
      delete process.env.APPROVAL_SECRET;
    } else {
      process.env.APPROVAL_SECRET = previousSecret;
    }
  });

  it("persists one run, moves a valid draft to review, and sends one email", async () => {
    const repository = new InMemoryWorkflowRepository();
    const updates: GenerationRunUpdate[] = [];
    const sendReviewEmail = vi.fn(async () => undefined);

    const result = await runDailyGeneration({
      repository,
      now: () => now,
      selectTopic: () => topic,
      research: async () => dossier(),
      generate: async () => seedArticle.content,
      discoverVideos: async () => seedArticle.videos,
      mailer: { sendReviewEmail },
      updateRun: async (_runId, update) => {
        updates.push(update);
      },
    });

    expect(result).toMatchObject({
      runId: "run-1",
      versionId: "version-1",
      status: "needs_review",
    });
    expect(repository.runs).toEqual([
      { topicId: topic.id, trigger: "scheduled", status: "queued" },
    ]);
    expect(updates.map((update) => update.status)).toEqual([
      "researching",
      "drafted",
    ]);
    expect(sendReviewEmail).toHaveBeenCalledOnce();
    expect(sendReviewEmail).toHaveBeenCalledWith(
      expect.objectContaining({ versionId: "version-1" }),
    );
  });

  it("marks blocked content failed without sending a review email", async () => {
    const repository = new InMemoryWorkflowRepository();
    const updates: GenerationRunUpdate[] = [];
    const sendReviewEmail = vi.fn(async () => undefined);

    const result = await runDailyGeneration({
      repository,
      now: () => now,
      selectTopic: () => topic,
      research: async () => dossier(),
      generate: async () => ({
        ...seedArticle.content,
        sections: [
          {
            ...seedArticle.content.sections[0],
            body: "I want to kill myself tonight.",
          },
          ...seedArticle.content.sections.slice(1),
        ],
      }),
      discoverVideos: async () => seedArticle.videos,
      mailer: { sendReviewEmail },
      updateRun: async (_runId, update) => {
        updates.push(update);
      },
    });

    expect(result.status).toBe("failed");
    expect(result.versionId).toBe("");
    expect(updates.at(-1)).toMatchObject({
      status: "failed",
      errorCode: "validation_failed",
    });
    expect(sendReviewEmail).not.toHaveBeenCalled();
  });

  it("logs a development review message without the approval secret", async () => {
    process.env.APPROVAL_SECRET = secret;
    const entries: { subject: string; reviewUrl: string }[] = [];

    await sendReviewEmail(
      {
        versionId: "version-email",
        article: versionInput("needs_review"),
        validation: versionInput("needs_review").validationReport,
      },
      {
        secret,
        now: () => now,
        siteUrl: "http://localhost:3000",
        logger: (entry) => entries.push(entry),
      },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].subject).toContain(seedArticle.content.title);
    expect(entries[0].reviewUrl).toMatch(/^http:\/\/localhost:3000\/review\?token=/);
    expect(JSON.stringify(entries)).not.toContain(secret);
  });

  it("publishes on approval and makes a second approval idempotent", async () => {
    process.env.APPROVAL_SECRET = secret;
    const repository = new InMemoryWorkflowRepository();
    const { versionId } = await repository.createArticleVersion(
      versionInput("needs_review"),
    );
    const token = createApprovalToken(
      { versionId, action: "review" },
      { secret, now: () => now },
    );

    const first = await applyReviewAction(
      { token, action: "approve" },
      { repository, secret, now: () => now },
    );
    const second = await applyReviewAction(
      { token, action: "approve" },
      { repository, secret, now: () => now },
    );

    expect(first).toMatchObject({
      status: "published",
      versionId,
      publishedSlug: seedArticle.slug,
    });
    expect(second).toEqual(first);
  });
});
