import {
  ArticleContentSchema,
  type ArticleContent,
} from "./types";

export * from "./types";

/**
 * Parse untrusted article data at the content boundary. Zod preserves the
 * failing field paths in its thrown error for review and generation callers.
 */
export function validateArticleContent(input: unknown): ArticleContent {
  return ArticleContentSchema.parse(input);
}
