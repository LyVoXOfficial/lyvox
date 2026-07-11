import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/supabaseService";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import { getIntegrationStatus } from "@/lib/integrations/registry";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";
import { getTranslationProvider } from "@/lib/translations/provider";
import {
  buildAdvertSourceHash,
  getAdvertTargetLocales,
  resolveAdvertSourceLocale,
  type AdvertTranslationStatus,
} from "@/lib/translations/advertTranslations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADVERT_LIMIT = 20;
const LOOKAHEAD_LIMIT = 100;
const SEED_EMAIL_SUFFIX = "@lyvox-seed.be";

type TranslationSummary = {
  target_locale: string;
  source_hash: string;
  status: string;
};

type AdvertCandidate = Pick<
  Tables<"adverts">,
  "id" | "user_id" | "title" | "description" | "content_locale" | "updated_at"
> & {
  advert_translations?: TranslationSummary[] | null;
};

type DraftWritePayload = TablesInsert<"advert_translations">;
type TranslationUpdatePayload = TablesUpdate<"advert_translations">;

type DraftRow = {
  id: string;
  status: string;
};

function shouldIncludeSeed(env: Record<string, string | undefined> = process.env): boolean {
  return env.TRANSLATE_INCLUDE_SEED !== "false";
}

function isCompleteTranslation(status: string | null | undefined): boolean {
  return status === "published" || status === "reviewed";
}

function targetsNeedingTranslation(advert: AdvertCandidate): string[] {
  const sourceHash = buildAdvertSourceHash(advert);
  const translations = advert.advert_translations ?? [];
  return getAdvertTargetLocales(advert.content_locale).filter((targetLocale) => {
    return !translations.some(
      (translation) =>
        translation.target_locale === targetLocale &&
        translation.source_hash === sourceHash &&
        isCompleteTranslation(translation.status),
    );
  });
}

async function filterSeedAdverts(
  service: SupabaseClient<Database>,
  adverts: AdvertCandidate[],
): Promise<AdvertCandidate[]> {
  if (shouldIncludeSeed()) return adverts;

  const seedUserIds = new Set<string>();
  const userIds = [...new Set(adverts.map((advert) => advert.user_id).filter(Boolean))];

  await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await service.auth.admin.getUserById(userId);
      if (error || !data.user) {
        seedUserIds.add(userId);
        return;
      }

      const email = data.user.email?.toLowerCase() ?? "";
      if (email.endsWith(SEED_EMAIL_SUFFIX)) {
        seedUserIds.add(userId);
      }
    }),
  );

  return adverts.filter((advert) => !seedUserIds.has(advert.user_id));
}

async function fetchAdvertCandidates(
  service: SupabaseClient<Database>,
): Promise<{ data: AdvertCandidate[] | null; error: { message?: string } | null }> {
  const { data, error } = await service
    .from("adverts")
    .select(
      "id,user_id,title,description,content_locale,updated_at,advert_translations(target_locale,source_hash,status)",
    )
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(LOOKAHEAD_LIMIT);

  if (error) {
    return { data: null, error };
  }

  const rows = (data ?? []) as unknown as AdvertCandidate[];
  const filtered = await filterSeedAdverts(service, rows);
  const candidates = filtered.filter((advert) => targetsNeedingTranslation(advert).length > 0);
  return { data: candidates.slice(0, ADVERT_LIMIT), error: null };
}

async function writeDraftTranslation(
  service: SupabaseClient<Database>,
  payload: DraftWritePayload,
): Promise<DraftRow | null> {
  const { data, error } = await service
    .from("advert_translations")
    .insert(payload)
    .select("id,status")
    .single();

  if (!error) return data;
  if (error.code !== "23505") throw error;

  const { data: existing, error: selectError } = await service
    .from("advert_translations")
    .select("id,status")
    .eq("advert_id", payload.advert_id)
    .eq("target_locale", payload.target_locale)
    .eq("source_hash", payload.source_hash)
    .maybeSingle();

  if (selectError) throw selectError;
  if (!existing || existing.status === "reviewed") return null;

  const updatePayload: TranslationUpdatePayload = {
    source_locale: payload.source_locale,
    title: payload.title,
    description: payload.description ?? null,
    generated_by: payload.generated_by,
    model_or_provider: payload.model_or_provider,
    status: payload.status as AdvertTranslationStatus,
  };

  const { data: updated, error: updateError } = await service
    .from("advert_translations")
    .update(updatePayload)
    .eq("id", existing.id)
    .neq("status", "reviewed")
    .select("id,status")
    .maybeSingle();

  if (updateError) throw updateError;
  return updated;
}

async function markTranslationUnavailable(
  service: SupabaseClient<Database>,
  advert: AdvertCandidate,
  targetLocale: string,
  sourceHash: string,
  providerName: string,
): Promise<"unavailable" | "reviewed"> {
  const sourceLocale = resolveAdvertSourceLocale(advert.content_locale);
  const draft = await writeDraftTranslation(service, {
    advert_id: advert.id,
    source_locale: sourceLocale,
    target_locale: targetLocale,
    title: advert.title,
    description: advert.description ?? null,
    generated_by: "machine",
    model_or_provider: `${providerName}:unavailable`,
    source_hash: sourceHash,
    status: "draft",
  });

  return draft ? "unavailable" : "reviewed";
}

async function translateTarget(
  service: SupabaseClient<Database>,
  advert: AdvertCandidate,
  targetLocale: string,
): Promise<"translated" | "unavailable" | "reviewed"> {
  const provider = getTranslationProvider();
  const sourceLocale = resolveAdvertSourceLocale(advert.content_locale);
  const sourceHash = buildAdvertSourceHash(advert);

  const translatedTitle = await provider.translate(advert.title, sourceLocale, targetLocale);
  if (translatedTitle === null) {
    return markTranslationUnavailable(service, advert, targetLocale, sourceHash, provider.name);
  }

  const translatedDescription = advert.description?.trim()
    ? await provider.translate(advert.description, sourceLocale, targetLocale)
    : advert.description ?? null;

  if (translatedDescription === null) {
    return markTranslationUnavailable(service, advert, targetLocale, sourceHash, provider.name);
  }

  const draft = await writeDraftTranslation(service, {
    advert_id: advert.id,
    source_locale: sourceLocale,
    target_locale: targetLocale,
    title: translatedTitle,
    description: translatedDescription,
    generated_by: "machine",
    model_or_provider: provider.name,
    source_hash: sourceHash,
    status: "draft",
  });

  if (!draft) return "reviewed";

  const { data, error } = await service
    .from("advert_translations")
    .update({
      title: translatedTitle,
      description: translatedDescription,
      generated_by: "machine",
      model_or_provider: provider.name,
      status: "published",
    })
    .eq("id", draft.id)
    .neq("status", "reviewed")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data ? "translated" : "reviewed";
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Cron auth required" });
  }

  const capability = await getIntegrationStatus("advert_translations");
  if (!capability.effective) {
    return createSuccessResponse({
      disabled: true,
      processed: 0,
      translated: 0,
      unavailable: 0,
      reviewed: 0,
      failed: 0,
    });
  }

  const service = await supabaseService();
  const { data: candidates, error } = await fetchAdvertCandidates(service);

  if (error) {
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, { status: 500, detail: error.message });
  }

  let translated = 0;
  let unavailable = 0;
  let reviewed = 0;
  let failed = 0;

  for (const advert of candidates ?? []) {
    for (const targetLocale of targetsNeedingTranslation(advert)) {
      try {
        const result = await translateTarget(service, advert, targetLocale);
        if (result === "translated") translated++;
        else if (result === "unavailable") unavailable++;
        else reviewed++;
      } catch (err) {
        console.error("translate-adverts cron: error processing", {
          advert_id: advert.id,
          targetLocale,
          err,
        });
        failed++;
      }
    }
  }

  return createSuccessResponse({
    disabled: false,
    processed: candidates?.length ?? 0,
    translated,
    unavailable,
    reviewed,
    failed,
  });
}
