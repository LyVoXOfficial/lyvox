import { cookies } from "next/headers";
import { getI18nProps } from "@/i18n/server";
import {
  ACCESS_GATE_COOKIE_NAME,
  getAccessGateRuntime,
  sanitizeAccessGateReturnTo,
  verifyAccessGateCookie,
} from "@/lib/security/accessGate";
import AccessGateForm from "./AccessGateForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ locale, messages }, params, cookieStore] = await Promise.all([
    getI18nProps(),
    searchParams,
    cookies(),
  ]);
  const copy = messages?.access_gate ?? {};
  const runtime = getAccessGateRuntime();
  const returnTo = sanitizeAccessGateReturnTo(firstValue(params.returnTo));
  const cookie = cookieStore.get(ACCESS_GATE_COOKIE_NAME)?.value;
  const cookieValid =
    runtime.signingSecret !== null &&
    (await verifyAccessGateCookie(cookie, runtime.signingSecret));
  const unlocked = !runtime.active || cookieValid;
  const unavailable = runtime.active && !runtime.configured;
  const requestedError = firstValue(params.error);
  const error = unavailable
    ? copy.unavailable
    : requestedError === "invalid"
      ? copy.invalid
      : requestedError === "captcha"
        ? copy.captcha
        : requestedError === "rate_limited"
          ? copy.rate_limited
          : undefined;

  return (
    <>
      <a className={styles.skipLink} href="#preview-content">
        {copy.skip_to_content ?? "Skip to content"}
      </a>
      <main className={styles.page} id="preview-content" tabIndex={-1}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.wordmark}>
              <span className={styles.mark} aria-hidden="true">
                <span />
                <span />
              </span>
              <span>LyVoX</span>
            </div>
            <p className={styles.status}>
              <span aria-hidden="true" />
              {copy.status ?? "Private preview"}
            </p>
          </header>

          <div className={styles.content}>
            <section className={styles.intro} aria-labelledby="preview-title">
              <p className={styles.eyebrow}>
                {copy.eyebrow ?? "A new marketplace for Belgium"}
              </p>
              <h1 id="preview-title">
                {copy.title ?? "A quieter marketplace is taking shape."}
              </h1>
              <p className={styles.lead}>
                {copy.body ??
                  "LyVoX is being prepared for its first public release. Access is currently limited to the people testing the service."}
              </p>
            </section>

            <aside
              className={styles.accessPanel}
              aria-labelledby="access-title"
            >
              {unlocked ? (
                <div className={styles.unlocked}>
                  <p className={styles.panelLabel}>
                    {copy.unlocked_eyebrow ?? "Preview unlocked"}
                  </p>
                  <h2 id="access-title">
                    {copy.unlocked_title ?? "This browser can access LyVoX."}
                  </h2>
                  <p>
                    {copy.unlocked_body ??
                      "Continue where you left off, or lock the preview again on this device."}
                  </p>
                  <div className={styles.actions}>
                    <a className={styles.primaryAction} href={returnTo}>
                      {copy.continue ?? "Continue to LyVoX"}
                    </a>
                    <form action="/api/access-gate/lock" method="post">
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <button className={styles.secondaryAction} type="submit">
                        {copy.relock ?? "Lock this preview"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <AccessGateForm
                  codeInvalid={!unavailable && requestedError === "invalid"}
                  copy={copy}
                  error={error}
                  returnTo={returnTo}
                  unavailable={unavailable}
                />
              )}
            </aside>
          </div>

          <footer className={styles.footer}>
            <p>
              {copy.footer ?? "Built in Belgium for local buying and selling."}
            </p>
            <p>
              {locale.toUpperCase()} · {copy.build_label ?? "Private build"}
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
