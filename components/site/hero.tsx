import { SectionLabel } from "./section-label";
import { PointerTilt } from "./pointer-tilt";
import { ScrollReveal } from "./scroll-reveal";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="site-container hero__grid">
        <ScrollReveal className="hero__copy" rootMargin="0px 0px -4% 0px">
          <SectionLabel>What Works Daily</SectionLabel>
          <h1 id="hero-heading">When life gets real, find what works.</h1>
          <p className="hero__lede">
            Short, Scripture-informed guides for ordinary struggles, written to
            help you take one honest next step toward Jesus.
          </p>
          <div className="hero__actions">
            <a className="button button--ink" href="#today-article">
              Read today&apos;s guide
            </a>
            <a className="text-link" href="#struggles">
              Browse by struggle
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hero__visual" rootMargin="0px 0px -4% 0px">
          <PointerTilt className="hero__art-interactive">
            <div className="hero__art" aria-hidden="true">
              <div className="hero__art-top">
                <span>Faith field guide</span>
                <span>For real life</span>
              </div>
              <p className="hero__art-word">
                what
                <br />
                works
              </p>
              <div className="hero__art-note">
                <span>Start here</span>
                <strong>One honest next step.</strong>
              </div>
              <span className="hero__art-block hero__art-block--acid" />
              <span className="hero__art-block hero__art-block--coral" />
            </div>
          </PointerTilt>
        </ScrollReveal>
      </div>
    </section>
  );
}
