import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  ArticleContent,
  ValidationReport,
} from "../content/types";

export const ARTICLE_STATUS_VALUES = [
  "queued",
  "researching",
  "drafted",
  "needs_review",
  "approved",
  "published",
  "rejected",
  "failed",
] as const;

export const APPROVAL_ACTION_VALUES = [
  "review",
  "approve",
  "request_changes",
  "reject",
] as const;

export const GENERATION_TRIGGER_VALUES = ["scheduled", "manual"] as const;
export const GENERATION_RUN_STATUS_VALUES = [
  "queued",
  "researching",
  "drafted",
  "failed",
] as const;

export const articleStatusEnum = pgEnum(
  "article_status",
  ARTICLE_STATUS_VALUES,
);

export const approvalActionEnum = pgEnum(
  "approval_action",
  APPROVAL_ACTION_VALUES,
);

export const generationTriggerEnum = pgEnum(
  "generation_trigger",
  GENERATION_TRIGGER_VALUES,
);

export const generationRunStatusEnum = pgEnum(
  "generation_run_status",
  GENERATION_RUN_STATUS_VALUES,
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    categoryId: text("category_id").notNull(),
    status: articleStatusEnum("status").notNull().default("queued"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => ({
    statusIdx: index("articles_status_idx").on(table.status),
    slugIdx: index("articles_slug_idx").on(table.slug),
    publishedAtIdx: index("articles_published_at_idx").on(table.publishedAt),
  }),
);

export const articleVersions = pgTable(
  "article_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    status: articleStatusEnum("status").notNull(),
    content: jsonb("content").$type<ArticleContent>().notNull(),
    validationReport: jsonb("validation_report")
      .$type<ValidationReport>()
      .notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    reviewerFeedback: text("reviewer_feedback"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => ({
    articleIdx: index("article_versions_article_idx").on(table.articleId),
    statusIdx: index("article_versions_status_idx").on(table.status),
    createdAtIdx: index("article_versions_created_at_idx").on(table.createdAt),
  }),
);

export const sourceCitations = pgTable(
  "source_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    retrievedAt: timestamp("retrieved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    claimUse: text("claim_use").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    versionIdx: index("source_citations_version_idx").on(table.versionId),
    versionUrlUnique: uniqueIndex("source_citations_version_url_unique").on(
      table.versionId,
      table.url,
    ),
  }),
);

export const videoRecommendations = pgTable(
  "video_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    title: text("title").notNull(),
    channelId: text("channel_id").notNull(),
    channelName: text("channel_name").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    watchUrl: text("watch_url").notNull(),
    durationSeconds: integer("duration_seconds"),
    topicId: text("topic_id").notNull(),
    source: text("source").notNull().default("youtube"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    versionIdx: index("video_recommendations_version_idx").on(table.versionId),
    videoIdUnique: uniqueIndex("video_recommendations_version_video_unique").on(
      table.versionId,
      table.videoId,
    ),
  }),
);

export const channelAllowlist = pgTable(
  "channel_allowlist",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activeIdx: index("channel_allowlist_active_idx").on(table.active),
  }),
);

export const generationRuns = pgTable(
  "generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: text("topic_id").notNull(),
    trigger: generationTriggerEnum("trigger").notNull(),
    status: generationRunStatusEnum("status").notNull(),
    errorCode: text("error_code"),
    articleVersionId: uuid("article_version_id").references(
      () => articleVersions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => ({
    statusIdx: index("generation_runs_status_idx").on(table.status),
    createdAtIdx: index("generation_runs_created_at_idx").on(table.createdAt),
    topicIdx: index("generation_runs_topic_idx").on(table.topicId),
  }),
);

export const approvalTokens = pgTable(
  "approval_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    action: approvalActionEnum("action").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    consumedAt: timestamp("consumed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    versionActionIdx: index("approval_tokens_version_action_idx").on(
      table.versionId,
      table.action,
    ),
    expiresAtIdx: index("approval_tokens_expires_at_idx").on(table.expiresAt),
  }),
);
