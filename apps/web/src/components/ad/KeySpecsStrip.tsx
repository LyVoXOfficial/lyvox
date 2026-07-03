import type { Locale } from "@/lib/i18n";

type TFunction = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  categoryType: string;
  specifics: Record<string, any>;
  locale: Locale;
  makeName: string | null;
  modelName: string | null;
  location: string | null;
  t: TFunction;
};

function translateFallback(t: TFunction, key: string, fallback: string): string {
  const result = t(key);
  return result === key ? fallback : result;
}

function formatMileage(value: unknown, locale: Locale): string | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${num.toLocaleString(locale === "ru" ? "ru-RU" : locale === "nl" ? "nl-NL" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "en-US")} km`;
}

function specValue(specifics: Record<string, any>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (specifics[k] !== undefined && specifics[k] !== null && specifics[k] !== "") {
      return specifics[k];
    }
  }
  return null;
}

function translateSpec(t: TFunction, value: string): string {
  const MAP: Record<string, [string, string]> = {
    petrol:    ["advert.value_petrol", "Petrol"],
    diesel:    ["advert.value_diesel", "Diesel"],
    electric:  ["advert.value_electric", "Electric"],
    hybrid:    ["advert.value_hybrid", "Hybrid"],
    automatic: ["advert.value_automatic", "Automatic"],
    manual:    ["advert.value_manual", "Manual"],
    cvt:       ["advert.value_cvt", "CVT"],
    fwd:       ["advert.value_fwd", "FWD"],
    rwd:       ["advert.value_rwd", "RWD"],
    awd:       ["advert.value_awd", "AWD"],
  };
  const entry = MAP[String(value).toLowerCase()];
  return entry ? translateFallback(t, entry[0], entry[1]) : String(value);
}

function buildVehicleChips(
  specifics: Record<string, any>,
  locale: Locale,
  location: string | null,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  // Fixed priority: year → mileage → fuel → transmission → body_type → city
  const year = specValue(specifics, "year");
  if (year) chips.push(String(year));
  const mileage = specValue(specifics, "mileage");
  if (mileage) { const m = formatMileage(mileage, locale); if (m) chips.push(m); }
  const fuel = specValue(specifics, "engine_type", "fuel_type", "fuel");
  if (fuel) chips.push(translateSpec(t, String(fuel)));
  const trans = specValue(specifics, "transmission");
  if (trans) chips.push(translateSpec(t, String(trans)));
  const body = specValue(specifics, "body_type");
  if (body) chips.push(String(body));
  if (location && chips.length < 6) chips.push(location);
  return chips;
}

function buildRealEstateChips(
  specifics: Record<string, any>,
  location: string | null,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  const listingType = specValue(specifics, "listing_type");
  if (listingType) chips.push(translateSpec(t, String(listingType)));
  const propType = specValue(specifics, "property_type");
  if (propType) chips.push(String(propType));
  const area = specValue(specifics, "area_m2", "area");
  if (area) chips.push(`${area} m²`);
  const rooms = specValue(specifics, "rooms");
  if (rooms) chips.push(`${rooms} ${translateFallback(t, "advert.rooms", "rooms")}`);
  if (location && chips.length < 5) chips.push(location);
  return chips;
}

function buildElectronicsChips(
  specifics: Record<string, any>,
  makeName: string | null,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  const brand = makeName ?? specValue(specifics, "brand");
  if (brand) chips.push(String(brand));
  const storage = specValue(specifics, "storage", "storage_gb");
  if (storage) chips.push(`${storage} GB`);
  const condition = specValue(specifics, "condition", "vehicle_condition");
  if (condition) chips.push(String(condition));
  const battery = specValue(specifics, "battery_health");
  if (battery) chips.push(`${battery}%`);
  return chips;
}

function buildFashionChips(
  specifics: Record<string, any>,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  const brand = specValue(specifics, "brand");
  if (brand) chips.push(String(brand));
  const size = specValue(specifics, "size");
  if (size) chips.push(String(size));
  const gender = specValue(specifics, "gender");
  if (gender) chips.push(String(gender));
  const condition = specValue(specifics, "condition");
  if (condition) chips.push(String(condition));
  return chips;
}

function buildJobsChips(
  specifics: Record<string, any>,
  location: string | null,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  const jobCat = specValue(specifics, "job_category");
  if (jobCat) chips.push(String(jobCat));
  const contractType = specValue(specifics, "contract_type");
  if (contractType) chips.push(String(contractType));
  if (location) chips.push(location);
  return chips;
}

function buildPetsChips(
  specifics: Record<string, any>,
  t: TFunction,
): string[] {
  const chips: string[] = [];
  const breed = specValue(specifics, "pet_breed", "breed");
  if (breed) chips.push(String(breed));
  const age = specValue(specifics, "age_months");
  if (age) chips.push(`${age} ${translateFallback(t, "advert.months", "mo")}`);
  const vaccinated = specValue(specifics, "vaccinated");
  if (vaccinated === true || vaccinated === "true" || vaccinated === "yes") {
    chips.push(translateFallback(t, "advert.vaccinated", "Vaccinated"));
  }
  return chips;
}

export function KeySpecsStrip({
  categoryType,
  specifics,
  locale,
  makeName,
  modelName,
  location,
  t,
}: Props) {
  let chips: string[];

  switch (categoryType) {
    case "vehicle":
      chips = buildVehicleChips(specifics, locale, location, t);
      break;
    case "real_estate":
      chips = buildRealEstateChips(specifics, location, t);
      break;
    case "electronics":
      chips = buildElectronicsChips(specifics, makeName, t);
      break;
    case "fashion":
      chips = buildFashionChips(specifics, t);
      break;
    case "jobs":
      chips = buildJobsChips(specifics, location, t);
      break;
    case "pets":
      chips = buildPetsChips(specifics, t);
      break;
    default:
      chips = [];
      if (location) chips.push(location);
      break;
  }

  const visible = chips.filter(Boolean).slice(0, 6);
  if (visible.length < 2) return null;

  return (
    <div
      role="list"
      aria-label={translateFallback(t, "advert.key_specs_label", "Key specifications")}
      className="flex flex-wrap items-center gap-2"
    >
      {visible.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          role="listitem"
          className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
