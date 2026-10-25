import type { CSSProperties, ReactElement } from "react";

import { getCategoryById } from "../content/categories";
import type { ReviewPackage } from "../content/types";

export interface ReviewEmailTemplateProps {
  reviewPackage: ReviewPackage;
  reviewUrl: string;
}

const colors = {
  paper: "#f7f1e5",
  paperLight: "#fcf8ef",
  ink: "#171713",
  muted: "#5e5a50",
  acid: "#c9f35b",
  coral: "#f47c62",
} as const;

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: "24px 12px",
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "620px",
    margin: "0 auto",
    overflow: "hidden",
    border: `1px solid ${colors.ink}`,
    borderRadius: "20px",
    backgroundColor: colors.paperLight,
  },
  header: {
    padding: "28px 24px 24px",
    backgroundColor: colors.ink,
    color: colors.paper,
  },
  eyebrow: {
    margin: 0,
    color: colors.acid,
    fontFamily: "Courier New, monospace",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
  },
  title: {
    margin: "14px 0 0",
    color: colors.paper,
    fontSize: "30px",
    lineHeight: 1.08,
  },
  content: {
    padding: "28px 24px 24px",
  },
  intro: {
    margin: "0 0 22px",
    color: colors.muted,
    fontSize: "16px",
    lineHeight: 1.55,
  },
  metadata: {
    width: "100%",
    margin: "0 0 24px",
    borderCollapse: "collapse",
  },
  metadataCell: {
    padding: "12px 10px 12px 0",
    borderTop: `1px solid ${colors.ink}33`,
    color: colors.muted,
    fontSize: "13px",
    lineHeight: 1.35,
  },
  metadataValue: {
    padding: "12px 0",
    borderTop: `1px solid ${colors.ink}33`,
    color: colors.ink,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
    textAlign: "right",
  },
  button: {
    display: "inline-block",
    padding: "14px 20px",
    borderRadius: "999px",
    backgroundColor: colors.acid,
    color: colors.ink,
    fontSize: "15px",
    fontWeight: 700,
    textDecoration: "none",
  },
  note: {
    margin: "22px 0 0",
    color: colors.muted,
    fontSize: "12px",
    lineHeight: 1.5,
  },
  footer: {
    padding: "18px 24px 22px",
    backgroundColor: `${colors.coral}44`,
    color: colors.muted,
    fontSize: "12px",
    lineHeight: 1.5,
  },
};

export function getReviewEmailSubject(reviewPackage: ReviewPackage): string {
  return `Review needed: ${reviewPackage.article.content.title}`;
}

export function ReviewEmailTemplate({
  reviewPackage,
  reviewUrl,
}: ReviewEmailTemplateProps): ReactElement {
  const article = reviewPackage.article;
  const category = getCategoryById(article.content.categoryId);
  const categoryLabel = category?.label ?? article.content.categoryId;

  return (
    <html>
      <body style={styles.body}>
        <table role="presentation" style={styles.card}>
          <tbody>
            <tr>
              <td style={styles.header}>
                <p style={styles.eyebrow}>What Works Daily · private review</p>
                <h1 style={styles.title}>{article.content.title}</h1>
              </td>
            </tr>
            <tr>
              <td style={styles.content}>
                <p style={styles.intro}>
                  A new article is ready for your review. Read the exact draft,
                  check its sources, and choose what should happen next.
                </p>
                <table role="presentation" style={styles.metadata}>
                  <tbody>
                    <tr>
                      <td style={styles.metadataCell}>Category</td>
                      <td style={styles.metadataValue}>{categoryLabel}</td>
                    </tr>
                    <tr>
                      <td style={styles.metadataCell}>Sources</td>
                      <td style={styles.metadataValue}>{article.sources.length}</td>
                    </tr>
                    <tr>
                      <td style={styles.metadataCell}>Videos</td>
                      <td style={styles.metadataValue}>{article.videos.length}</td>
                    </tr>
                  </tbody>
                </table>
                <a href={reviewUrl} style={styles.button}>
                  Open private review
                </a>
                <p style={styles.note}>
                  This single-use review link expires in five days. It is for
                  the owner review flow and should not be forwarded.
                </p>
              </td>
            </tr>
            <tr>
              <td style={styles.footer}>
                What Works Daily is a review-first publication. Generated
                articles remain private until they are explicitly approved.
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function getReviewEmailText(
  reviewPackage: ReviewPackage,
  reviewUrl: string,
): string {
  const article = reviewPackage.article;
  const category = getCategoryById(article.content.categoryId);

  return [
    "What Works Daily — private review",
    "",
    article.content.title,
    category?.label ?? article.content.categoryId,
    `${article.sources.length} sources · ${article.videos.length} videos`,
    "",
    "Open private review:",
    reviewUrl,
    "",
    "This single-use review link expires in five days.",
  ].join("\n");
}

/**
 * Render the same compact email without pulling react-dom/server into the
 * Next route bundle. Values are escaped because this string crosses an HTML
 * boundary, including the bearer URL in the button href.
 */
export function renderReviewEmailHtml({
  reviewPackage,
  reviewUrl,
}: ReviewEmailTemplateProps): string {
  const article = reviewPackage.article;
  const category = getCategoryById(article.content.categoryId);
  const title = escapeHtml(article.content.title);
  const categoryLabel = escapeHtml(category?.label ?? article.content.categoryId);
  const safeReviewUrl = escapeHtml(reviewUrl);

  return `<!doctype html>
<html lang="en">
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:24px 12px;background:#f7f1e5;color:#171713;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" style="width:100%;max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #171713;border-radius:20px;background:#fcf8ef;">
      <tr>
        <td style="padding:28px 24px 24px;background:#171713;color:#f7f1e5;">
          <p style="margin:0;color:#c9f35b;font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">What Works Daily · private review</p>
          <h1 style="margin:14px 0 0;color:#f7f1e5;font-size:30px;line-height:1.08;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px 24px;">
          <p style="margin:0 0 22px;color:#5e5a50;font-size:16px;line-height:1.55;">A new article is ready for your review. Read the exact draft, check its sources, and choose what should happen next.</p>
          <table role="presentation" width="100%" style="width:100%;margin:0 0 24px;border-collapse:collapse;">
            <tr><td style="padding:12px 10px 12px 0;border-top:1px solid #17171333;color:#5e5a50;font-size:13px;">Category</td><td style="padding:12px 0;border-top:1px solid #17171333;color:#171713;font-size:14px;font-weight:700;text-align:right;">${categoryLabel}</td></tr>
            <tr><td style="padding:12px 10px 12px 0;border-top:1px solid #17171333;color:#5e5a50;font-size:13px;">Sources</td><td style="padding:12px 0;border-top:1px solid #17171333;color:#171713;font-size:14px;font-weight:700;text-align:right;">${article.sources.length}</td></tr>
            <tr><td style="padding:12px 10px 12px 0;border-top:1px solid #17171333;color:#5e5a50;font-size:13px;">Videos</td><td style="padding:12px 0;border-top:1px solid #17171333;color:#171713;font-size:14px;font-weight:700;text-align:right;">${article.videos.length}</td></tr>
          </table>
          <a href="${safeReviewUrl}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#c9f35b;color:#171713;font-size:15px;font-weight:700;text-decoration:none;">Open private review</a>
          <p style="margin:22px 0 0;color:#5e5a50;font-size:12px;line-height:1.5;">This single-use review link expires in five days. It is for the owner review flow and should not be forwarded.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 22px;background:#f47c6244;color:#5e5a50;font-size:12px;line-height:1.5;">What Works Daily is a review-first publication. Generated articles remain private until they are explicitly approved.</td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
