import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  applyReviewAction,
  getReviewPackageForToken,
  type ReviewAction,
} from "../../../../lib/workflows/approval";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const token = await getToken(context);
  const result = await getReviewPackageForToken(token);

  return NextResponse.json(
    {
      status: result.status,
      versionId: result.versionId,
      message: result.message,
      ...(result.status === "ready"
        ? { reviewPackage: result.reviewPackage }
        : {}),
    },
    {
      status: accessStatusCode(result.status),
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const token = await getToken(context);
  const formData = await request.formData();
  const actionValue = formData.get("action");

  if (
    actionValue !== "approve" &&
    actionValue !== "request_changes" &&
    actionValue !== "reject"
  ) {
    return NextResponse.json(
      { status: "invalid", message: "A valid review action is required." },
      { status: 400 },
    );
  }

  const feedbackValue = formData.get("feedback");
  const feedback =
    typeof feedbackValue === "string" ? feedbackValue.trim() : undefined;
  const result = await applyReviewAction(
    {
      token,
      action: actionValue as ReviewAction,
      feedback,
    },
  );

  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json(result, {
      status: actionStatusCode(result.status),
      headers: { "Cache-Control": "no-store" },
    });
  }

  const redirectUrl = new URL("/review", request.url);
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("status", result.status);

  const response = NextResponse.redirect(redirectUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function getToken(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.token;
}

function accessStatusCode(status: string): number {
  if (status === "ready" || status === "published" || status === "rejected") {
    return 200;
  }

  if (status === "expired" || status === "consumed" || status === "closed") {
    return 410;
  }

  return 404;
}

function actionStatusCode(status: string): number {
  return status === "invalid" || status === "not_found" || status === "expired"
    ? 400
    : 200;
}
