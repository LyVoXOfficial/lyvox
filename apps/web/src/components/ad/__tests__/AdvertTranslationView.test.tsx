import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdvertTranslatedDescription,
  AdvertTranslatedTitle,
  AdvertTranslationControls,
  AdvertTranslationProvider,
} from "@/components/ad/AdvertTranslationView";

function renderTranslationView(enabled: boolean) {
  return render(
    <AdvertTranslationProvider enabled={enabled}>
      <h1>
        <AdvertTranslatedTitle original="Original title" translated="Titre traduit" />
      </h1>
      <AdvertTranslationControls
        badgeLabel="Machine translated from Dutch"
        showOriginalLabel="Show original"
      />
      <p>
        <AdvertTranslatedDescription
          original="Original description"
          translated="Description traduite"
          emptyLabel="No description"
        />
      </p>
    </AdvertTranslationProvider>,
  );
}

describe("AdvertTranslationView", () => {
  it("falls back to original content when no published translation is enabled", () => {
    renderTranslationView(false);

    expect(screen.getByText("Original title")).toBeInTheDocument();
    expect(screen.getByText("Original description")).toBeInTheDocument();
    expect(screen.queryByText("Machine translated from Dutch")).not.toBeInTheDocument();
  });

  it("shows translated content and toggles back to original", () => {
    renderTranslationView(true);

    expect(screen.getByText("Titre traduit")).toBeInTheDocument();
    expect(screen.getByText("Description traduite")).toBeInTheDocument();
    expect(screen.getByText("Machine translated from Dutch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Show original" }));

    expect(screen.getByText("Original title")).toBeInTheDocument();
    expect(screen.getByText("Original description")).toBeInTheDocument();
  });
});
