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

vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  routerMock.push.mockReset();
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

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

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
      expect(routerMock.push).toHaveBeenCalledWith("/onboarding?lang=en");
    });
    expect(toast.success).toHaveBeenCalledWith("Check your inbox", {
      description: expect.any(String),
    });
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
 
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Accept the required policies to continue.");
  });
});
