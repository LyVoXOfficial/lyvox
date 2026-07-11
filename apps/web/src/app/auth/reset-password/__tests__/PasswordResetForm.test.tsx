import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  },
}));

import PasswordResetForm from "../PasswordResetForm";

describe("PasswordResetForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    render(<PasswordResetForm />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The passwords do not match.",
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, revokes sessions, and shows the fresh-login state", async () => {
    render(<PasswordResetForm />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: "StrongPass1!" });
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    });
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute(
      "href",
      "/login?password=updated",
    );
  });

  it("keeps the form actionable when the provider rejects the update", async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: "expired" } });
    render(<PasswordResetForm />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The password could not be updated.",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  });

  it("does not claim sessions were revoked when global sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "network" } });
    render(<PasswordResetForm />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText(/could not confirm that every other session/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review active sessions" })).toHaveAttribute(
      "href",
      "/profile/security",
    );
  });
});
