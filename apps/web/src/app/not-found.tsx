import Link from "next/link";
import { Compass } from "lucide-react";
import { getI18nProps } from "@/i18n/server";

export default async function NotFound() {
  const { messages } = await getI18nProps();
  const common = (messages?.common ?? {}) as Record<string, string>;

  const title = common.page_not_found_title ?? "Page not found";
  const body = common.page_not_found_body ?? "The page you're looking for doesn't exist or was moved.";
  const homeLabel = common.page_not_found_home ?? "Back to home";
  const browseLabel = common.page_not_found_browse ?? "Browse listings";

  return (
    <section className="lyvox-hero-mesh flex min-h-[60dvh] flex-col items-center justify-center px-4 py-16 text-center">
      <p
        className="lyvox-trust-gradient select-none font-extrabold"
        style={{
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          boxShadow: "none",
          fontSize: "clamp(88px, 18vw, 160px)",
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
        aria-hidden="true"
      >
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">{body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="lyvox-cta-gradient inline-flex h-11 items-center rounded-[var(--rm)] px-6 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          {homeLabel}
        </Link>
        <Link
          href="/search"
          className="inline-flex h-11 items-center gap-2 rounded-[var(--rm)] border border-border bg-card px-6 text-sm font-semibold text-foreground shadow-[var(--shS)] transition hover:border-primary/40 hover:text-primary active:scale-[0.98]"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          {browseLabel}
        </Link>
      </div>
    </section>
  );
}
