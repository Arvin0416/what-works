import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runDailyGeneration } from "../../../../lib/workflows/daily-generation";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runGeneration(request);
}

/**
 * Vercel Cron invokes configured paths with GET. Keep the same authorization
 * and workflow handler as the manual POST path so scheduling cannot bypass
 * the CRON_SECRET gate.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runGeneration(request);
}

async function runGeneration(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { status: "unauthorized", message: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runDailyGeneration();

    return NextResponse.json(result, {
      status: result.status === "needs_review" ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "failed",
        message: "Daily generation could not be completed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!configuredSecret || !providedSecret) {
    return false;
  }

  const expected = Buffer.from(configuredSecret, "utf8");
  const provided = Buffer.from(providedSecret, "utf8");

  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}
