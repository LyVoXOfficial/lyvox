import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLocale, supportedLocales, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/supabaseTypes";

export const ADVERT_TRANSLATION_LOCALES = supportedLocales;

export type AdvertTranslationStatus = "draft" | "published" | "reviewed" | "stale" | "rejected";

export function resolveAdvertSourceLocale(locale: string | null | undefined): Locale {
  return resolveLocale(locale);
}

export function getAdvertTargetLocales(sourceLocale: string | null | undefined): Locale[] {
  const resolvedSource = resolveAdvertSourceLocale(sourceLocale);
  return ADVERT_TRANSLATION_LOCALES.filter((locale) => locale !== resolvedSource);
}

export function buildAdvertSourceHash(input: {
  title: string;
  description: string | null | undefined;
}): string {
  return createHash("sha256")
    .update(`${input.title}${input.description ?? ""}`, "utf8")
    .digest("hex");
}

export async function markAdvertTranslationsStale(
  service: SupabaseClient<Database>,
  advertId: string,
) {
  const { error } = await service
    .from("advert_translations")
    .update({ status: "stale" })
    .eq("advert_id", advertId)
    .neq("status", "stale");

  return error;
}
