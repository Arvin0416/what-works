import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleReader } from "../../components/site/article-reader";
import {
  getPublishedArticleBySlug,
  getPublishedArticleSlugs,
} from "../../lib/content/article-slugs";
import { seedArticle } from "../../lib/content/seed";
import type { PublishedArticle } from "../../lib/content/types";
import { renderPage } from "../utils/render-page";

describe("ArticleReader", () => {
  it("renders Scripture references, linked sources, safety guidance, and prayer", () => {
    renderPage(<ArticleReader article={seedArticle} />);

    expect(
      screen.getByRole("heading", { name: seedArticle.content.title }),
    ).toBeInTheDocument();

    for (const scriptureRef of seedArticle.content.scriptureRefs) {
      expect(screen.getByText(scriptureRef)).toBeInTheDocument();
    }

    for (const source of seedArticle.sources) {
      expect(
        screen.getByRole("link", { name: source.title }),
      ).toHaveAttribute("href", source.url);
    }

    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Related videos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: /a note on safety/i }),
    ).toHaveTextContent(seedArticle.content.safetyNote);
    expect(screen.getByText(seedArticle.content.prayer)).toBeInTheDocument();
  });

  it("does not render a non-published article", () => {
    const nonPublishedArticle = {
      ...seedArticle,
      status: "drafted",
    } as unknown as PublishedArticle;

    const { container } = renderPage(
      <ArticleReader article={nonPublishedArticle} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("published article boundary", () => {
  it("returns the seed article only for its published slug", async () => {
    await expect(getPublishedArticleBySlug(seedArticle.slug)).resolves.toEqual(
      seedArticle,
    );
    await expect(
      getPublishedArticleBySlug("not-a-published-article"),
    ).resolves.toBeNull();
    expect(getPublishedArticleSlugs()).toEqual([seedArticle.slug]);
  });
});
