import { ArticleCard } from "../components/site/article-card";
import { FaithWorkbench } from "../components/site/faith-workbench";
import { Hero } from "../components/site/hero";
import { SiteFooter } from "../components/site/site-footer";
import { SiteHeader } from "../components/site/site-header";
import { StruggleFilter } from "../components/site/struggle-filter";
import { TodayArticleCard } from "../components/site/today-article-card";
import { WatchGallery } from "../components/site/watch-gallery";
import { ScrollReveal } from "../components/site/scroll-reveal";
import { FAITH_CATEGORIES } from "../lib/content/categories";
import { getSeedPublishedArticle } from "../lib/content/public-content";

const workbenchSteps = [
  {
    id: "notice",
    label: "Notice",
    body: "Name what is happening without exaggerating it or hiding it. Start with the sentence you would say if you knew you were safe to be honest.",
  },
  {
    id: "remember",
    label: "Remember",
    body: "Return to what Scripture says about God, grace, and your next faithful choice. Let truth steady you before you rush to fix the feeling.",
  },
  {
    id: "practice",
    label: "Practice",
    body: "Choose one small response you can repeat today: pray, read, pause, apologize, ask for help, or make the wise boundary concrete.",
  },
  {
    id: "reach-out",
    label: "Reach out",
    body: "Bring a trustworthy person into the moment when the weight is too much to carry alone. Wise support is part of faithful action.",
  },
] as const;

export default function HomePage() {
  const article = getSeedPublishedArticle();

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <TodayArticleCard article={article} />
        <StruggleFilter categories={FAITH_CATEGORIES} articles={[article]} />
        <FaithWorkbench steps={[...workbenchSteps]} />
        <WatchGallery videos={article.videos} />

        <section className="archive-section" aria-labelledby="archive-heading">
          <ScrollReveal className="site-container">
            <div className="archive-section__intro">
              <div>
                <p className="section-kicker">The archive</p>
                <h2 id="archive-heading">Keep a guide close.</h2>
              </div>
              <p>
                Published guides stay available so a useful word can meet you
                again on a different day.
              </p>
            </div>
            <div className="article-card-grid article-card-grid--archive">
              <ArticleCard article={article} />
            </div>
          </ScrollReveal>
        </section>

        <section id="about" className="trust-section" aria-labelledby="about-heading">
          <ScrollReveal className="site-container">
            <div className="trust-section__intro">
              <p className="section-kicker">How we work</p>
              <h2 id="about-heading">Useful, sourced, and honest about limits.</h2>
              <p>
                What Works Daily offers original, Scripture-informed guidance.
                It does not speak for a church or ministry, and it is not a
                replacement for pastoral, medical, counseling, or emergency
                care.
              </p>
            </div>
            <div className="trust-grid">
              <article>
                <h3>Sources stay visible</h3>
                <p>
                  Scripture references and research citations are part of the
                  guide, not hidden in the background.
                </p>
              </article>
              <article>
                <h3>Recommendations are curated</h3>
                <p>
                  Video shelves use an approved channel list and send you to
                  the original YouTube destination.
                </p>
              </article>
              <article>
                <h3>Safety comes first</h3>
                <p>{article.content.safetyNote}</p>
              </article>
            </div>
          </ScrollReveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
