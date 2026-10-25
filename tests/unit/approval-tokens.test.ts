import { afterEach, describe, expect, it } from "vitest";

import {
  APPROVAL_TOKEN_TTL_MS,
  createApprovalToken,
  getApprovalTokenHash,
  getInMemoryApprovalToken,
  getVerifiedApprovalTokenPayload,
  inMemoryApprovalTokenStore,
  verifyApprovalToken,
} from "../../lib/notifications/approval-tokens";

const secret = "unit-test-approval-secret";
const createdAt = new Date("2026-10-25T08:00:00.000Z");

describe("approval tokens", () => {
  const previousSecret = process.env.APPROVAL_SECRET;

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.APPROVAL_SECRET;
    } else {
      process.env.APPROVAL_SECRET = previousSecret;
    }
  });

  it("creates a five-day HMAC token with only review metadata", () => {
    process.env.APPROVAL_SECRET = secret;

    const token = createApprovalToken(
      { versionId: "version-123", action: "review" },
      { now: () => createdAt },
    );
    const payload = getVerifiedApprovalTokenPayload(token, {
      now: () => createdAt,
    });

    expect(verifyApprovalToken(token, { now: () => createdAt })).toEqual({
      versionId: "version-123",
      action: "review",
    });
    expect(payload?.expiresAt).toBe(
      createdAt.getTime() + APPROVAL_TOKEN_TTL_MS,
    );
    expect(payload?.nonce).toHaveLength(22);
    expect(token).not.toContain(secret);
    expect(getApprovalTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(getInMemoryApprovalToken(token)).toMatchObject({
      tokenHash: getApprovalTokenHash(token),
      versionId: "version-123",
      action: "review",
    });
  });

  it("rejects an expired token and a tampered signature", () => {
    process.env.APPROVAL_SECRET = secret;
    const token = createApprovalToken(
      { versionId: "version-expiring", action: "review" },
      { now: () => createdAt },
    );

    expect(
      verifyApprovalToken(token, {
        now: () => new Date(createdAt.getTime() + APPROVAL_TOKEN_TTL_MS),
      }),
    ).toBeNull();

    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(verifyApprovalToken(tampered, { now: () => createdAt })).toBeNull();
  });

  it("keeps GET verification side-effect free but consumes a token once", async () => {
    process.env.APPROVAL_SECRET = secret;
    const token = createApprovalToken(
      { versionId: "version-single-use", action: "review" },
      { now: () => createdAt },
    );

    expect(verifyApprovalToken(token, { now: () => createdAt })).not.toBeNull();
    expect(verifyApprovalToken(token, { now: () => createdAt })).not.toBeNull();

    const consumedAt = new Date(createdAt.getTime() + 1_000);
    expect(
      inMemoryApprovalTokenStore.consume(getApprovalTokenHash(token), consumedAt),
    ).toBe(true);
    expect(
      inMemoryApprovalTokenStore.consume(getApprovalTokenHash(token), consumedAt),
    ).toBe(false);
    expect(getInMemoryApprovalToken(token)?.consumedAt).toEqual(consumedAt);
  });
});
