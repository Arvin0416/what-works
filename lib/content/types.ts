import { z } from "zod";

const nonEmptyText = z.string().trim().min(1, "Expected a non-empty string");

const dateTimeText = nonEmptyText.refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Expected a valid date-time string",
);

const youtubeWatchUrl = z
  .string()
  .url("Expected a valid HTTPS YouTube watch URL")
  .refine(
    (value) => {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(value);
      } catch {
        return false;
      }

      return (
        parsedUrl.protocol === "https:" &&
        (value.startsWith("https://www.youtube.com/") ||
          value.startsWith("https://youtu.be/")) &&
        (parsedUrl.hostname === "www.youtube.com" ||
          parsedUrl.hostname === "youtu.be")
      );
    },
    "Watch URL must point to YouTube over HTTPS",
  );

const youtubeChannelUrl = z
  .string()
  .url("Expected a valid channel URL")
  .refine(
    (value) => {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(value);
      } catch {
        return false;
      }

      return (
        parsedUrl.protocol === "https:" &&
        (parsedUrl.hostname === "www.youtube.com" ||
          parsedUrl.hostname === "youtube.com")
      );
    },
    "Channel URL must point to YouTube over HTTPS",
  );

const thumbnailUrl = z.union([z.literal(""), z.string().url()]);

export const ArticleStatusSchema = z.enum([
  "queued",
  "researching",
  "drafted",
  "needs_review",
  "approved",
  "published",
  "rejected",
  "failed",
]);

export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;

export const StruggleCategorySchema = z.object({
  id: nonEmptyText,
  label: nonEmptyText,
  description: nonEmptyText,
  accent: nonEmptyText,
});

export type StruggleCategory = z.infer<typeof StruggleCategorySchema>;

export const ArticleSectionSchema = z.object({
  heading: nonEmptyText,
  body: nonEmptyText,
});

export type ArticleSection = z.infer<typeof ArticleSectionSchema>;

export const ArticleContentSchema = z.object({
  title: nonEmptyText,
  dek: nonEmptyText,
  categoryId: nonEmptyText,
  summary: nonEmptyText,
  sections: z
    .array(ArticleSectionSchema)
    .min(2, "An article must contain at least two sections"),
  scriptureRefs: z
    .array(nonEmptyText)
    .min(1, "An article must contain at least one Scripture reference"),
  prayer: nonEmptyText,
  safetyNote: nonEmptyText,
  readingMinutes: z
    .number()
    .int("Reading time must be a whole number")
    .min(1, "Reading time must be at least one minute")
    .max(20, "Reading time must be twenty minutes or less"),
});

export type ArticleContent = z.infer<typeof ArticleContentSchema>;

export const VideoRecommendationSchema = z.object({
  videoId: nonEmptyText,
  title: nonEmptyText,
  channelId: nonEmptyText,
  channelName: nonEmptyText,
  thumbnailUrl,
  watchUrl: youtubeWatchUrl,
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
  topicId: nonEmptyText,
  source: z.literal("youtube"),
});

export type VideoRecommendation = z.infer<
  typeof VideoRecommendationSchema
>;

export const SourceCitationSchema = z.object({
  url: z.string().url(),
  title: nonEmptyText,
  publisher: nonEmptyText,
  retrievedAt: dateTimeText,
  claimUse: nonEmptyText,
});

export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const PublishedArticleSchema = z.object({
  id: nonEmptyText,
  slug: nonEmptyText,
  status: z.literal("published"),
  publishedAt: dateTimeText,
  content: ArticleContentSchema,
  sources: z.array(SourceCitationSchema),
  videos: z.array(VideoRecommendationSchema),
});

export type PublishedArticle = z.infer<typeof PublishedArticleSchema>;

export const ApprovedChannelSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText,
  handle: nonEmptyText,
  canonicalUrl: youtubeChannelUrl,
  active: z.boolean(),
});

export type ApprovedChannel = z.infer<typeof ApprovedChannelSchema>;

export const TopicSchema = z.object({
  id: nonEmptyText,
  label: nonEmptyText,
  prompt: nonEmptyText,
  categoryId: nonEmptyText,
});

export type Topic = z.infer<typeof TopicSchema>;

export const ResearchDossierSchema = z.object({
  topicId: nonEmptyText,
  claims: z.array(nonEmptyText),
  scriptureRefs: z.array(nonEmptyText),
  uncertaintyNotes: z.array(nonEmptyText),
  sources: z.array(SourceCitationSchema),
});

export type ResearchDossier = z.infer<typeof ResearchDossierSchema>;

export const ValidationReportSchema = z.object({
  passed: z.boolean(),
  warnings: z.array(nonEmptyText),
  blockedReasons: z.array(nonEmptyText),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const ArticleVersionInputSchema = z.object({
  slug: nonEmptyText,
  content: ArticleContentSchema,
  sources: z.array(SourceCitationSchema),
  videos: z.array(VideoRecommendationSchema),
  status: ArticleStatusSchema,
  model: nonEmptyText,
  promptVersion: nonEmptyText,
  validationReport: ValidationReportSchema,
});

export type ArticleVersionInput = z.infer<typeof ArticleVersionInputSchema>;

export const ReviewPackageSchema = z.object({
  versionId: nonEmptyText,
  article: z.union([PublishedArticleSchema, ArticleVersionInputSchema]),
  validation: ValidationReportSchema,
});

export type ReviewPackage = z.infer<typeof ReviewPackageSchema>;

export const GenerationRunInputSchema = z.object({
  topicId: nonEmptyText,
  trigger: z.enum(["scheduled", "manual"]),
  status: z.enum(["queued", "researching", "drafted", "failed"]),
  errorCode: nonEmptyText.optional(),
});

export type GenerationRunInput = z.infer<typeof GenerationRunInputSchema>;

export const SafetyReportSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  flags: z.array(nonEmptyText),
  blocked: z.boolean(),
  escalationCopy: nonEmptyText.optional(),
});

export type SafetyReport = z.infer<typeof SafetyReportSchema>;

export { youtubeWatchUrl as YouTubeWatchUrlSchema };
