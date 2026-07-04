import { getI18nProps } from "@/i18n/server";
import { CookieInventory } from "./CookieInventory";

export const metadata = {
  title: "Cookie Policy",
};

export default async function CookiesPage() {
  const { messages } = await getI18nProps();

  function t(key: string): string {
    const parts = key.split(".");
    let val: any = messages;
    for (const p of parts) {
      val = val?.[p];
    }
    return typeof val === "string" ? val : key;
  }

  return (
    <CookieInventory
      policyTitle={t("cookie.policy_title")}
      policyIntro={t("cookie.policy_intro")}
      draftNote={t("cookie.policy_draft_note")}
      manageLabel={t("cookie.manage")}
      necessaryLabel={t("cookie.necessary_label")}
      functionalLabel={t("cookie.functional_label")}
      analyticsLabel={t("cookie.analytics_label")}
      sessionTitle={t("cookie.session_personalization_title")}
      sessionBody={t("cookie.session_personalization_body")}
    />
  );
}
