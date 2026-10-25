import { expect, test } from "@playwright/test";

import { seedArticle } from "../../lib/content/seed";

type VitestGlobals = {
  describe?: (name: string, suite: () => void) => void;
  it?: (name: string, testCase: () => void) => void;
};

const vitestGlobals = globalThis as typeof globalThis & VitestGlobals;

if (process.env.VITEST) {
  vitestGlobals.describe?.("public article reader Playwright spec", () => {
    vitestGlobals.it?.("is executed by the Playwright runner", () => undefined);
  });
} else {
  test.describe("public article reader", () => {
    test("opens the published guide with sources and YouTube destinations", async ({
      page,
    }) => {
      await page.goto("/");
      await page
        .locator("#today-article")
        .getByRole("link", { name: "Read today's guide" })
        .click();

      await expect(page).toHaveURL(
        new RegExp(`/articles/${seedArticle.slug}$`),
      );
      await expect(
        page.getByRole("heading", { name: seedArticle.content.title }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

      const videoLinks = page.getByRole("link", {
        name: /Watch .* on YouTube/i,
      });

      await expect(videoLinks).toHaveCount(seedArticle.videos.length);
      for (let index = 0; index < seedArticle.videos.length; index += 1) {
        await expect(videoLinks.nth(index)).toHaveAttribute(
          "href",
          /^https:\/\/(?:www\.youtube\.com|youtu\.be)\//,
        );
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  });
}
