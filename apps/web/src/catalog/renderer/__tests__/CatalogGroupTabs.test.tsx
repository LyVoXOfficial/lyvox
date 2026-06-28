import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogGroupTabs } from "@/catalog/renderer/CatalogGroupTabs";
import type { CatalogSchemaGroup, CatalogFieldDefinition } from "@/catalog/renderer/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key, // return key as label for easy assertions
  }),
}));

// Minimal FieldWidget mock — renders the field_key as text
vi.mock("@/catalog/renderer/FieldWidgets", () => ({
  FieldWidget: ({ field }: { field: { field_key: string } }) => (
    <div data-testid={`widget-${field.field_key}`}>{field.field_key}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeField = (key: string): CatalogFieldDefinition => ({
  field_key: key,
  label_i18n_key: `catalog.${key}`,
  description_i18n_key: null,
  field_type: "text",
  domain: "vehicle",
  is_required: false,
  unit: null,
  min_value: null,
  max_value: null,
  pattern: null,
  group_key: null,
  sort: 0,
  metadata: {},
});

const makeGroup = (key: string, display: "tab" | "section", fieldKeys: string[]): CatalogSchemaGroup => ({
  key,
  display,
  tab_key: display === "tab" ? key : undefined,
  tab_order: 0,
  title_i18n_key: `catalog.group.${key}`,
  fields: fieldKeys.map((fk) => ({ field_key: fk })),
});

const defaultFields: Record<string, CatalogFieldDefinition> = {
  make: makeField("make"),
  engine: makeField("engine"),
  color: makeField("color"),
};

const defaultProps = {
  fields: defaultFields,
  values: {},
  onChange: vi.fn(),
  locale: "en",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CatalogGroupTabs — F13 ARIA tabs renderer", () => {
  // ── Tab layout ──────────────────────────────────────────────────────────
  it("(a) renders tabs when display='tab'; each group becomes a tab trigger", () => {
    const groups: CatalogSchemaGroup[] = [
      makeGroup("overview", "tab", ["make", "color"]),
      makeGroup("engine", "tab", ["engine"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    // Both groups should have tab triggers
    expect(screen.getByRole("tab", { name: "catalog.group.overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "catalog.group.engine" })).toBeInTheDocument();

    // Tablist must exist (ARIA)
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("(b) first tab is selected by default and its content is visible", () => {
    const groups: CatalogSchemaGroup[] = [
      makeGroup("overview", "tab", ["make"]),
      makeGroup("engine", "tab", ["engine"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    const firstTab = screen.getByRole("tab", { name: "catalog.group.overview" });
    expect(firstTab).toHaveAttribute("data-state", "active");

    // Field from first tab should be rendered
    expect(screen.getByTestId("widget-make")).toBeInTheDocument();
  });

  it("(c) clicking a different tab shows that tab's content", async () => {
    const user = userEvent.setup();
    const groups: CatalogSchemaGroup[] = [
      makeGroup("overview", "tab", ["make"]),
      makeGroup("engine", "tab", ["engine"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    // Click the engine tab
    await user.click(screen.getByRole("tab", { name: "catalog.group.engine" }));

    // Engine field should now be visible
    expect(screen.getByTestId("widget-engine")).toBeInTheDocument();
  });

  // ── Section layout ──────────────────────────────────────────────────────
  it("(d) renders sections (no tablist) when display='section'", () => {
    const groups: CatalogSchemaGroup[] = [
      makeGroup("details", "section", ["make", "color"]),
      makeGroup("condition", "section", ["engine"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    // No tablist present
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    // All fields visible at once (sections are stacked, not hidden)
    expect(screen.getByTestId("widget-make")).toBeInTheDocument();
    expect(screen.getByTestId("widget-engine")).toBeInTheDocument();
  });

  it("(e) section group titles are rendered as headings", () => {
    const groups: CatalogSchemaGroup[] = [
      makeGroup("details", "section", ["make"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    expect(screen.getByText("catalog.group.details")).toBeInTheDocument();
  });

  // ── Mixed: any tab group → use tabs layout ──────────────────────────────
  it("(f) if any group has display='tab', uses tabs layout for those groups", () => {
    const groups: CatalogSchemaGroup[] = [
      makeGroup("overview", "tab", ["make"]),
      makeGroup("details", "section", ["color"]),
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    // Tabs layout: tablist should be present for the 'tab' groups
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  // ── Empty groups ────────────────────────────────────────────────────────
  it("(g) empty groups list renders nothing without crashing", () => {
    render(<CatalogGroupTabs {...defaultProps} groups={[]} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  // ── Missing field definition ─────────────────────────────────────────────
  it("(h) renders missing-field placeholder when field_key not in definitions", () => {
    const groups: CatalogSchemaGroup[] = [
      { key: "g1", display: "section", fields: [{ field_key: "nonexistent_field" }] },
    ];

    render(<CatalogGroupTabs {...defaultProps} groups={groups} />);

    expect(screen.getByText("catalog.common.field_missing")).toBeInTheDocument();
  });
});
