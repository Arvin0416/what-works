import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer__top">
          <div className="site-footer__identity">
            <Link className="site-footer__brand" href="/">
              What Works Daily
            </Link>
            <p>
              A practical Christian publication for the moments that ask for
              honesty, wisdom, and a next step toward Jesus.
            </p>
          </div>

          <nav className="site-footer__nav" aria-label="Footer navigation">
            <a href="#today-article">Today&apos;s guide</a>
            <a href="#struggles">Browse struggles</a>
            <a href="#watch">Watch recommendations</a>
            <a href="#about">How we work</a>
          </nav>
        </div>

        <div className="site-footer__bottom">
          <p>Original writing, Scripture references, and a clear source policy.</p>
          <a href="mailto:hello@whatworks.daily">Contact the editor</a>
        </div>
      </div>
    </footer>
  );
}
