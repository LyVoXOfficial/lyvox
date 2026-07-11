import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  verifyCaptcha: vi.fn(),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  },
}));

vi.mock("@/lib/antifraud/verifyCaptchaClient", () => ({
  verifyCaptcha: mocks.verifyCaptcha,
}));

vi.mock("@/components/antifraud/TurnstileWidget", () => ({
  default: () => null,
}));

import RecoveryPage from "../page";

describe("RecoveryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verifyCaptcha.mockResolvedValue(true);
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("routes the recovery code through the server callback before password reset", async () => {
    render(<RecoveryPage />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send recovery link" }));

    await waitFor(() => {
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
        "owner@example.com",
        {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fauth%2Freset-password",
        },
      );
    });
  });
});
