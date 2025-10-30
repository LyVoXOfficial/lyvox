"use client";

import { useI18n } from "@/i18n";

export default function LegalFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t bg-white mb-16 md:mb-0">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-600 grid md:grid-cols-3 gap-4">
        <div>
          <div className="font-medium">{t("common.about")}</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="/about">{t("common.about_project")}</a></li>
            <li><a className="hover:underline" href="/contact">{t("common.contacts")}</a></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">{t("common.legal")}</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="/legal/terms">{t("common.terms")}</a></li>
            <li><a className="hover:underline" href="/legal/privacy">{t("common.privacy")}</a></li>
            <li><a className="hover:underline" href="/safety">{t("common.safety")}</a></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">{t("common.social")}</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="#">Instagram</a></li>
            <li><a className="hover:underline" href="#">Facebook</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
