import type { SourceCitation } from "../../lib/content/types";

type SourceListProps = {
  sources: SourceCitation[];
};

export function SourceList({ sources }: SourceListProps) {
  return (
    <section
      className="archive-section source-list"
      aria-labelledby="sources-heading"
    >
      <div className="site-container">
        <div style={{ maxWidth: "48rem", marginInline: "auto" }}>
          <p className="section-kicker">References kept visible</p>
          <h2 id="sources-heading">Sources</h2>

          {sources.length > 0 ? (
            <ol
              style={{
                display: "grid",
                gap: "1rem",
                margin: "2rem 0 0",
                padding: 0,
                listStyle: "none",
              }}
            >
              {sources.map((source) => (
                <li
                  key={`${source.url}-${source.title}`}
                  className="article-card"
                  style={{ minHeight: "auto" }}
                >
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontWeight: 800 }}
                  >
                    {source.title}
                  </a>
                  <p style={{ marginTop: "0.5rem" }}>
                    {source.publisher} · {source.claimUse}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state" style={{ marginTop: "2rem" }}>
              No external sources were recorded for this guide.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
