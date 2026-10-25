import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const APPROVAL_TOKEN_TTL_MS = 5 * 24 * 60 * 60 * 1_000;
export const APPROVAL_TOKEN_ACTION = "review" as const;

export type ApprovalTokenAction = typeof APPROVAL_TOKEN_ACTION;

export interface ApprovalTokenInput {
  versionId: string;
  action: ApprovalTokenAction;
}

export interface ApprovalTokenPayload extends ApprovalTokenInput {
  expiresAt: number;
  nonce: string;
}

export interface PersistedApprovalToken {
  tokenHash: string;
  versionId: string;
  action: ApprovalTokenAction;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface ApprovalTokenStore {
  save(input: Omit<PersistedApprovalToken, "consumedAt">):
    | void
    | Promise<void>;
  find(tokenHash: string):
    | PersistedApprovalToken | null
    | Promise<PersistedApprovalToken | null>;
  consume(tokenHash: string, now: Date): boolean | Promise<boolean>;
}

export interface ApprovalTokenOptions {
  secret?: string;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
}

export class ApprovalTokenConfigurationError extends Error {
  constructor() {
    super("APPROVAL_SECRET is required for review links.");
    this.name = "ApprovalTokenConfigurationError";
  }
}

const memoryRecords = new Map<string, PersistedApprovalToken>();

/**
 * The memory store keeps local development and focused tests useful when a
 * database is intentionally absent. Production callers also persist the same
 * hash through the PostgreSQL repository before sending the email.
 */
export const inMemoryApprovalTokenStore: ApprovalTokenStore = {
  save(input) {
    const existing = memoryRecords.get(input.tokenHash);
    memoryRecords.set(input.tokenHash, {
      ...input,
      consumedAt: existing?.consumedAt ?? null,
    });
  },
  find(tokenHash) {
    return memoryRecords.get(tokenHash) ?? null;
  },
  consume(tokenHash, now) {
    const record = memoryRecords.get(tokenHash);

    if (!record || record.consumedAt || record.expiresAt <= now) {
      return false;
    }

    memoryRecords.set(tokenHash, { ...record, consumedAt: now });
    return true;
  },
};

export function getApprovalSecret(secret = process.env.APPROVAL_SECRET): string {
  const normalizedSecret = secret?.trim();

  if (!normalizedSecret) {
    throw new ApprovalTokenConfigurationError();
  }

  return normalizedSecret;
}

export function hashApprovalToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getApprovalTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + APPROVAL_TOKEN_TTL_MS);
}

/**
 * Create a compact, signed bearer token. The payload contains only the
 * private version identifier, a single-purpose action, expiry, and nonce.
 * Secrets and provider credentials never enter the payload.
 */
export function createApprovalToken(
  input: ApprovalTokenInput,
  options: ApprovalTokenOptions = {},
): string {
  assertTokenInput(input);

  const now = (options.now ?? (() => new Date()))();
  const payload: ApprovalTokenPayload = {
    versionId: input.versionId.trim(),
    action: APPROVAL_TOKEN_ACTION,
    expiresAt: getApprovalTokenExpiry(now).getTime(),
    nonce: (options.randomBytes ?? randomBytes)(16).toString("base64url"),
  };
  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload, getApprovalSecret(options.secret));
  const token = `${encodedPayload}.${signature}`;

  rememberToken(token, payload);
  return token;
}

/**
 * Verify the signature and expiry without consuming the token. GET review
 * requests call this path, so it must remain side-effect free.
 */
export function verifyApprovalToken(
  token: string,
  options: Pick<ApprovalTokenOptions, "secret" | "now"> = {},
): ApprovalTokenInput | null {
  const payload = readVerifiedPayload(token, options);

  if (!payload) {
    return null;
  }

  return {
    versionId: payload.versionId,
    action: payload.action,
  };
}

/**
 * Read verified metadata needed to create the hashed persistence record.
 * This is intentionally separate from verifyApprovalToken's small public
 * result so callers do not need to parse the bearer token themselves.
 */
export function getVerifiedApprovalTokenPayload(
  token: string,
  options: Pick<ApprovalTokenOptions, "secret" | "now"> = {},
): ApprovalTokenPayload | null {
  return readVerifiedPayload(token, options);
}

export function getApprovalTokenHash(token: string): string {
  return hashApprovalToken(token);
}

export function getInMemoryApprovalToken(token: string): PersistedApprovalToken | null {
  return memoryRecords.get(hashApprovalToken(token)) ?? null;
}

function rememberToken(token: string, payload: ApprovalTokenPayload): void {
  memoryRecords.set(hashApprovalToken(token), {
    tokenHash: hashApprovalToken(token),
    versionId: payload.versionId,
    action: payload.action,
    expiresAt: new Date(payload.expiresAt),
    consumedAt: null,
  });
}

function readVerifiedPayload(
  token: string,
  options: Pick<ApprovalTokenOptions, "secret" | "now">,
): ApprovalTokenPayload | null {
  if (!token || token.trim() !== token) {
    return null;
  }

  const segments = token.split(".");

  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    return null;
  }

  const [encodedPayload, encodedSignature] = segments;
  if (!isBase64Url(encodedPayload) || !isBase64Url(encodedSignature)) {
    return null;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  if (!isApprovalTokenPayload(payload)) {
    return null;
  }

  let expectedSignature: Buffer;
  let receivedSignature: Buffer;

  try {
    expectedSignature = Buffer.from(
      sign(encodedPayload, getApprovalSecret(options.secret)),
      "base64url",
    );
    receivedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  const now = (options.now ?? (() => new Date()))();

  if (payload.expiresAt <= now.getTime()) {
    return null;
  }

  return payload;
}

function encodePayload(payload: ApprovalTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload, "utf8")
    .digest("base64url");
}

function assertTokenInput(input: ApprovalTokenInput): void {
  if (
    input.action !== APPROVAL_TOKEN_ACTION ||
    typeof input.versionId !== "string" ||
    !input.versionId.trim()
  ) {
    throw new Error("A review token requires a non-empty version ID.");
  }
}

function isApprovalTokenPayload(
  value: unknown,
): value is ApprovalTokenPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.versionId === "string" &&
    Boolean(candidate.versionId.trim()) &&
    candidate.action === APPROVAL_TOKEN_ACTION &&
    typeof candidate.expiresAt === "number" &&
    Number.isSafeInteger(candidate.expiresAt) &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length >= 16
  );
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}
