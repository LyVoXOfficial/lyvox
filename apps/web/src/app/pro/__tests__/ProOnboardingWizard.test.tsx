import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProOnboardingWizard } from "../ProOnboardingWizard";

// Mock sonner toast
const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

// Mock apiFetch
vi.mock("@/lib/fetcher", () => ({
  apiFetch: vi.fn(),
  RateLimitedError: class RateLimitedError extends Error {},
}));

// Minimal messages object for en locale (provides t() with real values)
const messages = {
  pro: {
    title: "Become a professional seller",
    signin_required: "Sign in to register",
    verify_title: "Phone verification required",
    verify_body: "Verified phone required",
    step: "Step",
    of: "of",
    next: "Next",
    back: "Back",
    submit_label: "Submit registration",
    intro: {
      heading: "Company identity",
      body: "Register your company",
      requires_phone: "Phone required",
    },
    identity: {
      legal_name: "Legal name",
      legal_name_placeholder: "Company name",
      trade_name: "Trade name (optional)",
      trade_name_placeholder: "Brand name",
      legal_form: "Legal form",
      legal_form_placeholder: "Select legal form",
      required: "This field is required",
    },
    legal_form: {
      eenmanszaak: "Eenmanszaak",
      other: "Other",
    },
    reg: {
      kbo: "KBO / CBE number",
      kbo_invalid: "Invalid KBO number",
      vat_liable: "This company is VAT-registered",
      vat: "VAT number",
      vat_invalid: "Invalid VAT number",
    },
    contact: {
      heading: "Contact information",
      email: "Business email",
      phone: "Business phone (optional)",
    },
    address: {
      heading: "Business address",
      line: "Street and number",
      line_placeholder: "Wetstraat 1",
      postcode: "Postcode",
      postcode_invalid: "Invalid postcode",
      city: "City",
      country: "Country",
    },
    terms: {
      heading: "Consumer law terms",
      withdrawal: "Withdrawal & return policy",
      withdrawal_help: "14-day right of withdrawal",
      withdrawal_placeholder: "Consumers have the right...",
      returns_url: "Returns policy URL (optional)",
    },
    certify: {
      label: "I confirm this information is accurate.",
      required: "You must confirm this certification",
    },
    review: {
      heading: "Review and confirm",
      body: "Please review before submitting.",
    },
    submit: {
      success: "Business account created!",
      error: "Something went wrong.",
      duplicate: "Company already registered.",
      verify_phone: "Verify phone first.",
    },
    status: {
      pending: "VAT verification in progress.",
      admin_review: "Admin will review shortly.",
      active_note: "Business is active.",
      verified: "Verified business",
      failed: "Verification failed",
    },
    badge: {
      verified_business: "Verified Business",
      vat_registered: "VAT Registered",
    },
  },
  profile: {
    login: "Sign in",
  },
  post: {
    goto_verify: "Go to verification",
  },
};

describe("<ProOnboardingWizard />", () => {
  it("renders step 1 with title and Next button", () => {
    render(<ProOnboardingWizard locale="en" messages={messages} />);
    expect(screen.getByText("Become a professional seller")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });

  it("advances from step 1 to step 2 on Next click", () => {
    render(<ProOnboardingWizard locale="en" messages={messages} />);
    // Step 1 has no required fields — click Next advances to step 2
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Step 2 shows legal name field
    expect(screen.getByLabelText(/Legal name/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("shows validation error for missing legal_name on step 2", () => {
    render(<ProOnboardingWizard locale="en" messages={messages} />);
    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Try to advance without filling required fields
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByText("This field is required").length).toBeGreaterThan(0);
  });

  it("shows KBO validation error for invalid KBO number", () => {
    render(<ProOnboardingWizard locale="en" messages={messages} />);
    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Fill legal_name but bad KBO
    fireEvent.change(screen.getByLabelText(/Legal name/i), {
      target: { value: "Test BV" },
    });
    fireEvent.change(screen.getByLabelText(/KBO/i), {
      target: { value: "1234567890" }, // invalid mod-97
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Invalid KBO number")).toBeTruthy();
  });
});
