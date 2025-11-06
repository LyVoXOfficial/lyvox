"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/fetcher";
import { supabase } from "@/lib/supabaseClient";
import ReportButton from "@/components/ReportButton";
import { formatCurrency } from "@/i18n/format";
import { logger } from "@/lib/errorLogger";

type MediaItem = {
  id: string;
  url: string | null;
  sort: number | null;
  w: number | null;
  h: number | null;
};

type Advert = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  location: string | null;
  created_at: string;
  specifics?: Record<string, any>;
};

type VehicleMake = {
  id: string;
  name_en: string;
  vehicle_make_i18n?: Array<{ name: string }>;
};

type VehicleModel = {
  id: string;
  name_en: string;
  vehicle_model_i18n?: Array<{ name: string }>;
};

type VehicleColor = {
  id: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string;
};

type VehicleInsights = {
  generation_id: string;
  pros: string[] | null;
  cons: string[] | null;
  inspection_tips: string[] | null;
  notable_features: string[] | null;
  engine_examples: string[] | null;
  common_issues: string[] | null;
  reliability_score: number | null;
  popularity_score: number | null;
  vehicle_generation_insights_i18n?: Array<{
    locale: string;
    pros: string[] | null;
    cons: string[] | null;
    inspection_tips: string[] | null;
    notable_features: string[] | null;
    engine_examples: string[] | null;
    common_issues: string[] | null;
  }>;
};

type VehicleGeneration = {
  id: string;
  model_id: string;
  code: string | null;
  start_year: number | null;
  end_year: number | null;
  facelift: boolean | null;
  summary: string | null;
  name_en: string | null;
  name_ru: string | null;
  body_types: string[] | null;
  fuel_types: string[] | null;
  transmission_types: string[] | null;
  production_countries: string[] | null;
  vehicle_generation_i18n?: Array<{
    locale: string;
    summary: string | null;
    pros: string[] | null;
    cons: string[] | null;
    inspection_tips: string[] | null;
  }>;
};

type VehicleOption = {
  id: string;
  category: string;
  code: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string;
};

export default function AdvertPage() {
  const params = useParams<{ id: string | string[] }>();
  const { locale, t } = useI18n();
  const [advert, setAdvert] = useState<Advert | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [make, setMake] = useState<VehicleMake | null>(null);
  const [model, setModel] = useState<VehicleModel | null>(null);
  const [color, setColor] = useState<VehicleColor | null>(null);
  const [insights, setInsights] = useState<VehicleInsights | null>(null);
  const [generations, setGenerations] = useState<VehicleGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<VehicleGeneration | null>(null);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle both string and array cases for id
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      setError(t("post.not_found") || "Объявление не найдено");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load advert with specifics
        const advertResponse = await apiFetch(`/api/adverts/${id}`);
        console.log(`API response for advert ${id}:`, {
          status: advertResponse.status,
          ok: advertResponse.ok,
        });
        
        if (!advertResponse.ok) {
          const errorData = await advertResponse.json().catch(() => ({}));
          console.error(`API error for advert ${id}:`, errorData);
          throw new Error(t("post.not_found") || "Объявление не найдено");
        }
        const advertData = await advertResponse.json();
        console.log(`API data for advert ${id}:`, {
          ok: advertData.ok,
          hasData: !!advertData.data,
          hasAdvert: !!advertData.data?.advert,
        });
        
        if (!advertData.ok || !advertData.data?.advert) {
          console.error(`Invalid API data for advert ${id}:`, advertData);
          throw new Error(t("post.not_found") || "Объявление не найдено");
        }

        const loadedAdvert = advertData.data.advert as Advert;
        if (!cancelled) {
          setAdvert(loadedAdvert);
        }

        // Load media with signed URLs
        try {
          const mediaResponse = await apiFetch(`/api/media/public?advertId=${id}`);
          console.log(`Media API response for advert ${id}:`, {
            status: mediaResponse.status,
            ok: mediaResponse.ok,
          });
          
          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            console.log(`Media data for advert ${id}:`, {
              ok: mediaData.ok,
              hasData: !!mediaData.data,
              hasItems: !!mediaData.items,
              hasDataItems: !!mediaData.data?.items,
              itemsCount: mediaData.items?.length || mediaData.data?.items?.length || 0,
              fullResponse: mediaData,
            });
            
            // Try both paths: mediaData.items and mediaData.data.items
            const items = mediaData.items || mediaData.data?.items;
            
            if (mediaData.ok && items) {
              console.log(`Setting ${items.length} media items for advert ${id}`);
              if (!cancelled) {
                setMedia(items);
              }
            } else {
              console.warn(`No media items in response for advert ${id}:`, JSON.stringify(mediaData, null, 2));
            }
          } else {
            const errorData = await mediaResponse.json().catch(() => ({}));
            console.error(`Media API error for advert ${id}:`, errorData);
          }
        } catch (mediaError) {
          console.error(`Media loading exception for advert ${id}:`, mediaError);
          logger.warn("Failed to load media for advert", {
            component: "AdvertPage",
            action: "loadMedia",
            metadata: { advertId: id },
            error: mediaError,
          });
        }

        // Load make and model if specified in specifics
        if (loadedAdvert.specifics?.make_id) {
          const { data: makeData } = await supabase
            .from("vehicle_makes")
            .select("id, name_en, vehicle_make_i18n(name)")
            .eq("id", loadedAdvert.specifics.make_id)
            .maybeSingle();

          if (!cancelled && makeData) {
            setMake(makeData as VehicleMake);
          }

          if (loadedAdvert.specifics?.model_id) {
            const { data: modelData } = await supabase
              .from("vehicle_models")
              .select("id, name_en, vehicle_model_i18n(name)")
              .eq("id", loadedAdvert.specifics.model_id)
              .maybeSingle();

            if (!cancelled && modelData) {
              setModel(modelData as VehicleModel);

              // Load insights for this generation if generation_id is available
              const generationId = loadedAdvert.specifics.generation_id;
              
              if (generationId) {
                const { data: insightsData } = await supabase
                  .from("vehicle_generation_insights")
                  .select("*")
                  .eq("generation_id", generationId)
                  .maybeSingle();

                if (!cancelled && insightsData) {
                  // Load translations separately
                  const { data: i18nData } = await supabase
                    .from("vehicle_generation_insights_i18n")
                    .select("locale, pros, cons, inspection_tips, notable_features, engine_examples, common_issues")
                    .eq("generation_id", generationId);

                  // Combine data
                  const combinedInsights = {
                    ...insightsData,
                    vehicle_generation_insights_i18n: i18nData || [],
                  } as VehicleInsights;

                  setInsights(combinedInsights);
                }
              }

              // Load generations for this model
              const { data: generationsData } = await supabase
                .from("vehicle_generations")
                .select("*, vehicle_generation_i18n(locale, summary, pros, cons, inspection_tips)")
                .eq("model_id", loadedAdvert.specifics.model_id)
                .order("start_year", { ascending: true });

              if (!cancelled && generationsData && generationsData.length > 0) {
                setGenerations(generationsData as VehicleGeneration[]);

                // Find generation matching the advert year
                const advertYear = loadedAdvert.specifics?.year
                  ? parseInt(String(loadedAdvert.specifics.year))
                  : null;
                
                let detectedGeneration: VehicleGeneration | null = null;
                
                if (advertYear) {
                  const matchingGen = generationsData.find((gen) => {
                    const startMatch = gen.start_year ? gen.start_year <= advertYear : true;
                    const endMatch = gen.end_year ? gen.end_year >= advertYear : true;
                    return startMatch && endMatch;
                  });
                  
                  if (matchingGen) {
                    detectedGeneration = matchingGen as VehicleGeneration;
                  } else if (generationsData.length === 1) {
                    // If only one generation exists, show it even if year doesn't match
                    detectedGeneration = generationsData[0] as VehicleGeneration;
                  }
                } else if (generationsData.length === 1) {
                  // If no year specified but only one generation, show it
                  detectedGeneration = generationsData[0] as VehicleGeneration;
                }

                if (detectedGeneration) {
                  setSelectedGeneration(detectedGeneration);

                  // Load insights for the detected generation (if not already loaded above)
                  if (!insights && detectedGeneration.id) {
                    const { data: insightsData } = await supabase
                      .from("vehicle_generation_insights")
                      .select("*")
                      .eq("generation_id", detectedGeneration.id)
                      .maybeSingle();

                    if (!cancelled && insightsData) {
                      // Load translations separately
                      const { data: i18nData } = await supabase
                        .from("vehicle_generation_insights_i18n")
                        .select("locale, pros, cons, inspection_tips, notable_features, engine_examples, common_issues")
                        .eq("generation_id", detectedGeneration.id);

                      // Combine data
                      const combinedInsights = {
                        ...insightsData,
                        vehicle_generation_insights_i18n: i18nData || [],
                      } as VehicleInsights;

                      setInsights(combinedInsights);
                    }
                  }
                }
              }
            }
          }
        }

        // Load color if specified in specifics
        if (loadedAdvert.specifics?.color_id) {
          const { data: colorData } = await supabase
            .from("vehicle_colors")
            .select("id, name_en, name_nl, name_fr, name_de, name_ru")
            .eq("id", loadedAdvert.specifics.color_id)
            .maybeSingle();

          if (!cancelled && colorData) {
            setColor(colorData as VehicleColor);
          }
        }

        // Load vehicle options for i18n labels
        const { data: optionsData } = await supabase
          .from("vehicle_options")
          .select("id, category, code, name_en, name_nl, name_fr, name_de, name_ru")
          .order("category, name_ru");

        if (!cancelled && optionsData) {
          setVehicleOptions(optionsData as VehicleOption[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          // Check if error message is already translated or needs translation
          let errorMessage = err.message;
          if (errorMessage === "Advert not found" || errorMessage === "Failed to load advert") {
            errorMessage = t("post.not_found") || "Объявление не найдено";
          } else if (!errorMessage || errorMessage === "Failed to load advert") {
            errorMessage = t("post.not_found") || "Объявление не найдено";
          }
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) {
    const loadingText = String(t("common.loading") || "Загрузка…");
    return <p className="text-center py-8">{loadingText}</p>;
  }

  if (error || !advert) {
    const errorText = String(error || t("post.not_found") || "Объявление не найдено");
    return (
      <p className="text-sm text-red-600 text-center py-8">
        {errorText}
      </p>
    );
  }

  const priceText =
    typeof advert.price === "number"
      ? formatCurrency(advert.price, locale, advert.currency || "EUR")
      : t("advert.price_not_specified") || "Цена не указана";

  const locationText = advert.location || t("advert.location_not_specified") || "Местоположение не указано";
  const createdText = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "nl" ? "nl-NL" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(advert.created_at));

  const getMakeName = () => {
    if (!make) return null;
    const i18nName = make.vehicle_make_i18n?.find((i) => i.name)?.name;
    return i18nName || make.name_en;
  };

  const getModelName = () => {
    if (!model) return null;
    const i18nName = model.vehicle_model_i18n?.find((i) => i.name)?.name;
    return i18nName || model.name_en;
  };

  const getColorName = () => {
    if (!color) return null;
    const localeMap: Record<string, keyof VehicleColor> = {
      en: "name_en",
      nl: "name_nl",
      fr: "name_fr",
      de: "name_de",
      ru: "name_ru",
    };
    const nameKey = localeMap[locale] || "name_en";
    return (color[nameKey] as string) || color.name_ru || color.name_en || null;
  };

  // Get translated insights based on current locale
  const getTranslatedInsights = () => {
    if (!insights) return null;
    
    // Try to find translation for current locale
    const translation = insights.vehicle_generation_insights_i18n?.find((i) => i.locale === locale);
    
    if (translation) {
      return {
        pros: translation.pros || insights.pros || [],
        cons: translation.cons || insights.cons || [],
        inspection_tips: translation.inspection_tips || insights.inspection_tips || [],
        notable_features: translation.notable_features || insights.notable_features || [],
        engine_examples: translation.engine_examples || insights.engine_examples || [],
        common_issues: translation.common_issues || insights.common_issues || [],
      };
    }
    
    // Fallback to original insights
    return {
      pros: insights.pros || [],
      cons: insights.cons || [],
      inspection_tips: insights.inspection_tips || [],
      notable_features: insights.notable_features || [],
      engine_examples: insights.engine_examples || [],
      common_issues: insights.common_issues || [],
    };
  };

  const translatedInsights = getTranslatedInsights();

  const specifics = advert.specifics || {};
  const hasVehicleSpecs = specifics.make_id || specifics.model_id || specifics.year;

  // Helper to translate spec values
  const translateValue = (key: string, value: string): string => {
    if (!value) return value;
    
    // Map common values to translation keys
    const valueMap: Record<string, string> = {
      right: t("advert.value_right") || "Right",
      left: t("advert.value_left") || "Left",
      rwd: t("advert.value_rwd") || "Rear wheel drive",
      fwd: t("advert.value_fwd") || "Front wheel drive",
      awd: t("advert.value_awd") || "All wheel drive",
      "4wd": t("advert.value_4wd") || "Four wheel drive",
      electric: t("advert.value_electric") || "Electric",
      hybrid: t("advert.value_hybrid") || "Hybrid",
      petrol: t("advert.value_petrol") || "Petrol",
      diesel: t("advert.value_diesel") || "Diesel",
      automatic: t("advert.value_automatic") || "Automatic",
      manual: t("advert.value_manual") || "Manual",
      cvt: t("advert.value_cvt") || "CVT",
      not_damaged: t("advert.value_not_damaged") || "Not damaged",
      damaged: t("advert.value_damaged") || "Damaged",
      salvage: t("advert.value_salvage") || "Salvage",
    };
    
    // Try exact match first
    const lowerValue = value.toLowerCase().trim();
    if (valueMap[lowerValue]) {
      return valueMap[lowerValue];
    }
    
    // Try partial match for complex values like "Automatic (Single Speed)"
    for (const [key, translated] of Object.entries(valueMap)) {
      if (lowerValue.includes(key)) {
        // Replace the key with translation, preserving rest
        return value.replace(new RegExp(key, "gi"), translated);
      }
    }
    
    return value;
  };

  // Helper to format specs
  const formatSpecValue = (key: string, value: any): string | null => {
    if (!value || value === "") return null;
    
    const strValue = String(value);
    
    // Format specific values
    if (key === "mileage" && typeof value === "string") {
      return `${parseInt(strValue).toLocaleString()} km`;
    }
    if (key === "power" && typeof value === "string") {
      return `${strValue} ${t("advert.hp") || "л.с."}`;
    }
    if (key === "engine_volume" && typeof value === "string") {
      return `${strValue} ${t("advert.liters") || "л"}`;
    }
    if (key === "owners_count" && typeof value === "string") {
      return strValue;
    }
    
    // Translate common values
    if (["steering_wheel", "drive", "engine_type", "transmission", "vehicle_condition"].includes(key)) {
      return translateValue(key, strValue);
    }
    
    return strValue;
  };

  const specLabels: Record<string, string> = {
    year: t("advert.year") || "Год",
    steering_wheel: t("advert.steering_wheel") || "Руль",
    body_type: t("advert.body_type") || "Тип кузова",
    doors: t("advert.doors") || "Двери",
    color_id: t("advert.color") || "Цвет",
    power: t("advert.power") || "Мощность",
    engine_type: t("advert.engine_type") || "Тип двигателя",
    engine_volume: t("advert.engine_volume") || "Объем двигателя",
    transmission: t("advert.transmission") || "Коробка передач",
    drive: t("advert.drive") || "Привод",
    mileage: t("advert.mileage") || "Пробег",
    vehicle_condition: t("advert.condition") || "Состояние",
    customs_cleared: t("advert.customs_cleared") || "Растаможен",
    under_warranty: t("advert.warranty") || "Гарантия",
    owners_count: t("advert.owners") || "Владельцев",
    vin: t("advert.vin") || "VIN",
  };

  // Get localized option name from database
  const getOptionName = (optionKey: string): string => {
    // Parse category and code from optionKey (format: "category_code")
    const parts = optionKey.split("_");
    if (parts.length < 2) return optionKey;

    const category = parts[0];
    const code = parts.slice(1).join("_");

    // Find option in database
    const option = vehicleOptions.find(
      (opt) => opt.category === category && opt.code === code
    );

    if (option) {
      // Return localized name based on current locale
      const localeMap: Record<string, keyof VehicleOption> = {
        en: "name_en",
        nl: "name_nl",
        fr: "name_fr",
        de: "name_de",
        ru: "name_ru",
      };
      const nameKey = localeMap[locale] || "name_en";
      return (option[nameKey] as string) || option.name_ru || option.name_en || optionKey;
    }

    // Fallback to static translations for backwards compatibility
    const optionLabels: Record<string, string> = {
      air_conditioning: t("advert.option_ac") || "Кондиционер",
      navigation: t("advert.option_nav") || "Навигация",
      parking_sensors: t("advert.option_parking") || "Парктроники",
      leather_seats: t("advert.option_leather") || "Кожаные сиденья",
      sunroof: t("advert.option_sunroof") || "Люк",
      multimedia: t("advert.option_multimedia") || "Мультимедиа",
      safety_abs: t("advert.option_safety_abs") || "ABS",
      safety_asr: t("advert.option_safety_asr") || "ASR / Система контроля тяги",
      comfort_heated_seats: t("advert.option_comfort_heated_seats") || "Подогрев сидений",
    };

    return optionLabels[optionKey] || optionKey;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{advert.title}</h1>
        <ReportButton advertId={advert.id} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          {media.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((m) =>
                m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted/60 text-center text-sm text-muted-foreground">
              <div className="flex h-full items-center justify-center">
                {t("advert.no_photos") || "Фото отсутствуют"}
              </div>
            </div>
          )}
        </div>

        <aside className="w-full max-w-xs space-y-3 rounded-2xl border p-4 text-sm">
          <div className="text-xl font-semibold">{priceText}</div>
          <div className="text-muted-foreground">{locationText}</div>
          <div className="text-xs text-muted-foreground">
            {t("advert.posted") || "Размещено"}: {createdText}
          </div>
        </aside>
      </div>

      {hasVehicleSpecs && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.vehicle_specs") || "Характеристики автомобиля"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {getMakeName() && (
              <div>
                <span className="text-muted-foreground">{t("advert.make") || "Марка"}: </span>
                <span className="font-medium">{getMakeName()}</span>
              </div>
            )}
            {getModelName() && (
              <div>
                <span className="text-muted-foreground">{t("advert.model") || "Модель"}: </span>
                <span className="font-medium">{getModelName()}</span>
              </div>
            )}
            {getColorName() && (
              <div>
                <span className="text-muted-foreground">{t("advert.color") || "Цвет"}: </span>
                <span className="font-medium">{getColorName()}</span>
              </div>
            )}
            {Object.entries(specifics).map(([key, value]) => {
              // Skip internal keys and options
              if (key.startsWith("option_") || key === "make_id" || key === "model_id" || key === "color_id" || key === "additional_phone") {
                return null;
              }
              
              const formatted = formatSpecValue(key, value);
              if (!formatted) return null;

              const label = specLabels[key];
              if (!label) return null;

              // Special handling for boolean values
              if (key === "customs_cleared" || key === "under_warranty") {
                const boolValue = value === "yes" || value === true;
                return (
                  <div key={key}>
                    <span className="text-muted-foreground">{label}: </span>
                    <span className="font-medium">{boolValue ? t("common.yes") || "Да" : t("common.no") || "Нет"}</span>
                  </div>
                );
              }

              return (
                <div key={key}>
                  <span className="text-muted-foreground">{label}: </span>
                  <span className="font-medium">{formatted}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Object.keys(specifics).some((key) => key.startsWith("option_") && specifics[key]) && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.options") || "Опции"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(specifics)
              .filter(([key]) => key.startsWith("option_"))
              .filter(([, value]) => value && value !== "false")
              .map(([key, value]) => {
                const optionKey = key.replace("option_", "");
                const label = getOptionName(optionKey);
                return (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                  >
                    {label}
                  </span>
                );
              })}
          </div>
        </section>
      )}

      {selectedGeneration && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.generation.title") || "Поколение"}
          </h2>
          
          <div className="space-y-4">
            {selectedGeneration.code && (
              <div>
                <span className="text-sm font-semibold">
                  {t("advert.generation.code") || "Код"}: {selectedGeneration.code}
                </span>
                {selectedGeneration.facelift && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({t("advert.generation.facelift") || "Рестайлинг"})
                  </span>
                )}
              </div>
            )}

            {(selectedGeneration.start_year || selectedGeneration.end_year) && (
              <div className="text-sm text-muted-foreground">
                {t("advert.generation.years") || "Годы производства"}:{" "}
                {selectedGeneration.start_year}
                {selectedGeneration.end_year
                  ? ` - ${selectedGeneration.end_year}`
                  : ` - ${t("advert.generation.present") || "н.в."}`}
              </div>
            )}

            {(() => {
              const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                (i) => i.locale === locale
              );
              const summary = i18nData?.summary || selectedGeneration.summary;
              return summary;
            })() && (
              <div>
                <p className="text-sm text-foreground/90">
                  {(() => {
                    const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                      (i) => i.locale === locale
                    );
                    return i18nData?.summary || selectedGeneration.summary;
                  })()}
                </p>
              </div>
            )}

            {(() => {
              const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                (i) => i.locale === locale
              );
              const pros = i18nData?.pros || null;
              return pros && pros.length > 0;
            })() && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  {t("advert.insights.pros") || "Плюсы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {(() => {
                    const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                      (i) => i.locale === locale
                    );
                    return (i18nData?.pros || []).map((pro, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400">✓</span>
                        <span>{pro}</span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            )}

            {(() => {
              const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                (i) => i.locale === locale
              );
              const cons = i18nData?.cons || null;
              return cons && cons.length > 0;
            })() && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("advert.insights.cons") || "Минусы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {(() => {
                    const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                      (i) => i.locale === locale
                    );
                    return (i18nData?.cons || []).map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400">✗</span>
                        <span>{con}</span>
                      </li>
                    ));
                  })()}
                </ul>
              </div>
            )}

            {(() => {
              const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                (i) => i.locale === locale
              );
              const tips = i18nData?.inspection_tips || null;
              return tips && tips.length > 0;
            })() && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.inspection_tips") || "Советы по осмотру"}
                </h3>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  {(() => {
                    const i18nData = selectedGeneration.vehicle_generation_i18n?.find(
                      (i) => i.locale === locale
                    );
                    return (i18nData?.inspection_tips || []).map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ));
                  })()}
                </ul>
              </div>
            )}

            {selectedGeneration.production_countries && selectedGeneration.production_countries.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.generation.production_countries") || "Страны производства"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedGeneration.production_countries.map((country, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                    >
                      {country}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {insights && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.insights.title") || "Информация о модели"}
          </h2>
          
          <div className="space-y-6">
            {translatedInsights?.pros && translatedInsights.pros.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  {t("advert.insights.pros") || "Плюсы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {translatedInsights.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {translatedInsights?.cons && translatedInsights.cons.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("advert.insights.cons") || "Минусы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {translatedInsights.cons.map((con, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400">✗</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {translatedInsights?.inspection_tips && translatedInsights.inspection_tips.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.inspection_tips") || "Советы по осмотру"}
                </h3>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  {translatedInsights.inspection_tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {translatedInsights?.notable_features && translatedInsights.notable_features.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.notable_features") || "Примечательные особенности"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {translatedInsights.notable_features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {translatedInsights?.engine_examples && translatedInsights.engine_examples.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.engine_examples") || "Примеры двигателей"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {translatedInsights.engine_examples.map((engine, idx) => (
                    <li key={idx}>{engine}</li>
                  ))}
                </ul>
              </div>
            )}

            {translatedInsights?.common_issues && translatedInsights.common_issues.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.common_issues") || "Общие проблемы"}
                </h3>
                <ul className="space-y-1 text-sm list-disc list-inside text-orange-600 dark:text-orange-400">
                  {translatedInsights.common_issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {(insights.reliability_score !== null || insights.popularity_score !== null) && (
              <div className="flex gap-4 pt-2 border-t">
                {insights.reliability_score !== null && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t("advert.insights.reliability") || "Надежность"}:{" "}
                    </span>
                    <span className="text-sm font-medium">
                      {insights.reliability_score.toFixed(1)}/10
                    </span>
                  </div>
                )}
                {insights.popularity_score !== null && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t("advert.insights.popularity") || "Популярность"}:{" "}
                    </span>
                    <span className="text-sm font-medium">
                      {insights.popularity_score.toFixed(1)}/10
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-medium">{t("advert.description") || "Описание"}</h2>
        <p className="whitespace-pre-wrap text-sm text-foreground/90">
          {advert.description || t("advert.no_description") || "Описания пока нет."}
        </p>
      </section>
    </div>
  );
}