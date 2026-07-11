import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccessGateForm from "../AccessGateForm";

vi.mock("@/components/antifraud/TurnstileWidget", () => ({
  default: ({
    action,
    onError,
    onToken,
    size,
  }: {
    action?: string;
    onError?: () => void;
    onToken: (token: string | null) => void;
    size?: string;
  }) => (
    <>
      <button
        data-action={action}
        data-size={size}
        onClick={() => onToken("verified-turnstile-token")}
        type="button"
      >
        Complete challenge
      </button>
      <button onClick={onError} type="button">
        Fail challenge
      </button>
    </>
  ),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AccessGateForm", () => {
  it("waits for the action-bound Turnstile token and submits it with the code", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    const { container } = render(
      <AccessGateForm
        codeInvalid={false}
        copy={{
          code_label: "Access code",
          security_check: "Security check",
          submit: "Open LyVoX",
        }}
        returnTo="/en/search"
        unavailable={false}
      />,
    );

    const submit = screen.getByRole("button", { name: "Open LyVoX" });
    const challenge = screen.getByRole("button", {
      name: "Complete challenge",
    });
    expect(submit).toBeDisabled();
    expect(challenge).toHaveAttribute("data-action", "access_gate_unlock");
    expect(challenge).toHaveAttribute("data-size", "compact");

    fireEvent.click(screen.getByRole("button", { name: "Fail challenge" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The security check could not load",
    );

    fireEvent.click(challenge);

    expect(submit).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      container.querySelector<HTMLInputElement>('input[name="turnstileToken"]')
        ?.value,
    ).toBe("verified-turnstile-token");
  });

  it("marks only an incorrect access code as an invalid field", () => {
    const { rerender } = render(
      <AccessGateForm
        codeInvalid={false}
        copy={{ code_label: "Access code" }}
        error="The security check failed"
        returnTo="/"
        unavailable={false}
      />,
    );

    const input = screen.getByLabelText("Access code");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAttribute("aria-describedby", "preview-help");

    rerender(
      <AccessGateForm
        codeInvalid
        copy={{ code_label: "Access code" }}
        error="Incorrect access code"
        returnTo="/"
        unavailable={false}
      />,
    );

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "preview-error preview-help",
    );
  });
});
