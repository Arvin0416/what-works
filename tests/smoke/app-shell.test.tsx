import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";
import { renderPage } from "../utils/render-page";

describe("app shell", () => {
  it("renders the main content landmark", () => {
    renderPage(<HomePage />);

    expect(document.querySelector("main#main-content")).toBeInTheDocument();
  });
});
