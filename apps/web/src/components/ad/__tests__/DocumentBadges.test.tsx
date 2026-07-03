import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentBadges } from "../DocumentBadges";

const t = (_key: string, fallback: string) => fallback;

function renderBadges(specifics: Record<string, unknown>) {
  return render(
    <DocumentBadges
      categoryType="baby_kids"
      specifics={specifics}
      t={t}
    />,
  );
}

describe("DocumentBadges", () => {
  it("renders safety badge from the canonical key", () => {
    renderBadges({ safety_certified: true });

    expect(screen.getByText("Safety certified")).toBeInTheDocument();
  });

  it("renders safety badge from the live catalog field key", () => {
    renderBadges({ catalog_field_baby_safety_certified: true });

    expect(screen.getByText("Safety certified")).toBeInTheDocument();
  });

  it("does not render badge for uuid-like values", () => {
    renderBadges({ catalog_field_baby_safety_certified: "123e4567-e89b-12d3-a456-426614174000" });

    expect(screen.queryByText("Safety certified")).not.toBeInTheDocument();
  });

  it("renders null when no badge data is present", () => {
    const { container } = renderBadges({});

    expect(container).toBeEmptyDOMElement();
  });
});
