import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeySpecsStrip, resolveSpecValue } from "../KeySpecsStrip";

const t = (key: string) => key;

function renderKeySpecs(specifics: Record<string, unknown>) {
  return render(
    <KeySpecsStrip
      categoryType="real_estate"
      specifics={specifics}
      locale="en"
      makeName={null}
      modelName={null}
      location="Antwerp"
      t={t}
    />,
  );
}

describe("KeySpecsStrip", () => {
  it("renders chips from canonical keys", () => {
    renderKeySpecs({
      listing_type: "sale",
      property_type: "Apartment",
    });

    expect(screen.getByText("Apartment")).toBeInTheDocument();
  });

  it("renders chips from alternative writer keys", () => {
    render(
      <KeySpecsStrip
        categoryType="jobs"
        specifics={{
          job_category_id: "Healthcare",
          contract_type_id: "Permanent",
        }}
        locale="en"
        makeName={null}
        modelName={null}
        location="Brussels"
        t={t}
      />,
    );

    expect(screen.getByText("Healthcare")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
  });

  it("does not render uuid-like values as chips", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";

    renderKeySpecs({
      listing_type: "sale",
      property_type_id: uuid,
    });

    expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    expect(resolveSpecValue({ property_type_id: uuid }, "property_type_id")).toBeNull();
  });

  it("renders null when there are not enough visible chips", () => {
    const { container } = render(
      <KeySpecsStrip
        categoryType="real_estate"
        specifics={{}}
        locale="en"
        makeName={null}
        modelName={null}
        location={null}
        t={t}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
