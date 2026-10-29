import { SiteFooter } from "../../../components/site/site-footer";
import { SiteHeader } from "../../../components/site/site-header";

export default function ArticleLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" aria-busy="true">
        <section className="today-section" aria-labelledby="loading-heading">
          <div className="site-container">
            <div style={{ maxWidth: "52rem", marginInline: "auto" }}>
              <p className="section-kicker" style={{ color: "var(--ink)" }}>
                Loading guide
              </p>
              <h1 id="loading-heading">Preparing the article…</h1>
              <p
                role="status"
                style={{
                  marginTop: "1.5rem",
                  color: "var(--muted-ink)",
                }}
              >
                The published guide is on its way.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
