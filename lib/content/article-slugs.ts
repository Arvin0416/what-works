import {
  getPublishedArticleBySlug as getPublishedArticleBySlugFromPublicContent,
  getSeedPublishedArticle,
} from "./public-content";
import type { PublishedArticle } from "./types";

/**
 * Keep static generation seeded and explicit. Dynamic routes still resolve
 * repository-backed published records through the public query below.
 */
export function getPublishedArticleSlugs(): string[] {
  const article = getSeedPublishedArticle();

  return article.status === "published" ? [article.slug] : [];
}

/**
 * Resolve public article content by slug. The public-content boundary owns
 * the storage mode; this adapter adds the route-level published-only guard.
 */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<PublishedArticle | null> {
  const article = await getPublishedArticleBySlugFromPublicContent(slug);

  if (!article || article.status !== "published") {
    return null;
  }

  return article;
}
