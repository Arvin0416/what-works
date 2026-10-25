import {
  consumeApprovalToken,
  getApprovalTokenRecord,
} from "../db/repositories/approvals";
import { getDatabase } from "../db/client";
import {
  createDatabaseRepository,
  type ContentRepository,
} from "../db/repositories";
import {
  getApprovalTokenHash,
  getVerifiedApprovalTokenPayload,
  inMemoryApprovalTokenStore,
  verifyApprovalToken,
  type ApprovalTokenStore,
  type PersistedApprovalToken,
} from "../notifications/approval-tokens";

export type ReviewAction = "approve" | "request_changes" | "reject";

export type ReviewAccessStatus =
  | "ready"
  | "invalid"
  | "expired"
  | "consumed"
  | "not_found"
  | "closed"
  | "rejected"
  | "published";

export interface ReviewActionResult {
  status:
    | ReviewAccessStatus
    | "approved"
    | "drafted"
    | "needs_review";
  versionId: string;
  publishedSlug?: string;
  message?: string;
}

export interface ReviewLookupResult {
  status: ReviewAccessStatus;
  versionId?: string;
  reviewPackage?: Awaited<ReturnType<ContentRepository["getReviewPackage"]>>;
  message?: string;
}

export interface ApprovalWorkflowOptions {
  repository?: ContentRepository;
  tokenStore?: ApprovalTokenStore;
  secret?: string;
  now?: () => Date;
  onFeedback?: (input: {
    versionId: string;
    feedback: string;
  }) => void | Promise<void>;
}

const SAFE_MESSAGES = {
  invalid: "This review link is invalid or no longer available.",
  expired: "This review link has expired. Generate a new review email to continue.",
  consumed: "This review link has already been used.",
  not_found: "This review package is no longer available.",
  closed: "This review package is already closed.",
  rejected: "This article was rejected and will not be published.",
  published: "This article has already been published.",
} as const;

export async function getReviewPackageForToken(
  token: string,
  options: ApprovalWorkflowOptions = {},
): Promise<ReviewLookupResult> {
  const now = (options.now ?? (() => new Date()))();
  const signedPayload = getVerifiedApprovalTokenPayload(token, {
    secret: options.secret,
    // Verify the signature while allowing this function to distinguish an
    // authentic-but-expired token from a malformed or tampered one.
    now: () => new Date(0),
  });

  if (!signedPayload) {
    return { status: "invalid", message: SAFE_MESSAGES.invalid };
  }

  if (signedPayload.expiresAt <= now.getTime()) {
    return {
      status: "expired",
      versionId: signedPayload.versionId,
      message: SAFE_MESSAGES.expired,
    };
  }

  if (
    !verifyApprovalToken(token, {
      secret: options.secret,
      now: () => now,
    })
  ) {
    return { status: "invalid", message: SAFE_MESSAGES.invalid };
  }

  const versionId = signedPayload.versionId;
  const tokenHash = getApprovalTokenHash(token);
  let tokenStore: ApprovalTokenStore;

  try {
    tokenStore = getTokenStore(options);
  } catch {
    return {
      status: "not_found",
      versionId,
      message: SAFE_MESSAGES.not_found,
    };
  }

  let persistedToken: PersistedApprovalToken | null;

  try {
    persistedToken = await tokenStore.find(tokenHash);
  } catch {
    return {
      status: "not_found",
      versionId,
      message: SAFE_MESSAGES.not_found,
    };
  }

  if (
    !persistedToken ||
    persistedToken.versionId !== versionId ||
    persistedToken.action !== "review"
  ) {
    return {
      status: "not_found",
      versionId,
      message: SAFE_MESSAGES.not_found,
    };
  }

  if (persistedToken.expiresAt.getTime() <= now.getTime()) {
    return {
      status: "expired",
      versionId,
      message: SAFE_MESSAGES.expired,
    };
  }

  let reviewPackage: Awaited<
    ReturnType<ContentRepository["getReviewPackage"]>
  >;

  try {
    reviewPackage = await getRepository(options).getReviewPackage(versionId);
  } catch {
    return {
      status: "not_found",
      versionId,
      message: SAFE_MESSAGES.not_found,
    };
  }

  if (!reviewPackage) {
    return {
      status: "not_found",
      versionId,
      message: SAFE_MESSAGES.not_found,
    };
  }

  const articleStatus = reviewPackage.article.status;

  if (articleStatus === "published") {
    return {
      status: "published",
      versionId,
      reviewPackage,
      message: SAFE_MESSAGES.published,
    };
  }

  if (articleStatus === "rejected") {
    return {
      status: "rejected",
      versionId,
      reviewPackage,
      message: SAFE_MESSAGES.rejected,
    };
  }

  if (persistedToken.consumedAt) {
    return {
      status: "consumed",
      versionId,
      reviewPackage,
      message: SAFE_MESSAGES.consumed,
    };
  }

  if (reviewPackage.article.status !== "needs_review") {
    return {
      status: "closed",
      versionId,
      reviewPackage,
      message: SAFE_MESSAGES.closed,
    };
  }

  return { status: "ready", versionId, reviewPackage };
}

export async function applyReviewAction(
  input: {
    token: string;
    action: ReviewAction;
    feedback?: string;
  },
  options: ApprovalWorkflowOptions = {},
): Promise<ReviewActionResult> {
  if (
    input.action !== "approve" &&
    input.action !== "request_changes" &&
    input.action !== "reject"
  ) {
    return {
      status: "invalid",
      versionId: "",
      message: "A valid review action is required.",
    };
  }

  const initialLookup = await getReviewPackageForToken(input.token, options);
  const versionId =
    initialLookup.versionId ??
    getVerifiedApprovalTokenPayload(input.token, {
      secret: options.secret,
      now: () => new Date(0),
    })?.versionId ??
    "";

  if (initialLookup.status === "published" && input.action === "approve") {
    return {
      status: "published",
      versionId,
      publishedSlug: initialLookup.reviewPackage?.article.slug,
      message: SAFE_MESSAGES.published,
    };
  }

  if (initialLookup.status !== "ready" || !initialLookup.reviewPackage) {
    return {
      status: initialLookup.status,
      versionId,
      message: initialLookup.message,
    };
  }

  const feedback = input.feedback?.trim();

  if (input.action === "request_changes" && !feedback) {
    return {
      status: "invalid",
      versionId,
      message: "Feedback is required when requesting changes.",
    };
  }

  let consumed: boolean;

  try {
    consumed = await getTokenStore(options).consume(
      getApprovalTokenHash(input.token),
      (options.now ?? (() => new Date()))(),
    );
  } catch {
    return {
      status: "closed",
      versionId,
      message: SAFE_MESSAGES.closed,
    };
  }

  if (!consumed) {
    const afterRace = await getReviewPackageForToken(input.token, options);

    if (afterRace.status === "published" && input.action === "approve") {
      return {
        status: "published",
        versionId,
        publishedSlug: afterRace.reviewPackage?.article.slug,
        message: SAFE_MESSAGES.published,
      };
    }

    return {
      status: "consumed",
      versionId,
      message: SAFE_MESSAGES.consumed,
    };
  }

  try {
    const repository = getRepository(options);

    if (input.action === "approve") {
      await repository.transitionArticleStatus({
        versionId,
        from: "needs_review",
        to: "approved",
      });
      await repository.transitionArticleStatus({
        versionId,
        from: "approved",
        to: "published",
      });

      return {
        status: "published",
        versionId,
        publishedSlug: initialLookup.reviewPackage.article.slug,
        message: SAFE_MESSAGES.published,
      };
    }

    if (input.action === "request_changes") {
      await repository.transitionArticleStatus({
        versionId,
        from: "needs_review",
        to: "drafted",
      });

      if (feedback && options.onFeedback) {
        await options.onFeedback({ versionId, feedback });
      }

      return {
        status: "drafted",
        versionId,
        message: "Changes requested. The package is closed until a new draft is generated.",
      };
    }

    await repository.transitionArticleStatus({
      versionId,
      from: "needs_review",
      to: "rejected",
    });

    return {
      status: "rejected",
      versionId,
      message: SAFE_MESSAGES.rejected,
    };
  } catch {
    if (input.action === "approve") {
      try {
        const latestPackage = await getRepository(options).getReviewPackage(
          versionId,
        );

        if (latestPackage?.article.status === "published") {
          return {
            status: "published",
            versionId,
            publishedSlug: latestPackage.article.slug,
            message: SAFE_MESSAGES.published,
          };
        }
      } catch {
        // Fall through to the same safe closed response.
      }
    }

    return {
      status: "closed",
      versionId,
      message: SAFE_MESSAGES.closed,
    };
  }
}

function getRepository(options: ApprovalWorkflowOptions): ContentRepository {
  if (options.repository) {
    return options.repository;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for private review packages.");
  }

  return createDatabaseRepository(getDatabase());
}

function getTokenStore(options: ApprovalWorkflowOptions): ApprovalTokenStore {
  if (options.tokenStore) {
    return options.tokenStore;
  }

  if (process.env.DATABASE_URL?.trim()) {
    const database = getDatabase();

    return {
      save: async () => undefined,
      find: (tokenHash) => getApprovalTokenRecord(database, tokenHash),
      consume: (tokenHash, now) => consumeApprovalToken(database, tokenHash, now),
    };
  }

  return inMemoryApprovalTokenStore;
}

export function getReviewStatusMessage(status: ReviewAccessStatus): string {
  return status === "ready" ? "" : SAFE_MESSAGES[status];
}
