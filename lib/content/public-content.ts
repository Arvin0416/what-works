import { getSeedPublishedArticle as getSeedArticle } from "./seed";
import type { PublishedArticle } from "./types";

export function getSeedPublishedArticle(): PublishedArticle {
  return getSeedArticle();
}
