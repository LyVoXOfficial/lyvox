"use client";

import { useCallback, useState } from "react";
import TurnstileWidget from "@/components/antifraud/TurnstileWidget";
import { ACCESS_GATE_TURNSTILE_ACTION } from "@/lib/antifraud/turnstileConfig";
import styles from "./page.module.css";

type Copy = Record<string, string | undefined>;

type Props = {
  codeInvalid: boolean;
  copy: Copy;
  error?: string;
  returnTo: string;
  unavailable: boolean;
};

export default function AccessGateForm({
  codeInvalid,
  copy,
  error,
  returnTo,
  unavailable,
}: Props) {
  const turnstileConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState(false);
  const waitingForChallenge = turnstileConfigured && !turnstileToken;
  const handleChallengeToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
    if (token) setChallengeError(false);
  }, []);

  return (
    <form action="/api/access-gate/unlock" method="post">
      <p className={styles.panelLabel}>
        {copy.form_eyebrow ?? "Invitation access"}
      </p>
      <h2 id="access-title">
        {copy.form_title ?? "Enter the private preview"}
      </h2>
      <p className={styles.formIntro}>
        {copy.form_body ?? "Use the access code shared with the testing team."}
      </p>
      <input name="returnTo" type="hidden" value={returnTo} />
      <input name="turnstileToken" type="hidden" value={turnstileToken ?? ""} />
      <fieldset className={styles.fieldset} disabled={unavailable}>
        <label htmlFor="preview-code">{copy.code_label ?? "Access code"}</label>
        <input
          aria-describedby={
            codeInvalid && error
              ? "preview-error preview-help"
              : "preview-help"
          }
          aria-invalid={codeInvalid ? "true" : undefined}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          id="preview-code"
          maxLength={256}
          name="code"
          placeholder={copy.code_placeholder ?? "Enter your access code"}
          required
          spellCheck={false}
          type="password"
        />
        {error ? (
          <p className={styles.error} id="preview-error" role="alert">
            {error}
          </p>
        ) : null}
        {turnstileConfigured && !unavailable ? (
          <div
            aria-label={copy.security_check ?? "Security check"}
            className={styles.turnstile}
          >
            <TurnstileWidget
              action={ACCESS_GATE_TURNSTILE_ACTION}
              onError={() => setChallengeError(true)}
              onToken={handleChallengeToken}
              size="compact"
            />
          </div>
        ) : null}
        {challengeError ? (
          <div className={styles.challengeError} role="alert">
            <p>
              {copy.security_unavailable ??
                "The security check could not load. Reload the page and try again."}
            </p>
            <button
              className={styles.retryChallenge}
              onClick={() => window.location.reload()}
              type="button"
            >
              {copy.reload ?? "Reload page"}
            </button>
          </div>
        ) : null}
        <button disabled={waitingForChallenge} type="submit">
          {copy.submit ?? "Open LyVoX"}
        </button>
      </fieldset>
      <p className={styles.help} id="preview-help">
        {copy.privacy_note ??
          "The code is checked securely. The access cookie never contains it."}
      </p>
    </form>
  );
}
