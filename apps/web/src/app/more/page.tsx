"use client";

import { useI18n } from "@/i18n";
import Link from "next/link";
import { FileText, Heart, MessageCircle, Plus, Search, ShieldCheck, User } from "lucide-react";

export default function MorePage() {
  const { t } = useI18n();
  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const primaryLinks = [
    { href: "/search", label: "Search listings", icon: Search },
    { href: "/post", label: "Post a listing", icon: Plus },
    { href: "/profile/favorites", label: "Favorites", icon: Heart },
    { href: "/chat", label: "Messages", icon: MessageCircle },
  ];

  const supportLinks = [
    { href: "/profile", label: "Profile", icon: User },
    { href: "/profile/security", label: "Security settings", icon: ShieldCheck },
    { href: "/contact", label: "Contact support", icon: MessageCircle },
    { href: "/legal/terms", label: "Terms", icon: FileText },
    { href: "/legal/privacy", label: "Privacy", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4 md:py-8">
      <div>
        <p className="text-sm font-semibold text-primary">LyVoX</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">{translate("common.more", "More")}</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {primaryLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account, safety and legal</h2>
        <div className="divide-y rounded-md border border-border/80 bg-card shadow-sm">
          {supportLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-secondary/70"
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
