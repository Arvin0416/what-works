import type * as React from "react";
import { render } from "@testing-library/react";

export function renderPage(element: React.ReactElement) {
  return render(element);
}
