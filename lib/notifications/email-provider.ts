import { Resend } from "resend";

import {
  createApprovalToken,
  getApprovalTokenHash,
  getVerifiedApprovalTokenPayload,
  inMemoryApprovalTokenStore,
  type ApprovalTokenStore,
} from "./approval-tokens";
import {
  getReviewEmailSubject,
  getReviewEmailText,
  renderReviewEmailHtml,
} from "./email-templates";
import type { ReviewPackage } from "../content/types";
import { createApprovalTokenRecord } from "../db/repositories/approvals";

export interface Mailer {
  sendReviewEmail(input: ReviewPackage): Promise<void>;
}

export interface EmailTransportInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(input: EmailTransportInput): Promise<void>;
}

export interface ReviewEmailLogEntry {
  subject: string;
  reviewUrl: string;
}

export interface EmailProviderOptions {
  siteUrl?: string;
  from?: string;
  to?: string;
  secret?: string;
  now?: () => Date;
  tokenStore?: ApprovalTokenStore;
  transport?: EmailTransport;
  logger?: (entry: ReviewEmailLogEntry) => void;
}

export class EmailProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderConfigurationError";
  }
}

/**
 * Send a private review message through an injected transport, Resend, or a
 * deliberately narrow development logger. The logger receives only the
 * subject and review URL; provider credentials and article contents are not
 * rendered into logs.
 */
export async function sendReviewEmail(
  reviewPackage: ReviewPackage,
  options: EmailProviderOptions = {},
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const token = createApprovalToken(
    {
      versionId: reviewPackage.versionId,
      action: "review",
    },
    { secret: options.secret, now },
  );
  const payload = getVerifiedApprovalTokenPayload(token, {
    secret: options.secret,
    now,
  });

  if (!payload) {
    throw new Error("The generated review token could not be verified.");
  }

  await persistApprovalToken(
    {
      tokenHash: getApprovalTokenHash(token),
      versionId: payload.versionId,
      action: payload.action,
      expiresAt: new Date(payload.expiresAt),
    },
    options,
  );

  const reviewUrl = createReviewUrl(token, options.siteUrl);
  const subject = getReviewEmailSubject(reviewPackage);
  const html = renderReviewEmailHtml({ reviewPackage, reviewUrl });
  const text = getReviewEmailText(reviewPackage, reviewUrl);
  const transport =
    options.transport ??
    createResendTransport(process.env.RESEND_API_KEY?.trim());

  if (transport) {
    const from = options.from ?? process.env.EMAIL_FROM?.trim();
    const to = options.to ?? process.env.ADMIN_EMAIL?.trim();

    if (!from || !to) {
      throw new EmailProviderConfigurationError(
        "EMAIL_FROM and ADMIN_EMAIL are required for email delivery.",
      );
    }

    await transport.send({ from, to, subject, html, text });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new EmailProviderConfigurationError(
      "RESEND_API_KEY is required for production email delivery.",
    );
  }

  const logger =
    options.logger ??
    ((entry: ReviewEmailLogEntry) => {
      console.info("[what-works] review email ready", entry);
    });
  logger({ subject, reviewUrl });
}

export function createMailer(options: EmailProviderOptions = {}): Mailer {
  return {
    sendReviewEmail: (reviewPackage) =>
      sendReviewEmail(reviewPackage, options),
  };
}

export function createReviewUrl(
  token: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
): string {
  const url = new URL("/review", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function persistApprovalToken(
  input: {
    tokenHash: string;
    versionId: string;
    action: "review";
    expiresAt: Date;
  },
  options: EmailProviderOptions,
): Promise<void> {
  if (options.tokenStore) {
    await options.tokenStore.save(input);
    return;
  }

  if (process.env.DATABASE_URL?.trim()) {
    const { getDatabase } = await import("../db/client");
    await createApprovalTokenRecord(getDatabase(), input);
    return;
  }

  // createApprovalToken already records the hash in this local store. The
  // explicit call documents the development fallback and keeps this function
  // correct if token creation later becomes configurable.
  await inMemoryApprovalTokenStore.save(input);
}

function createResendTransport(apiKey: string | undefined): EmailTransport | null {
  if (!apiKey) {
    return null;
  }

  const resend = new Resend(apiKey);

  return {
    async send(input) {
      const result = await resend.emails.send({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      if (result.error) {
        throw new Error("Resend rejected the review email.");
      }
    },
  };
}
