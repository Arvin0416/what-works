import type { CSSProperties, ReactNode } from "react";

import { getCategoryById } from "../../lib/content/categories";
import type { ReviewPackage } from "../../lib/content/types";
import type {
  ReviewAccessStatus,
  ReviewActionResult,
} from "../../lib/workflows/approval";

interface ReviewPackageProps {
  token?: string;
  reviewPackage?: ReviewPackage;
  status: ReviewAccessStatus | ReviewActionResult["status"];
  message?: string;
}

const panelStyle: CSSProperties = {
  width: "100%",
  maxWidth: "780px",
  margin: "0 auto",
  padding: "clamp(1rem, 4vw, 2.5rem)",
  border: "1px solid var(--line-strong, #777)",
  borderRadius: "24px",
  background: "var(--paper-light, #fcf8ef)",
  boxShadow: "0 18px 36px rgb(42 33 19 / 0.1)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted-ink, #5e5a50)",
  fontFamily: "SFMono-Regular, Consolas, monospace",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  lineHeight: 1.3,
  textTransform: "uppercase",
};

const sectionStyle: CSSProperties = {
  marginTop: "2rem",
  paddingTop: "1.5rem",
  borderTop: "1px solid var(--line, rgb(23 23 19 / 0.16))",
};

export default function ReviewPackageView({
  token,
  reviewPackage,
  status,
  message,
}: ReviewPackageProps) {
  if (!reviewPackage || status !== "ready") {
    return <ReviewStatus status={status} message={message} reviewPackage={reviewPackage} />;
  }

  const article = reviewPackage.article;
  const category = getCategoryById(article.content.categoryId);

  return (
    <main id="main-content" style={{ padding: "2rem 1rem 4rem" }}>
      <article style={panelStyle}>
        <p style={eyebrowStyle}>Private review · exact generated version</p>
        <h1
          style={{
            margin: "0.75rem 0 0",
            fontSize: "clamp(2rem, 7vw, 4rem)",
            lineHeight: 1,
            letterSpacing: "-0.055em",
          }}
        >
          {article.content.title}
        </h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.65rem 1rem",
            marginTop: "1rem",
            color: "var(--muted-ink, #5e5a50)",
            fontSize: "0.9rem",
            fontWeight: 700,
          }}
        >
          <span>{category?.label ?? article.content.categoryId}</span>
          <span aria-hidden="true">·</span>
          <span>{article.content.readingMinutes} min read</span>
          <span aria-hidden="true">·</span>
          <span>{article.status}</span>
        </div>

        <p style={{ margin: "1.5rem 0 0", fontSize: "1.15rem", lineHeight: 1.55 }}>
          {article.content.dek}
        </p>
        <p style={{ margin: "1rem 0 0", color: "var(--muted-ink, #5e5a50)", lineHeight: 1.65 }}>
          {article.content.summary}
        </p>

        <ReviewContent reviewPackage={reviewPackage} />

        {token ? <ReviewActions token={token} /> : null}
      </article>
    </main>
  );
}

function ReviewContent({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  const article = reviewPackage.article;

  return (
    <>
      <section aria-labelledby="review-sections" style={sectionStyle}>
        <h2 id="review-sections" style={{ margin: 0, fontSize: "1.55rem" }}>
          Generated guide
        </h2>
        <div style={{ display: "grid", gap: "1.5rem", marginTop: "1.25rem" }}>
          {article.content.sections.map((section) => (
            <div key={section.heading}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", lineHeight: 1.15 }}>
                {section.heading}
              </h3>
              <p style={{ margin: "0.55rem 0 0", lineHeight: 1.7 }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="review-scripture" style={sectionStyle}>
        <h2 id="review-scripture" style={{ margin: 0, fontSize: "1.55rem" }}>
          Scripture references
        </h2>
        <ul style={{ margin: "1rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          {article.content.scriptureRefs.map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="review-prayer" style={sectionStyle}>
        <h2 id="review-prayer" style={{ margin: 0, fontSize: "1.55rem" }}>
          Prayer
        </h2>
        <p style={{ margin: "1rem 0 0", lineHeight: 1.7 }}>{article.content.prayer}</p>
      </section>

      <section
        aria-labelledby="review-safety-note"
        style={{
          ...sectionStyle,
          padding: "1rem",
          border: "1px solid rgb(244 124 98 / 0.55)",
          borderRadius: "16px",
          background: "rgb(244 124 98 / 0.16)",
        }}
      >
        <h2 id="review-safety-note" style={{ margin: 0, fontSize: "1.25rem" }}>
          Safety note
        </h2>
        <p style={{ margin: "0.75rem 0 0", lineHeight: 1.65 }}>
          {article.content.safetyNote}
        </p>
      </section>

      <ReviewValidation reviewPackage={reviewPackage} />
      <ReviewSources reviewPackage={reviewPackage} />
      <ReviewVideos reviewPackage={reviewPackage} />
    </>
  );
}

function ReviewValidation({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  const { validation } = reviewPackage;

  return (
    <section aria-labelledby="review-validation" style={sectionStyle}>
      <h2 id="review-validation" style={{ margin: 0, fontSize: "1.55rem" }}>
        Validation
      </h2>
      <p style={{ margin: "0.8rem 0 0", fontWeight: 800 }}>
        {validation.passed ? "Passed automated checks" : "Blocked pending human review"}
      </p>
      {validation.warnings.length > 0 ? (
        <NoticeList label="Warnings" items={validation.warnings} tone="warning" />
      ) : null}
      {validation.blockedReasons.length > 0 ? (
        <NoticeList label="Blocked reasons" items={validation.blockedReasons} tone="danger" />
      ) : null}
    </section>
  );
}

function NoticeList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "warning" | "danger";
}) {
  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: "14px",
        background: tone === "danger" ? "rgb(244 124 98 / 0.2)" : "rgb(201 243 91 / 0.35)",
      }}
    >
      <strong>{label}</strong>
      <ul style={{ margin: "0.6rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.6 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function ReviewSources({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <section aria-labelledby="review-sources" style={sectionStyle}>
      <h2 id="review-sources" style={{ margin: 0, fontSize: "1.55rem" }}>
        Sources ({reviewPackage.article.sources.length})
      </h2>
      <ul style={{ margin: "1rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.6 }}>
        {reviewPackage.article.sources.map((source) => (
          <li key={source.url} style={{ marginBottom: "0.75rem" }}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <span style={{ display: "block", color: "var(--muted-ink, #5e5a50)", fontSize: "0.9rem" }}>
              {source.publisher} · {source.claimUse}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewVideos({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <section aria-labelledby="review-videos" style={sectionStyle}>
      <h2 id="review-videos" style={{ margin: 0, fontSize: "1.55rem" }}>
        Video recommendations ({reviewPackage.article.videos.length})
      </h2>
      <div style={{ display: "grid", gap: "0.9rem", marginTop: "1rem" }}>
        {reviewPackage.article.videos.map((video) => (
          <a
            key={video.videoId}
            href={video.watchUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "1rem",
              border: "1px solid var(--line-strong, #777)",
              borderRadius: "14px",
              textDecoration: "none",
            }}
          >
            <strong style={{ display: "block", lineHeight: 1.25 }}>{video.title}</strong>
            <span style={{ display: "block", marginTop: "0.35rem", color: "var(--muted-ink, #5e5a50)", fontSize: "0.9rem" }}>
              {video.channelName}
              {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ""}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function ReviewActions({ token }: { token: string }) {
  const formStyle: CSSProperties = {
    display: "grid",
    gap: "0.75rem",
    padding: "1rem",
    borderRadius: "16px",
    background: "var(--paper-deep, #e9dfcf)",
  };
  const buttonStyle: CSSProperties = {
    minHeight: "3rem",
    padding: "0.75rem 1rem",
    border: "1px solid var(--ink, #171713)",
    borderRadius: "999px",
    background: "var(--ink-surface, #171713)",
    color: "var(--ink-surface-text, #f7f1e5)",
    cursor: "pointer",
    fontWeight: 800,
  };

  return (
    <section aria-labelledby="review-actions" style={sectionStyle}>
      <h2 id="review-actions" style={{ margin: 0, fontSize: "1.55rem" }}>
        Choose what happens next
      </h2>
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        <form action={`/api/review/${encodeURIComponent(token)}`} method="post" style={formStyle}>
          <input type="hidden" name="action" value="approve" />
          <button type="submit" style={{ ...buttonStyle, background: "var(--acid-green, #c9f35b)", color: "var(--ink, #171713)" }}>
            Approve and publish
          </button>
        </form>

        <form action={`/api/review/${encodeURIComponent(token)}`} method="post" style={formStyle}>
          <input type="hidden" name="action" value="request_changes" />
          <label htmlFor="review-feedback" style={{ fontWeight: 800 }}>
            Request changes
          </label>
          <textarea
            id="review-feedback"
            name="feedback"
            required
            rows={5}
            placeholder="What should the next draft improve?"
            style={{ width: "100%", minHeight: "8rem", padding: "0.8rem", border: "1px solid var(--line-strong, #777)", borderRadius: "12px", background: "var(--paper-light, #fcf8ef)", color: "var(--ink, #171713)", lineHeight: 1.5, resize: "vertical" }}
          />
          <button type="submit" style={buttonStyle}>
            Send feedback
          </button>
        </form>

        <form action={`/api/review/${encodeURIComponent(token)}`} method="post" style={formStyle}>
          <input type="hidden" name="action" value="reject" />
          <button type="submit" style={{ ...buttonStyle, background: "transparent", color: "var(--ink, #171713)" }}>
            Reject this draft
          </button>
        </form>
      </div>
    </section>
  );
}

function ReviewStatus({
  status,
  message,
  reviewPackage,
}: {
  status: ReviewPackageProps["status"];
  message?: string;
  reviewPackage?: ReviewPackage;
}) {
  const article = reviewPackage?.article;
  const published = status === "published" && article?.slug;

  return (
    <main id="main-content" style={{ padding: "2rem 1rem 4rem" }}>
      <section style={panelStyle} aria-live="polite">
        <p style={eyebrowStyle}>What Works Daily · private review</p>
        <h1 style={{ margin: "0.75rem 0 0", fontSize: "clamp(2rem, 7vw, 3.5rem)", lineHeight: 1 }}>
          {status === "published"
            ? "Published"
            : status === "rejected"
              ? "Review closed"
              : status === "drafted"
                ? "Changes requested"
                : status === "consumed"
                  ? "Link already used"
                  : "Review unavailable"}
        </h1>
        <p style={{ margin: "1.25rem 0 0", color: "var(--muted-ink, #5e5a50)", lineHeight: 1.65 }}>
          {message ?? "This review package is not available for another action."}
        </p>
        {published ? (
          <a className="button button--acid" href={`/articles/${article.slug}`} style={{ display: "inline-flex", marginTop: "1.5rem", padding: "0.8rem 1.25rem", borderRadius: "999px", background: "var(--acid-green, #c9f35b)", color: "var(--ink, #171713)", fontWeight: 800, textDecoration: "none" }}>
            Open published article
          </a>
        ) : null}
      </section>
    </main>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function ReviewPageShell({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "var(--paper, #f7f1e5)", color: "var(--ink, #171713)" }}>{children}</div>;
}
