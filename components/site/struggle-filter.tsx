"use client";

import { useMemo, useState } from "react";

import { FAITH_CATEGORIES } from "../../lib/content/categories";
import type {
  PublishedArticle,
  StruggleCategory,
} from "../../lib/content/types";
import { ArticleCard } from "./article-card";
import { ScrollReveal } from "./scroll-reveal";

type StruggleFilterProps = {
  categories?: readonly StruggleCategory[];
  articles?: readonly PublishedArticle[];
  defaultCategoryId?: string;
};

export function StruggleFilter({
  categories = FAITH_CATEGORIES,
  articles = [],
  defaultCategoryId = "all",
}: StruggleFilterProps) {
  const initialCategory = categories.some(
    (category) => category.id === defaultCategoryId,
  )
    ? defaultCategoryId
    : "all";
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategory);

  const visibleArticles = useMemo(
    () =>
      activeCategoryId === "all"
        ? articles
        : articles.filter(
            (article) => article.content.categoryId === activeCategoryId,
          ),
    [activeCategoryId, articles],
  );

  const activeCategory = categories.find(
    (category) => category.id === activeCategoryId,
  );
  const resultLabel =
    activeCategoryId === "all"
      ? "Showing all guides"
      : `Showing guides for ${activeCategory?.label ?? "this struggle"}`;

  return (
    <section
      id="struggles"
      className="struggle-section"
      aria-labelledby="struggles-heading"
    >
      <div className="site-container">
        <ScrollReveal className="struggle-section__intro">
          <div>
            <p className="section-kicker">Browse by struggle</p>
            <h2 id="struggles-heading">Start with the hard thing.</h2>
          </div>
          <p>
            Choose a situation to find a practical guide, or stay with the
            full shelf and see what is available today.
          </p>
        </ScrollReveal>

        <ScrollReveal className="struggle-filter__controls-reveal" rootMargin="0px 0px -8% 0px">
          <div
            className="struggle-filter__controls"
            role="group"
            aria-label="Filter guides by struggle"
          >
            <button
              className="struggle-filter__button"
              type="button"
              aria-pressed={activeCategoryId === "all"}
              onClick={() => setActiveCategoryId("all")}
            >
              All guides
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className="struggle-filter__button"
                type="button"
                aria-pressed={activeCategoryId === category.id}
                data-accent={category.accent}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal className="struggle-filter__status-reveal" rootMargin="0px 0px -8% 0px">
          <p className="struggle-filter__status" role="status" aria-live="polite">
            {resultLabel}
          </p>
        </ScrollReveal>

        {articles.length > 0 ? (
          <ScrollReveal className="article-card-grid scroll-stagger" rootMargin="0px 0px -8% 0px">
            {visibleArticles.length > 0 ? (
              visibleArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))
            ) : (
              <p className="empty-state">
                No guide is filed under this struggle yet. Try another starting
                point.
              </p>
            )}
          </ScrollReveal>
        ) : null}
      </div>
    </section>
  );
}
