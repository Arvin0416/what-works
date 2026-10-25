import { getCategoryById } from "../../lib/content/categories";
import type { PublishedArticle } from "../../lib/content/types";
import { WatchGallery } from "./watch-gallery";
import { SafetyNote } from "./safety-note";
import { SourceList } from "./source-list";

type ArticleReaderProps = {
  article: PublishedArticle;
};

function formatPublishedDate(dateTime: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(dateTime));
}

export function ArticleReader({ article }: ArticleReaderProps) {
  // Keep the component safe if untrusted repository data is ever cast to the
  // public type before it reaches the route boundary.
  if (article.status !== "published") {
    return null;
  }

  const category = getCategoryById(article.content.categoryId);

  return (
    <article className="article-reader" aria-labelledby="article-title">
      <header className="today-section article-reader__header">
        <div className="site-container">
          <div style={{ maxWidth: "52rem", marginInline: "auto" }}>
            <p className="section-kicker" style={{ color: "var(--acid-green)" }}>
              Published guide · {category?.label ?? "Faith guide"}
            </p>
            <h1 id="article-title" style={{ fontSize: "clamp(2.8rem, 7vw, 6.8rem)" }}>
              {article.content.title}
            </h1>
            <p
              style={{
                maxWidth: "42rem",
                marginTop: "1.5rem",
                color: "rgb(247 241 229 / 0.78)",
                fontSize: "1.2rem",
                lineHeight: 1.45,
              }}
            >
              {article.content.dek}
            </p>
            <div
              className="today-card__meta"
              style={{
                justifyContent: "flex-start",
                marginTop: "2rem",
                color: "rgb(247 241 229 / 0.72)",
              }}
            >
              <time dateTime={article.publishedAt}>
                {formatPublishedDate(article.publishedAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{article.content.readingMinutes} min read</span>
            </div>
          </div>
        </div>
      </header>

      <div
        className="site-container"
        style={{ paddingBlock: "clamp(3.5rem, 8vw, 7rem)" }}
      >
        <div style={{ maxWidth: "48rem", marginInline: "auto" }}>
          <p
            style={{
              maxWidth: "43rem",
              color: "var(--muted-ink)",
              fontSize: "1.2rem",
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            {article.content.summary}
          </p>

          <section
            aria-labelledby="scripture-heading"
            style={{ marginTop: "3.5rem" }}
          >
            <p className="section-kicker">Grounded in Scripture</p>
            <h2 id="scripture-heading">Scripture references</h2>
            <ul
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.65rem",
                margin: "1.5rem 0 0",
                padding: 0,
                listStyle: "none",
              }}
            >
              {article.content.scriptureRefs.map((reference) => (
                <li
                  key={reference}
                  style={{
                    padding: "0.7rem 0.9rem",
                    border: "1px solid var(--line-strong)",
                    borderRadius: "999px",
                    fontFamily: '"SFMono-Regular", Consolas, monospace',
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  <cite>{reference}</cite>
                </li>
              ))}
            </ul>
          </section>

          <div style={{ marginTop: "4rem" }}>
            {article.content.sections.map((section, index) => {
              const headingId = `article-section-${index + 1}`;

              return (
                <section
                  key={`${headingId}-${section.heading}`}
                  aria-labelledby={headingId}
                  style={{ marginTop: index === 0 ? 0 : "3rem" }}
                >
                  <h2 id={headingId}>{section.heading}</h2>
                  <p
                    style={{
                      maxWidth: "43rem",
                      marginTop: "1.1rem",
                      fontSize: "1.08rem",
                      lineHeight: 1.75,
                    }}
                  >
                    {section.body}
                  </p>
                </section>
              );
            })}
          </div>

          <section
            className="faith-workbench__panel"
            aria-labelledby="prayer-heading"
            style={{ position: "relative", marginTop: "4rem" }}
          >
            <span className="faith-workbench__panel-label">A prayer for this moment</span>
            <h2 id="prayer-heading" style={{ marginTop: "2.5rem" }}>
              Pray it honestly.
            </h2>
            <p>{article.content.prayer}</p>
          </section>
        </div>
      </div>

      <SafetyNote note={article.content.safetyNote} />
      <SourceList sources={article.sources} />
      <section aria-labelledby="related-videos-heading">
        <div
          className="site-container"
          style={{ paddingBlock: "clamp(3rem, 6vw, 5rem) 2rem" }}
        >
          <div style={{ maxWidth: "48rem", marginInline: "auto" }}>
            <p className="section-kicker">Keep exploring</p>
            <h2 id="related-videos-heading">Related videos</h2>
          </div>
        </div>
        <WatchGallery videos={article.videos} />
      </section>
    </article>
  );
}
