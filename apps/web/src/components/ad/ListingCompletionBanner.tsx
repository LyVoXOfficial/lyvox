import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";

type ListingCompletionBannerProps = {
  title: string;
  body: string;
  progressLabel: string;
  ctaLabel: string;
  editHref: string;
};

export default function ListingCompletionBanner({
  title,
  body,
  progressLabel,
  ctaLabel,
  editHref,
}: ListingCompletionBannerProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--rm)] border border-primary/20 bg-accent/20 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold tracking-tight">{title}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{body}</p>
          <p className="mt-1 text-[12.5px] font-semibold text-primary">{progressLabel}</p>
        </div>
      </div>

      <Link
        href={editHref}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground transition hover:bg-primary/90"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
