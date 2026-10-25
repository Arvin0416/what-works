import { getCategoryById } from "../../lib/content/categories";
import type { PublishedArticle } from "../../lib/content/types";

type TodayArticleCardProps = {
  article: PublishedArticle;
};

export function TodayArticleCard({ article }: TodayArticleCardProps) {
  const category = getCategoryById(article.content.categoryId);

  return (
    <section
      id="today-article"
      className="today-section"
      aria-labelledby="today-heading"
    >
      <div className="site-container today-section__grid">
        <div className="today-section__intro">
          <p className="section-kicker">Today&apos;s What Works</p>
          <h2 id="today-heading">A guide for the moment you are in.</h2>
          <p>
            A reviewed starting point for prayer, reflection, and wise action
            when faith feels less clear than you want it to.
          </p>
        </div>

        <article className="today-card">
          <div className="today-card__meta">
            <span className="today-card__category">
              {category?.label ?? "Faith guide"}
            </span>
            <span>{article.content.readingMinutes} min read</span>
          </div>
          <h3>
            <a href={`/articles/${article.slug}`}>{article.content.title}</a>
          </h3>
          <p className="today-card__dek">{article.content.dek}</p>
          <p className="today-card__summary">{article.content.summary}</p>
          <div className="today-card__footer">
            <a className="button button--acid" href={`/articles/${article.slug}`}>
              Read today&apos;s guide
            </a>
            <span>{article.content.scriptureRefs.join(" / ")}</span>
          </div>
        </article>
      </div>
    </section>
  );
}
