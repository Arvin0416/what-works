import { eq } from "drizzle-orm";

import { APPROVED_CHANNELS } from "../content/channels";
import type {
  ApprovedChannel,
  ArticleVersionInput,
  ResearchDossier,
  Topic,
  VideoRecommendation,
} from "../content/types";
import {
  createDatabaseRepository,
  getActiveApprovedChannels,
  type ContentRepository,
} from "../db/repositories";
import { getDatabase } from "../db/client";
import { generationRuns } from "../db/schema";
import {
  generateArticle,
  type GenerateArticleInput,
} from "../generation/generate-article";
import { getOpenAIModel } from "../research/openai-research";
import { researchTopic } from "../research/openai-research";
import { searchApprovedVideos } from "../research/youtube";
import { validateGeneratedArticle } from "../generation/validate-article";
import { PROMPT_VERSION } from "../generation/prompts";
import { createMailer, type Mailer } from "../notifications/email-provider";

export const DAILY_TOPIC_QUEUE: readonly Topic[] = [
  {
    id: "temptation",
    label: "When temptation gets loud",
    prompt: "Give a reader one honest, wise next step toward Jesus when temptation feels immediate.",
    categoryId: "temptation",
  },
  {
    id: "family",
    label: "After an argument with family",
    prompt: "Offer a practical, grace-filled next step after conflict with a family member.",
    categoryId: "family",
  },
  {
    id: "anxiety",
    label: "When anxious thoughts keep circling",
    prompt: "Help a reader meet anxious thoughts with prayer, wise support, and a grounded next step.",
    categoryId: "anxiety",
  },
  {
    id: "doubt",
    label: "When faith feels uncertain",
    prompt: "Make room for honest questions while encouraging a humble next step toward Jesus.",
    categoryId: "doubt",
  },
  {
    id: "loneliness",
    label: "When you feel alone",
    prompt: "Guide a lonely reader toward God and one trustworthy human connection.",
    categoryId: "loneliness",
  },
  {
    id: "forgiveness",
    label: "When forgiveness feels difficult",
    prompt: "Help a reader name harm, receive grace, and choose wise repair without minimizing safety.",
    categoryId: "forgiveness",
  },
  {
    id: "prayer",
    label: "When you do not know how to pray",
    prompt: "Give a reader a simple, honest way to turn toward God in prayer.",
    categoryId: "prayer",
  },
  {
    id: "spiritual-growth",
    label: "When you feel far from God",
    prompt: "Give a reader one honest next step toward Jesus when prayer feels quiet.",
    categoryId: "spiritual-growth",
  },
] as const;

type GenerationRunStatus = "queued" | "researching" | "drafted" | "failed";

export interface GenerationRunUpdate {
  status: GenerationRunStatus;
  articleVersionId?: string;
  errorCode?: string;
}

export type UpdateGenerationRun = (
  runId: string,
  input: GenerationRunUpdate,
) => Promise<void>;

export interface DailyGenerationDependencies {
  repository?: ContentRepository;
  now?: () => Date;
  selectTopic?: (now: Date) => Topic;
  research?: (topic: Topic) => Promise<ResearchDossier>;
  generate?: (input: GenerateArticleInput) => Promise<ArticleVersionInput["content"]>;
  discoverVideos?: (
    topic: Topic,
    channels: readonly ApprovedChannel[],
  ) => Promise<VideoRecommendation[]>;
  channels?: readonly ApprovedChannel[];
  mailer?: Mailer;
  updateRun?: UpdateGenerationRun;
  trigger?: "scheduled" | "manual";
}

export interface DailyGenerationResult {
  runId: string;
  versionId: string;
  status: "needs_review" | "failed";
}

export class DailyGenerationError extends Error {
  readonly code:
    | "database_unavailable"
    | "run_persistence_failed"
    | "research_failed"
    | "generation_failed"
    | "validation_failed"
    | "video_discovery_failed"
    | "version_persistence_failed"
    | "review_package_missing"
    | "notification_failed";

  constructor(
    code: DailyGenerationError["code"],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DailyGenerationError";
    this.code = code;
  }
}

export function selectNextTopic(now = new Date()): Topic {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  return DAILY_TOPIC_QUEUE[((dayIndex % DAILY_TOPIC_QUEUE.length) + DAILY_TOPIC_QUEUE.length) % DAILY_TOPIC_QUEUE.length];
}

export async function runDailyGeneration(
  dependencies: DailyGenerationDependencies = {},
): Promise<DailyGenerationResult> {
  const now = dependencies.now ?? (() => new Date());
  const topic = (dependencies.selectTopic ?? selectNextTopic)(now());
  const repository = dependencies.repository ?? getDefaultRepository();
  const trigger = dependencies.trigger ?? "scheduled";
  const updateRun =
    dependencies.updateRun ??
    (dependencies.repository ? noOpUpdateGenerationRun : updateDatabaseRun);
  const research = dependencies.research ?? researchTopic;
  const generate = dependencies.generate ?? ((input) => generateArticle(input));
  const discoverVideos =
    dependencies.discoverVideos ??
    ((selectedTopic, channels) =>
      searchApprovedVideos({ topic: selectedTopic, channels }));
  const channels =
    dependencies.channels ??
    (process.env.DATABASE_URL?.trim()
      ? await getActiveApprovedChannels()
      : APPROVED_CHANNELS.filter((channel) => channel.active));
  const mailer = dependencies.mailer ?? createMailer();

  let runId: string;

  try {
    runId = await repository.saveGenerationRun({
      topicId: topic.id,
      trigger,
      status: "queued",
    });
  } catch (error) {
    throw new DailyGenerationError(
      "run_persistence_failed",
      "The daily generation run could not be created.",
      { cause: error },
    );
  }

  let versionId = "";

  try {
    await updateRun(runId, { status: "researching" });
    let dossier: ResearchDossier;
    try {
      dossier = await research(topic);
    } catch (error) {
      throw new DailyGenerationError(
        "research_failed",
        "The research dossier could not be created.",
        { cause: error },
      );
    }

    let content: ArticleVersionInput["content"];
    try {
      content = await generate({ topic, dossier });
    } catch (error) {
      throw new DailyGenerationError(
        "generation_failed",
        "The article draft could not be generated.",
        { cause: error },
      );
    }

    const validation = validateGeneratedArticle(
      {
        content,
        sources: dossier.sources,
        citationUrls: dossier.sources.map((source) => source.url),
      },
      dossier,
    );

    if (!validation.passed) {
      throw new DailyGenerationError(
        "validation_failed",
        "The generated article was blocked by validation.",
      );
    }

    let videos: VideoRecommendation[];
    try {
      videos = await discoverVideos(topic, channels);
    } catch (error) {
      throw new DailyGenerationError(
        "video_discovery_failed",
        "Approved-channel video discovery failed.",
        { cause: error },
      );
    }

    const versionInput: ArticleVersionInput = {
      slug: createDraftSlug(content.title, topic.id),
      content,
      sources: dossier.sources,
      videos,
      status: "drafted",
      model: getOpenAIModel(),
      promptVersion: PROMPT_VERSION,
      validationReport: validation,
    };

    try {
      const created = await repository.createArticleVersion(versionInput);
      versionId = created.versionId;
    } catch (error) {
      throw new DailyGenerationError(
        "version_persistence_failed",
        "The generated article could not be persisted.",
        { cause: error },
      );
    }

    await updateRun(runId, { status: "drafted", articleVersionId: versionId });
    await repository.transitionArticleStatus({
      versionId,
      from: "drafted",
      to: "needs_review",
    });

    const reviewPackage = await repository.getReviewPackage(versionId);

    if (!reviewPackage) {
      throw new DailyGenerationError(
        "review_package_missing",
        "The persisted article review package could not be loaded.",
      );
    }

    try {
      await mailer.sendReviewEmail(reviewPackage);
    } catch (error) {
      throw new DailyGenerationError(
        "notification_failed",
        "The review email could not be sent.",
        { cause: error },
      );
    }

    return { runId, versionId, status: "needs_review" };
  } catch (error) {
    const errorCode = getSafeErrorCode(error);

    try {
      await updateRun(runId, { status: "failed", errorCode });
    } catch {
      // Preserve the original safe workflow result if the failure update also
      // encounters a transient database problem.
    }

    return { runId, versionId, status: "failed" };
  }
}

function getDefaultRepository(): ContentRepository {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new DailyGenerationError(
      "database_unavailable",
      "DATABASE_URL is required for private daily generation.",
    );
  }

  return createDatabaseRepository(getDatabase());
}

async function updateDatabaseRun(
  runId: string,
  input: GenerationRunUpdate,
): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(generationRuns)
    .set({
      status: input.status,
      ...(input.articleVersionId
        ? { articleVersionId: input.articleVersionId }
        : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      ...(input.status === "researching" ? { startedAt: now } : {}),
      ...(input.status === "drafted" || input.status === "failed"
        ? { finishedAt: now }
        : {}),
    })
    .where(eq(generationRuns.id, runId));
}

async function noOpUpdateGenerationRun(): Promise<void> {
  return undefined;
}

function getSafeErrorCode(error: unknown): string {
  if (error instanceof DailyGenerationError) {
    return error.code;
  }

  if (error instanceof Error && error.name === "ApprovalTokenConfigurationError") {
    return "notification_failed";
  }

  return "workflow_failed";
}

function createDraftSlug(title: string, topicId: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return `${normalizedTitle || "daily-guide"}-${topicId}`;
}
