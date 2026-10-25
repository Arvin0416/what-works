import { expect, test } from "@playwright/test";

type VitestGlobals = {
  describe?: (name: string, suite: () => void) => void;
  it?: (name: string, testCase: () => void) => void;
};

const vitestGlobals = globalThis as typeof globalThis & VitestGlobals;

if (process.env.VITEST) {
  vitestGlobals.describe?.("private review Playwright spec", () => {
    vitestGlobals.it?.("is executed by the Playwright runner", () => undefined);
  });
} else {
  test.describe("private review flow", () => {
    test("keeps an invalid review link closed and readable on mobile", async ({
      page,
    }) => {
      await page.goto("/review?token=not-a-signed-token");

      await expect(page.getByRole("heading", { name: "Review unavailable" })).toBeVisible();
      await expect(page.getByText(/invalid or no longer available/i)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });

    test("approves the exact package and keeps a second approval idempotent", async ({
      page,
    }) => {
      const token = process.env.REVIEW_TEST_TOKEN;
      test.skip(
        !token,
        "Set REVIEW_TEST_TOKEN to a provisioned, unconsumed review token for live review-flow verification.",
      );

      const reviewUrl = `/review?token=${encodeURIComponent(token ?? "")}`;
      await page.goto(reviewUrl);

      await expect(page.getByRole("heading", { name: /Generated guide|What Works When/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Sources/ })).toBeVisible();
      await page.getByRole("button", { name: "Approve and publish" }).click();

      await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open published article" })).toBeVisible();

      await page.goto(reviewUrl);
      await expect(page.getByRole("heading", { name: "Published" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open published article" })).toBeVisible();
    });
  });
}
