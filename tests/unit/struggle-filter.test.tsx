import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StruggleFilter } from "../../components/site/struggle-filter";
import { FAITH_CATEGORIES } from "../../lib/content/categories";
import { seedArticle } from "../../lib/content/seed";
import { renderPage } from "../utils/render-page";

describe("StruggleFilter", () => {
  it("updates the active button while keeping the guide heading available", () => {
    renderPage(
      <StruggleFilter
        categories={FAITH_CATEGORIES}
        articles={[seedArticle]}
      />,
    );

    const categoryButton = screen.getByRole("button", {
      name: "Spiritual Growth",
    });

    expect(categoryButton).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("heading", {
        name: seedArticle.content.title,
      }),
    ).toBeInTheDocument();

    fireEvent.click(categoryButton);

    expect(categoryButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", {
        name: seedArticle.content.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Spiritual Growth");
  });
});
