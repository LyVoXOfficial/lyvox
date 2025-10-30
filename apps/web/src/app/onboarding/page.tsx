import Link from "next/link";
import { headers } from "next/headers";
import { resolveFromAcceptLanguage, resolveLocale, type Locale } from "@/lib/i18n";

type Messages = {
  title: string;
  lead: string;
  checklist: string[];
  profileCta: string;
  phoneCta: string;
};

const messages: Record<Locale, Messages> = {
  en: {
    title: "Welcome to LyVoX",
    lead: "Finish the onboarding tasks to unlock publishing and safer trading.",
    checklist: [
      "Confirm the email we just sent you",
      "Complete your profile details",
      "Verify your phone number",
    ],
    profileCta: "Update profile",
    phoneCta: "Verify phone",
  },
  fr: {
    title: "Bienvenue sur LyVoX",
    lead: "Terminez les etapes d'onboarding pour publier en toute confiance.",
    checklist: [
      "Confirmez l'e-mail que nous venons d'envoyer",
      "Completez les informations de votre profil",
      "Verifiez votre numero de telephone",
    ],
    profileCta: "Mettre a jour le profil",
    phoneCta: "Verifier le telephone",
  },
  nl: {
    title: "Welkom bij LyVoX",
    lead: "Rond de onboarding af om veilig te kunnen handelen.",
    checklist: [
      "Bevestig de e-mail die we zojuist hebben verzonden",
      "Vul je profielgegevens in",
      "Verifieer je telefoonnummer",
    ],
    profileCta: "Profiel bijwerken",
    phoneCta: "Telefoon verifiëren",
  },
  ru: {
    title: "Добро пожаловать в LyVoX",
    lead: "Завершите шаги онбординга, чтобы публиковать объявления безопасно.",
    checklist: [
      "Подтвердите письмо, которое мы отправили",
      "Заполните данные профиля",
      "Подтвердите номер телефона",
    ],
    profileCta: "Заполнить профиль",
    phoneCta: "Подтвердить телефон",
  },
  de: {
    title: "Willkommen bei LyVoX",
    lead: "Schließen Sie die Onboarding-Schritte ab, um sicher zu veröffentlichen.",
    checklist: [
      "Bestätigen Sie die E-Mail, die wir gerade gesendet haben",
      "Vervollständigen Sie Ihre Profildaten",
      "Verifizieren Sie Ihre Telefonnummer",
    ],
    profileCta: "Profil aktualisieren",
    phoneCta: "Telefon verifizieren",
  },
};

type PageProps = {
  searchParams?: {
    lang?: string;
  };
};

export default async function OnboardingPage({ searchParams }: PageProps) {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  const fromQuery = searchParams?.lang ? resolveLocale(searchParams.lang) : null;
  const locale: Locale = fromQuery ?? resolveFromAcceptLanguage(acceptLanguage);
  const t = messages[locale];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-900">{t.title}</h1>
        <p className="text-base text-zinc-600">{t.lead}</p>
      </header>
      <ol className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        {t.checklist.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-zinc-700">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/profile/edit"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {t.profileCta}
        </Link>
        <Link
          href="/profile/phone"
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {t.phoneCta}
        </Link>
      </div>
    </div>
  );
}
