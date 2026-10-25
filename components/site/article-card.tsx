import { getCategoryById } from "../../lib/content/categories";
import type { PublishedArticle } from "../../lib/content/types";

type ArticleCardProps = {
  article: PublishedArticle;
};

function formatPublishedDate(dateTime: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(dateTime));
}

export function ArticleCard({ article }: ArticleCardProps) {
  const category = getCategoryById(article.content.categoryId);

  return (
    <article className="article-card">
      <div className="article-card__meta">
        <span
          className="article-card__category"
          data-accent={category?.accent ?? "ink"}
        >
          {category?.label ?? "Faith guide"}
        </span>
        <time dateTime={article.publishedAt}>
          {formatPublishedDate(article.publishedAt)}
        </time>
      </div>
      <h3>
        <a href={`/articles/${article.slug}`}>{article.content.title}</a>
      </h3>
      <p>{article.content.dek}</p>
      <a className="article-card__link" href={`/articles/${article.slug}`}>
        Open the guide
      </a>
    </article>
  );
}
