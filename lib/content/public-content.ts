import { getSeedPublishedArticle as getSeedArticle } from "./seed";
import {
  getPublishedArticleBySlug as getPublishedArticleBySlugFromRepository,
  getPublishedArticles as getPublishedArticlesFromRepository,
  getRepositoryMode,
} from "../db/repositories";
import type { PublishedArticle } from "./types";

export { getRepositoryMode };

export function getSeedPublishedArticle(): PublishedArticle {
  return getSeedArticle();
}

export function getPublishedArticles(): Promise<PublishedArticle[]> {
  return getPublishedArticlesFromRepository();
}

export function getPublishedArticleBySlug(
  slug: string,
): Promise<PublishedArticle | null> {
  return getPublishedArticleBySlugFromRepository(slug);
}
