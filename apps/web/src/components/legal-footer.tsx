"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { useCookieConsent } from "@/components/cookie/CookieConsentProvider";

export default function LegalFooter() {
  const { t } = useI18n();
  const { openPreferences } = useCookieConsent();
  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <footer className="mb-16 border-t border-border/75 bg-card md:mb-0">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-muted-foreground md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="font-semibold text-foreground">LyVoX</div>
          <p className="mt-2 max-w-sm leading-6">
            {translate(
              "footer.tagline",
              "Belgium-focused marketplace for local listings, verified seller signals and safer conversations.",
            )}
          </p>
        </div>
        <div>
          <div className="font-semibold text-foreground">{translate("common.about", "Marketplace")}</div>
          <ul className="mt-2 space-y-2">
            <li><Link className="hover:text-foreground" href="/search">{translate("footer.browse_listings", "Browse listings")}</Link></li>
            <li><Link className="hover:text-foreground" href="/post">{translate("footer.post_listing", "Post a listing")}</Link></li>
            <li><Link className="hover:text-foreground" href="/contact">{translate("common.contacts", "Contact")}</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-foreground">{translate("common.legal", "Legal")}</div>
          <ul className="mt-2 space-y-2">
            <li><Link className="hover:text-foreground" href="/legal/terms">{translate("common.terms", "Terms")}</Link></li>
            <li><Link className="hover:text-foreground" href="/legal/privacy">{translate("common.privacy", "Privacy")}</Link></li>
            <li><Link className="hover:text-foreground" href="/legal/cookies">{translate("common.cookies", "Cookies")}</Link></li>
            <li>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={openPreferences}
              >
                {translate("common.cookie_settings", "Cookie settings")}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
