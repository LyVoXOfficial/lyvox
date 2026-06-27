import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteAccountSection } from "../DeleteAccountSection";

// ── Mock sonner ──────────────────────────────────────────────────────────────
const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

// ── Mock apiFetch ────────────────────────────────────────────────────────────
const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));
vi.mock("@/lib/fetcher", () => ({
  apiFetch,
  RateLimitedError: class RateLimitedError extends Error {},
}));

// ── Mock @/i18n — t(key) returns key so tr(key, fallback) returns fallback ──
vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

// ── Stub window.location.href ────────────────────────────────────────────────
const locationStub = { href: "" };
Object.defineProperty(window, "location", {
  value: locationStub,
  writable: true,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
}

function fillForm(confirmText: string, password: string) {
  const confirmInput = screen.getByLabelText(/type delete to confirm/i);
  const passwordInput = screen.getByLabelText(/current password/i);
  fireEvent.change(confirmInput, { target: { value: confirmText } });
  fireEvent.change(passwordInput, { target: { value: password } });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("<DeleteAccountSection />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationStub.href = "";
  });

  it("renders the danger zone card and download link", () => {
    render(<DeleteAccountSection />);
    expect(screen.getByText("Danger zone")).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeTruthy();
    // Download link
    const downloadLinks = screen.getAllByText(/download your data/i);
    expect(downloadLinks.length).toBeGreaterThan(0);
  });

  it("confirm button is disabled until DELETE typed AND password entered", async () => {
    render(<DeleteAccountSection />);
    openDialog();

    // Both empty — disabled
    const confirmBtn = screen.getByRole("button", { name: /^delete account$/i });
    expect(confirmBtn).toHaveProperty("disabled", true);

    // Only confirm phrase typed — still disabled
    fillForm("DELETE", "");
    expect(confirmBtn).toHaveProperty("disabled", true);

    // Only password entered — still disabled (wrong confirm text)
    fillForm("delete", "mypassword");
    expect(confirmBtn).toHaveProperty("disabled", true);

    // Both correct — enabled
    fillForm("DELETE", "mypassword");
    expect(confirmBtn).toHaveProperty("disabled", false);
  });

  it("submits POST /api/account/delete with correct body on confirm", async () => {
    apiFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true, data: { deleted: true } }),
    });

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "secret123");

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/account/delete",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ confirm: "DELETE", password: "secret123" }),
        }),
      );
    });
  });

  it("redirects to / and shows success toast on 200", async () => {
    apiFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true, data: { deleted: true } }),
    });

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "correct-password");
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Your account has been permanently deleted.",
      );
      expect(locationStub.href).toBe("/");
    });
  });

  it("shows active-business inline error on 409 and keeps dialog open", async () => {
    apiFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, detail: "ACTIVE_BUSINESS" }),
    });

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "mypassword");
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/transfer or close your business before deleting your account/i),
      ).toBeTruthy();
    });

    // Dialog should still be open (confirm button still visible)
    expect(screen.getByRole("button", { name: /^delete account$/i })).toBeTruthy();
    // No redirect
    expect(locationStub.href).toBe("");
    // No success toast
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows wrong-password inline error on 403 and keeps dialog open", async () => {
    apiFetch.mockResolvedValueOnce({
      status: 403,
      json: async () => ({ ok: false, detail: "REAUTH_FAILED" }),
    });

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "wrongpassword");
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/incorrect password/i)).toBeTruthy();
    });

    // Dialog must remain open (confirm button still present)
    expect(screen.getByRole("button", { name: /^delete account$/i })).toBeTruthy();
    // No redirect
    expect(locationStub.href).toBe("");
  });

  it("shows generic error toast on unexpected error response", async () => {
    apiFetch.mockResolvedValueOnce({
      status: 500,
      json: async () => ({ ok: false }),
    });

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "mypassword");
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });
  });

  it("shows generic error toast when apiFetch throws (network error)", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<DeleteAccountSection />);
    openDialog();
    fillForm("DELETE", "mypassword");
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong. Please try again.",
      );
    });
  });
});
