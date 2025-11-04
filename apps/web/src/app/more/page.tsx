"use client";

import { useI18n } from "@/i18n";
import Link from "next/link";

export default function MorePage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <h1 className="text-2xl font-semibold">{t("common.more") || "Еще"}</h1>

      <div className="space-y-6">
        <section>
          <h2 className="mb-4 text-lg font-medium">{t("footer.about") || "О LyVoX"}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.about_project") || "О проекте"}
              </Link>
            </li>
            <li>
              <Link href="/contacts" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.contacts") || "Контакты"}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium">{t("footer.legal") || "Правовое"}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.terms") || "Условия"}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.privacy") || "Конфиденциальность"}
              </Link>
            </li>
            <li>
              <Link href="/gdpr" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.gdpr") || "GDPR"}
              </Link>
            </li>
            <li>
              <Link href="/security" className="text-muted-foreground hover:text-foreground transition-colors">
                {t("footer.security") || "Безопасность"}
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium">{t("footer.social") || "Мы в соцсетях"}</h2>
          <ul className="space-y-2">
            <li>
              <a
                href="https://instagram.com/lyvox"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Instagram
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

