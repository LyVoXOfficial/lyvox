import { headers } from "next/headers";
import RegisterForm from "./RegisterForm";
import { resolveFromAcceptLanguage, resolveLocale, type Locale } from "@/lib/i18n";

type PageProps = {
  searchParams?: {
    lang?: string;
  };
};

export default function RegisterPage({ searchParams }: PageProps) {
  const acceptLanguage = headers().get("accept-language");
  const fromQuery = searchParams?.lang ? resolveLocale(searchParams.lang) : null;
  const initialLocale: Locale = fromQuery ?? resolveFromAcceptLanguage(acceptLanguage);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <RegisterForm initialLocale={initialLocale} />
    </div>
  );
}
