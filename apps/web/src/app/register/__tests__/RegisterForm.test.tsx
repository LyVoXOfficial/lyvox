import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "../RegisterForm";

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  },
}));

const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: {
    get: vi.fn(() => null),
  },
}));

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: supabaseMock }));

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  routerMock.push.mockReset();
  // Reset turnstile global between tests
  delete (window as Window & typeof globalThis).turnstile;
});

describe("<RegisterForm />", () => {
  it("submits registration data and redirects to onboarding on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, verificationRequired: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RegisterForm initialLocale="en" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password!123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Password!123" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
      }),
    );
    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/en/onboarding");
    });
    expect(toast.success).toHaveBeenCalledWith("Check your inbox", {
      description: expect.any(String),
    });
  });

  it("resets Turnstile widget and clears token after a failed registration", async () => {
    // Simulate a widget already rendered — widgetIdRef would hold this id
    const resetMock = vi.fn();
    (window as Window & typeof globalThis).turnstile = {
      render: vi.fn().mockReturnValue("widget-abc"),
      reset: resetMock,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: "EMAIL_IN_USE" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RegisterForm initialLocale="en" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password!123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Password!123" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Error toast shown, no redirect
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();

    // Turnstile widget was reset so the next attempt gets a fresh token
    expect(resetMock).toHaveBeenCalled();
  });

  it("shows an error toast when consents are missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: "CONSENT_REQUIRED" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RegisterForm initialLocale="en" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password!123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Password!123" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
 
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Accept the Terms of Service and Privacy Policy to continue.");
  });
});
