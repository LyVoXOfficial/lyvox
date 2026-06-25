"use client";

import { useI18n } from "@/i18n";
import Link from "next/link";
import { FileText, Heart, MessageCircle, Plus, Search, ShieldCheck, User } from "lucide-react";

export default function MorePage() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const primaryLinks = [
    { href: "/search", label: tr("more.searchListings", "Search listings"), icon: Search },
    { href: "/post", label: tr("more.postListing", "Post a listing"), icon: Plus },
    { href: "/profile/favorites", label: tr("more.favorites", "Favorites"), icon: Heart },
    { href: "/chat", label: tr("more.messages", "Messages"), icon: MessageCircle },
  ];

  const supportLinks = [
    { href: "/profile", label: tr("more.profile", "Profile"), icon: User },
    { href: "/profile/security", label: tr("more.securitySettings", "Security settings"), icon: ShieldCheck },
    { href: "/contact", label: tr("more.contactSupport", "Contact support"), icon: MessageCircle },
    { href: "/legal/terms", label: tr("more.terms", "Terms"), icon: FileText },
    { href: "/legal/privacy", label: tr("more.privacy", "Privacy"), icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4 md:py-8">
      <div>
        <p className="text-sm font-semibold text-primary">LyVoX</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
          {tr("common.more", "More")}
        </h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {primaryLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[40px] items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold tracking-tight text-foreground">
          {tr("more.accountSafetyLegal", "Account, safety and legal")}
        </h2>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-soft)]">
          {supportLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-[40px] items-center gap-3 px-4 py-3 text-sm text-foreground transition hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
