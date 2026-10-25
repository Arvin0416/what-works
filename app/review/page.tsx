import ReviewPackageView, {
  ReviewPageShell,
} from "../../components/review/review-package";
import {
  getReviewPackageForToken,
  getReviewStatusMessage,
} from "../../lib/workflows/approval";

export const dynamic = "force-dynamic";

type ReviewPageProps = {
  searchParams: Promise<{
    token?: string | string[];
    status?: string | string[];
  }>;
};

export default async function ReviewPage({
  searchParams,
}: ReviewPageProps) {
  const params = await searchParams;
  const token = firstValue(params.token);
  const requestedStatus = firstValue(params.status);

  if (!token) {
    return (
      <ReviewPageShell>
        <ReviewPackageView
          status="invalid"
          message="Open the private review link from the owner email to view this package."
        />
      </ReviewPageShell>
    );
  }

  const result = await getReviewPackageForToken(token);
  const isChangeConfirmation =
    result.status === "consumed" &&
    requestedStatus === "drafted" &&
    result.reviewPackage?.article.status === "drafted";
  const displayStatus = isChangeConfirmation ? "drafted" : result.status;
  const displayMessage = isChangeConfirmation
    ? "Changes requested. The package is closed until a new draft is generated."
    : result.message ?? getReviewStatusMessage(result.status);

  return (
    <ReviewPageShell>
      <ReviewPackageView
        token={displayStatus === "ready" ? token : undefined}
        reviewPackage={result.reviewPackage ?? undefined}
        status={displayStatus}
        message={displayMessage}
      />
    </ReviewPageShell>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
