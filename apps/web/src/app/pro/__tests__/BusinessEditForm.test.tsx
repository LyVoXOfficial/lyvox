import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BusinessEditForm } from "../BusinessEditForm";

// Mock sonner toast
const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

// Mock apiFetch
const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));
vi.mock("@/lib/fetcher", () => ({
  apiFetch,
  RateLimitedError: class RateLimitedError extends Error {},
}));

// Minimal messages object
const messages = {
  pro: {
    cabinet: {
      edit: {
        heading: "Edit business details",
        trade_name: "Trade name",
        trade_name_placeholder: "Your brand or shop name",
        legal_form: "Legal form",
        legal_form_placeholder: "e.g. BV, NV, Eenmanszaak",
        address_line: "Street and number",
        address_line_placeholder: "Wetstraat 1",
        postcode: "Postcode",
        city: "City",
        country: "Country",
        email: "Business email",
        phone_e164: "Business phone",
        withdrawal_terms: "Withdrawal & return policy",
        withdrawal_terms_placeholder: "Consumers have the right...",
        returns_url: "Returns policy URL (optional)",
        save: "Save changes",
        success: "Business details updated successfully",
        error_forbidden: "Only the business owner can edit these details",
        error_generic: "Something went wrong. Please try again.",
        postcode_invalid: "Belgian postcode must be 4 digits (1000–9999)",
        email_invalid: "Please enter a valid email address",
      },
    },
  },
};

const defaultInitial = {
  trade_name: "Test Trade",
  legal_form: "bv",
  address_line: "Wetstraat 1",
  postcode: "1000",
  city: "Brussels",
  country: "BE",
  email: "info@test.be",
  phone_e164: "+32200000000",
  withdrawal_terms: "14 days right of withdrawal",
  returns_url: null,
};

describe("<BusinessEditForm />", () => {
  it("renders the form with the save button", () => {
    render(
      <BusinessEditForm
        businessId="biz-123"
        initial={defaultInitial}
        locale="en"
        messages={messages}
      />,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.getByLabelText("Trade name")).toBeTruthy();
    expect(screen.getByLabelText("Business email")).toBeTruthy();
  });

  it("shows postcode validation error for invalid Belgian postcode", async () => {
    render(
      <BusinessEditForm
        businessId="biz-123"
        initial={{ ...defaultInitial, postcode: "" }}
        locale="en"
        messages={messages}
      />,
    );
    const postcodeInput = screen.getByLabelText("Postcode");
    fireEvent.change(postcodeInput, { target: { value: "0123" } }); // starts with 0 — invalid
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(screen.getByText("Belgian postcode must be 4 digits (1000–9999)")).toBeTruthy();
    });
  });

  it("shows email validation error for invalid email", async () => {
    render(
      <BusinessEditForm
        businessId="biz-123"
        initial={defaultInitial}
        locale="en"
        messages={messages}
      />,
    );
    const emailInput = screen.getByLabelText("Business email");
    fireEvent.change(emailInput, { target: { value: "not-an-email" } });
    // Submit via form element to bypass browser native validation on type="email"
    const form = emailInput.closest("form");
    if (form) fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeTruthy();
    });
  });

  it("calls apiFetch with PATCH on valid submit and shows success toast", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: true }),
    });

    // Spy on window.location.reload
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      writable: true,
    });

    render(
      <BusinessEditForm
        businessId="biz-123"
        initial={defaultInitial}
        locale="en"
        messages={messages}
      />,
    );

    // Change trade_name so the patch body is non-empty
    const tradeNameInput = screen.getByLabelText("Trade name");
    fireEvent.change(tradeNameInput, { target: { value: "New Brand Name" } });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/business/biz-123",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Business details updated successfully");
    });
  });

  it("shows forbidden error toast on FORBIDDEN response", async () => {
    apiFetch.mockResolvedValueOnce({
      json: async () => ({ ok: false, error: "FORBIDDEN" }),
    });

    render(
      <BusinessEditForm
        businessId="biz-123"
        initial={defaultInitial}
        locale="en"
        messages={messages}
      />,
    );

    // Change a field so PATCH is sent
    const tradeNameInput = screen.getByLabelText("Trade name");
    fireEvent.change(tradeNameInput, { target: { value: "Changed Name" } });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Only the business owner can edit these details",
      );
    });
  });
});
