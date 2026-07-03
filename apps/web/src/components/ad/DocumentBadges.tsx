import { BadgeCheck } from "lucide-react";

type TFunction = (key: string, fallback: string) => string;

type Props = {
  categoryType: string;
  specifics: Record<string, any>;
  t: TFunction;
};

export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === "" || value === false) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).toLowerCase();
  if (/^[0-9a-f]{8}-/i.test(s)) return false;
  return s !== "false" && s !== "0" && s !== "no";
}

type Badge = { label: string; color: string };

export function DocumentBadges({ categoryType, specifics, t }: Props) {
  const badges: Badge[] = [];

  if (categoryType === "vehicle") {
    if (isTruthy(specifics.car_pass) || isTruthy(specifics.has_car_pass)) {
      badges.push({
        label: t("advert.document_badge.car_pass", "Car-Pass"),
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      });
    }
  }

  if (categoryType === "real_estate") {
    const epc = specifics.epc_rating ?? specifics.peb_rating ?? specifics.epc ?? null;
    if (epc) {
      badges.push({
        label: `${t("advert.document_badge.epc", "EPC")} ${String(epc).toUpperCase()}`,
        color: "text-blue-700 bg-blue-50 border-blue-200",
      });
    }
  }

  if (categoryType === "baby_kids") {
    const safetyCertified =
      specifics.safety_certified ?? specifics.catalog_field_baby_safety_certified;
    if (isTruthy(safetyCertified)) {
      badges.push({
        label: t("advert.document_badge.safety_certified", "Safety certified"),
        color: "text-violet-700 bg-violet-50 border-violet-200",
      });
    }
  }

  if (categoryType === "pets") {
    if (isTruthy(specifics.microchip) || isTruthy(specifics.chipped)) {
      badges.push({
        label: t("advert.document_badge.microchip", "Microchipped"),
        color: "text-teal-700 bg-teal-50 border-teal-200",
      });
    }
  }

  if (!badges.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.color}`}
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {badge.label}
        </span>
      ))}
    </div>
  );
}
