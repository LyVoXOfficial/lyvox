# PRD 62 — Listing Cards per Category + KB Implementation Plan

> [!WARNING]
> **ARCHIVED IMPLEMENTATION PLAN — DO NOT EXECUTE AS A BACKLOG.** Этот документ сохраняется как история уже принятого технического подхода. Он не задаёт текущие priority/status/order и не разрешает правки. Единственный рабочий источник: [`docs/MASTER_PRODUCTION_TZ.md`](../../MASTER_PRODUCTION_TZ.md).

**Goal:** Add per-category key-specs strip, document badges, F13 CatalogGroupTabs (readonly) detail renderer, and KB block with disclaimer + ambiguous-generation CTA to the ad detail page (`ad/[id]`).

**Architecture:** Four thin new components + one server utility. All existing data is already loaded in `loadAdvertData()`; we add a parallel `loadCatalogGroups(domain, supabase)` call for the F13 schema. The page (`app/ad/[id]/page.tsx`) wires everything. No new DB tables (non-transport KB tables are §13 follow-up). Bug #1996 (`determineGeneration` `.find()`) is already fixed in F7 — no changes needed there.

**Tech Stack:** Next.js 16 App Router (Server Components + one new Client Component wrapper), React 19, TypeScript, Supabase Postgres, react-i18next.

## Global Constraints

- `pnpm typecheck && pnpm test && pnpm lint` must stay green.
- All UI strings through `t()` / `translateFallback()` — no hardcoded copy.
- Five locales at parity: `en`, `fr`, `nl`, `de`, `ru`. Add keys to all five files.
- `CatalogGroupTabs` is already `"use client"` — any wrapper must also be client or pass serializable props.
- No new KB tables for electronics/pets/fashion this round — leave a `// TODO §13:` comment where that would go.
- Atomic commits per task: `feat(62-keyspecs)`, `feat(62-catalog-details)`, `feat(62-doc-badges)`, `feat(62-kb-block)`, `feat(62-i18n)`, `docs(62-status)`.
- Branch: `feat/62-listing-cards` (already active).

---

### Task 1: `loadCatalogGroups` server helper + `CatalogDetailsSection` client wrapper

**Files:**
- Create: `apps/web/src/lib/catalog/loadCatalogGroups.ts`
- Create: `apps/web/src/components/ad/CatalogDetailsSection.tsx`

**Interfaces:**
- `loadCatalogGroups(domain: string, supabase: AnySupabase): Promise<{ groups: CatalogSchemaGroup[]; fields: Record<string, CatalogFieldDefinition> }>`
- `CatalogDetailsSection` props: `{ groups: CatalogSchemaGroup[]; fields: Record<string, CatalogFieldDefinition>; values: Record<string, unknown>; locale: string }`

- [ ] **Step 1: Write `loadCatalogGroups.ts`**

Create `apps/web/src/lib/catalog/loadCatalogGroups.ts`:

```typescript
import type { CatalogFieldDefinition, CatalogSchemaGroup } from "@/catalog/renderer/types";

type AnySupabase = { from: (table: string) => any };

export async function loadCatalogGroups(
  domain: string,
  supabase: AnySupabase,
): Promise<{ groups: CatalogSchemaGroup[]; fields: Record<string, CatalogFieldDefinition> }> {
  const empty = { groups: [], fields: {} };

  const { data: groupRows, error: groupErr } = await supabase
    .from("catalog_groups")
    .select("group_key, display, tab_key, tab_order, label_i18n_key")
    .eq("domain", domain)
    .order("tab_order", { ascending: true });

  if (groupErr || !groupRows?.length) return empty;

  const groupKeys: string[] = groupRows.map((g: any) => g.group_key);

  const { data: fieldRows, error: fieldErr } = await supabase
    .from("catalog_fields")
    .select(
      "id, field_key, label_i18n_key, description_i18n_key, field_type, domain, is_required, unit, min_value, max_value, pattern, group_key, sort, metadata",
    )
    .in("group_key", groupKeys)
    .order("sort", { ascending: true });

  if (fieldErr || !fieldRows?.length) return empty;

  const fieldIds: string[] = fieldRows.map((f: any) => f.id);

  const { data: optionRows } = await supabase
    .from("catalog_field_options")
    .select("field_id, code, name_i18n_key, sort, metadata")
    .in("field_id", fieldIds);

  const optsByFieldId = ((optionRows ?? []) as any[]).reduce<Record<string, any[]>>(
    (acc, opt) => {
      if (!acc[opt.field_id]) acc[opt.field_id] = [];
      acc[opt.field_id].push(opt);
      return acc;
    },
    {},
  );

  const fields: Record<string, CatalogFieldDefinition> = {};
  for (const f of fieldRows as any[]) {
    fields[f.field_key] = {
      field_key: f.field_key,
      label_i18n_key: f.label_i18n_key,
      description_i18n_key: f.description_i18n_key,
      field_type: f.field_type,
      domain: f.domain,
      is_required: Boolean(f.is_required),
      unit: f.unit,
      min_value: f.min_value,
      max_value: f.max_value,
      pattern: f.pattern,
      group_key: f.group_key,
      sort: f.sort,
      metadata: (f.metadata && typeof f.metadata === "object" && !Array.isArray(f.metadata))
        ? (f.metadata as Record<string, unknown>)
        : {},
      options: (optsByFieldId[f.id] ?? []).map((opt: any) => ({
        code: opt.code,
        name_i18n_key: opt.name_i18n_key,
        sort: opt.sort ?? null,
        metadata: (opt.metadata && typeof opt.metadata === "object" && !Array.isArray(opt.metadata))
          ? (opt.metadata as Record<string, unknown>)
          : {},
      })),
    };
  }

  const groups: CatalogSchemaGroup[] = (groupRows as any[]).map((g) => ({
    key: g.group_key,
    title_i18n_key: g.label_i18n_key ?? undefined,
    display: (g.display === "tab" || g.display === "section") ? g.display : "section",
    tab_key: g.tab_key ?? g.group_key,
    tab_order: g.tab_order ?? 0,
    fields: (fieldRows as any[])
      .filter((f) => f.group_key === g.group_key)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((f) => ({ field_key: f.field_key })),
  }));

  return { groups, fields };
}
```

- [ ] **Step 2: Write `CatalogDetailsSection.tsx`**

Create `apps/web/src/components/ad/CatalogDetailsSection.tsx`:

```typescript
"use client";

import { CatalogGroupTabs } from "@/catalog/renderer/CatalogGroupTabs";
import type { CatalogFieldDefinition, CatalogSchemaGroup } from "@/catalog/renderer/types";

type Props = {
  groups: CatalogSchemaGroup[];
  fields: Record<string, CatalogFieldDefinition>;
  values: Record<string, unknown>;
  locale: string;
};

export function CatalogDetailsSection({ groups, fields, values, locale }: Props) {
  if (!groups.length) return null;
  return (
    <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <CatalogGroupTabs
        groups={groups}
        fields={fields}
        values={values}
        onChange={() => {}}
        locale={locale}
        readonly
      />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/catalog/loadCatalogGroups.ts apps/web/src/components/ad/CatalogDetailsSection.tsx
git commit -m "feat(62-catalog-details): loadCatalogGroups helper + CatalogDetailsSection readonly wrapper"
```

---

### Task 2: `KeySpecsStrip` server component

**Files:**
- Create: `apps/web/src/components/ad/KeySpecsStrip.tsx`

**Interfaces:**
- Consumes: `categoryType: string` (output of `detectCategoryType()`), `specifics: Record<string, any>`, `locale: Locale`, `makeName: string | null`, `modelName: string | null`, `t: TFunction`
- Produces: horizontal chip strip — returns `null` when fewer than 2 chips can be built

- [ ] **Step 1: Write `KeySpecsStrip.tsx`**

Create `apps/web/src/components/ad/KeySpecsStrip.tsx`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ad/KeySpecsStrip.tsx
git commit -m "feat(62-keyspecs): KeySpecsStrip — per-category chips in fixed priority order"
```

---

### Task 3: `DocumentBadges` server component

**Files:**
- Create: `apps/web/src/components/ad/DocumentBadges.tsx`

**Interfaces:**
- Props: `{ categoryType: string; specifics: Record<string, any>; t: TFunction }`
- Returns badges for Car-Pass (vehicle), EPC (real_estate), Safety certified (baby_kids), Microchip (pets)
- Returns `null` if no badges apply

- [ ] **Step 1: Write `DocumentBadges.tsx`**

Create `apps/web/src/components/ad/DocumentBadges.tsx`:

```typescript
import { BadgeCheck } from "lucide-react";

type TFunction = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  categoryType: string;
  specifics: Record<string, any>;
  t: TFunction;
};

function translateFallback(t: TFunction, key: string, fallback: string): string {
  const result = t(key);
  return result === key ? fallback : result;
}

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === "" || value === false) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).toLowerCase();
  return s !== "false" && s !== "0" && s !== "no";
}

type Badge = { label: string; color: string };

export function DocumentBadges({ categoryType, specifics, t }: Props) {
  const badges: Badge[] = [];

  if (categoryType === "vehicle") {
    if (isTruthy(specifics.car_pass) || isTruthy(specifics.has_car_pass)) {
      badges.push({
        label: translateFallback(t, "advert.document_badge.car_pass", "Car-Pass"),
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      });
    }
  }

  if (categoryType === "real_estate") {
    const epc = specifics.epc_rating ?? specifics.peb_rating ?? specifics.epc;
    if (epc) {
      badges.push({
        label: `${translateFallback(t, "advert.document_badge.epc", "EPC")} ${String(epc).toUpperCase()}`,
        color: "text-blue-700 bg-blue-50 border-blue-200",
      });
    }
  }

  if (categoryType === "baby_kids") {
    if (isTruthy(specifics.safety_certified)) {
      badges.push({
        label: translateFallback(t, "advert.document_badge.safety_certified", "Safety certified"),
        color: "text-violet-700 bg-violet-50 border-violet-200",
      });
    }
  }

  if (categoryType === "pets") {
    if (isTruthy(specifics.microchip) || isTruthy(specifics.chipped)) {
      badges.push({
        label: translateFallback(t, "advert.document_badge.microchip", "Microchipped"),
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ad/DocumentBadges.tsx
git commit -m "feat(62-doc-badges): DocumentBadges — Car-Pass/EPC/Safety/Microchip per category"
```

---

### Task 4: i18n keys — all 5 locale files

**Files:**
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/web/src/i18n/locales/fr.json`
- Modify: `apps/web/src/i18n/locales/nl.json`
- Modify: `apps/web/src/i18n/locales/de.json`
- Modify: `apps/web/src/i18n/locales/ru.json`

New keys (add under `"advert"` object):

**en:**
```json
"document_badge": {
  "car_pass": "Car-Pass",
  "epc": "EPC",
  "safety_certified": "Safety certified",
  "microchip": "Microchipped"
},
"key_specs_label": "Key specifications",
"rooms": "rooms",
"months": "mo",
"vaccinated": "Vaccinated",
"kb": {
  "disclaimer": "Reference info. LyVoX knowledge base — general model information, not a guarantee for this specific item.",
  "no_generation_title": "About this model",
  "no_generation_body": "The production generation was not specified. Edit the listing to add it and unlock model insights.",
  "no_generation_edit_link": "Edit listing"
}
```

**fr:**
```json
"document_badge": {
  "car_pass": "Car-Pass",
  "epc": "PEB",
  "safety_certified": "Certifié conforme",
  "microchip": "Pucé"
},
"key_specs_label": "Caractéristiques clés",
"rooms": "pièces",
"months": "mois",
"vaccinated": "Vacciné",
"kb": {
  "disclaimer": "Info de référence. Base de connaissances LyVoX — informations générales sur le modèle, sans garantie sur ce bien spécifique.",
  "no_generation_title": "À propos du modèle",
  "no_generation_body": "La génération de production n'est pas précisée. Modifiez l'annonce pour débloquer les informations sur le modèle.",
  "no_generation_edit_link": "Modifier l'annonce"
}
```

**nl:**
```json
"document_badge": {
  "car_pass": "Car-Pass",
  "epc": "EPC",
  "safety_certified": "Veiligheidsgecertificeerd",
  "microchip": "Gechipt"
},
"key_specs_label": "Belangrijkste specificaties",
"rooms": "kamers",
"months": "mnd",
"vaccinated": "Gevaccineerd",
"kb": {
  "disclaimer": "Referentie-info. LyVoX kennisbank — algemene modelinformatie, geen garantie voor dit specifieke artikel.",
  "no_generation_title": "Over dit model",
  "no_generation_body": "De productiegeneratie is niet opgegeven. Bewerk de advertentie om modelinformatie te ontgrendelen.",
  "no_generation_edit_link": "Advertentie bewerken"
}
```

**de:**
```json
"document_badge": {
  "car_pass": "Car-Pass",
  "epc": "EPC",
  "safety_certified": "Sicherheitszertifiziert",
  "microchip": "Gechipt"
},
"key_specs_label": "Wichtigste Merkmale",
"rooms": "Zimmer",
"months": "Mon.",
"vaccinated": "Geimpft",
"kb": {
  "disclaimer": "Referenzinfo. LyVoX-Wissensdatenbank — allgemeine Modellinformationen, keine Garantie für dieses spezifische Objekt.",
  "no_generation_title": "Über dieses Modell",
  "no_generation_body": "Die Produktionsgeneration wurde nicht angegeben. Bearbeiten Sie die Anzeige, um Modellinformationen freizuschalten.",
  "no_generation_edit_link": "Anzeige bearbeiten"
}
```

**ru:**
```json
"document_badge": {
  "car_pass": "Car-Pass",
  "epc": "EPC",
  "safety_certified": "Сертифицировано",
  "microchip": "Чипирован"
},
"key_specs_label": "Ключевые характеристики",
"rooms": "комн.",
"months": "мес.",
"vaccinated": "Вакцинирован",
"kb": {
  "disclaimer": "Справочно. База знаний LyVoX — общие сведения о модели, не гарантия по конкретному товару.",
  "no_generation_title": "Об этой модели",
  "no_generation_body": "Поколение производства не указано. Отредактируйте объявление, чтобы добавить его и разблокировать информацию о модели.",
  "no_generation_edit_link": "Редактировать объявление"
}
```

- [ ] **Step 1: Add keys to all 5 locale files**

Read each file, add the new keys under the `"advert"` object, write back. Add before the closing brace of the `advert` section.

- [ ] **Step 2: Run test to verify locale parity guard passes**

```bash
pnpm test -- --run apps/web/src/i18n
```

Expected: all green.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/locales/en.json apps/web/src/i18n/locales/fr.json apps/web/src/i18n/locales/nl.json apps/web/src/i18n/locales/de.json apps/web/src/i18n/locales/ru.json
git commit -m "feat(62-i18n): add document_badge, key_specs, kb.disclaimer, kb.no_generation keys (5 locales)"
```

---

### Task 5: Wire everything into `ad/[id]/page.tsx`

**Files:**
- Modify: `apps/web/src/app/ad/[id]/page.tsx`

Changes:
1. Import new components + `loadCatalogGroups`
2. Add catalog schema loading in `AdvertPage()` (parallel to `loadAdvertData`)
3. Insert `<KeySpecsStrip>` after title+price block
4. Insert `<DocumentBadges>` after key-specs strip
5. Render `<CatalogDetailsSection>` when catalog groups exist; keep `<AdvertDetails>` as fallback
6. Merge generation + insights sections into a unified KB block with:
   - KB disclaimer at top of block
   - Ambiguous CTA when vehicle + generations exist + no selectedGeneration

- [ ] **Step 1: Add imports to page.tsx**

After the existing imports (around line 29), add:

```typescript
import { KeySpecsStrip } from "@/components/ad/KeySpecsStrip";
import { DocumentBadges } from "@/components/ad/DocumentBadges";
import { CatalogDetailsSection } from "@/components/ad/CatalogDetailsSection";
import { loadCatalogGroups } from "@/lib/catalog/loadCatalogGroups";
```

- [ ] **Step 2: Add catalog schema loading in `AdvertPage()`**

In the `AdvertPage` async function, after `loadAdvertData()` is called and `data` is checked non-null, add a parallel catalog schema load. Find where `data` is checked (around line 465):

After `const data = await loadAdvertData(...)` and the null-check, add:

```typescript
  // Load catalog group/field schema for F13 readonly display
  const domain = data.category ? detectCategoryType(data.category.slug ?? data.category.path ?? "") : "generic";
  const svc2 = await supabaseService().catch(() => supabaseServer());
  const { groups: catalogGroups, fields: catalogFields } = await loadCatalogGroups(domain, svc2);
```

Note: `supabaseService()` and `supabaseServer()` are already imported. The try/catch fallback avoids breaking the page if service client fails.

- [ ] **Step 3: Insert KeySpecsStrip + DocumentBadges after title+price block**

Find the title+price block ending (after `</div>` closing the space-y-2 div at line ~705). Insert after it:

```tsx
          {/* Key-specs strip (per-category chips) */}
          <KeySpecsStrip
            categoryType={domain}
            specifics={data.specifics ?? {}}
            locale={locale}
            makeName={getMakeName(data.make)}
            modelName={getModelName(data.model)}
            location={data.advert.location ?? null}
            t={translate}
          />

          {/* Document badges (Car-Pass / EPC / Safety / Microchip) */}
          <DocumentBadges
            categoryType={domain}
            specifics={data.specifics ?? {}}
            t={translate}
          />
```

- [ ] **Step 4: Add CatalogDetailsSection before existing AdvertDetails**

Find the `{showDetails ? (<AdvertDetails .../>` block (around line 772). Replace it with:

```tsx
      {catalogGroups.length > 0 ? (
        <CatalogDetailsSection
          groups={catalogGroups}
          fields={catalogFields}
          values={data.specifics ?? {}}
          locale={locale}
        />
      ) : showDetails ? (
        <AdvertDetails
          title={translate("advert.vehicle_specs", "Vehicle specifications")}
          details={detailItems}
          optionsTitle={translate("advert.options", "Options")}
          options={optionLabels}
        />
      ) : null}
```

- [ ] **Step 5: Rebuild KB block with disclaimer + ambiguous CTA**

Find the generation section (starts around line 781: `{showGeneration && data.selectedGeneration ?`). Replace BOTH the generation section AND the insights section with a unified KB block:

```tsx
      {/* KB block: generation + insights with disclaimer, or ambiguous CTA */}
      {(showGeneration && data.selectedGeneration) || showInsights ? (
        <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">
            {translate("advert.insights.title", "Model information")}
          </h2>

          {/* Generation details */}
          {showGeneration && data.selectedGeneration ? (
            <div className="mb-4 space-y-4">
              {data.selectedGeneration.code ? (
                <div>
                  <span className="text-sm font-semibold">
                    {translate("advert.generation.code", "Code")}:{" "}
                    {data.selectedGeneration.code}
                  </span>
                  {data.selectedGeneration.facelift ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({translate("advert.generation.facelift", "Facelift")})
                    </span>
                  ) : null}
                </div>
              ) : null}

              {data.selectedGeneration.start_year || data.selectedGeneration.end_year ? (
                <div className="text-sm text-muted-foreground">
                  {translate("advert.generation.years", "Production years")}:{" "}
                  {data.selectedGeneration.start_year}
                  {data.selectedGeneration.end_year
                    ? ` - ${data.selectedGeneration.end_year}`
                    : ` - ${translate("advert.generation.present", "present")}`}
                </div>
              ) : null}

              {generationLocale?.summary ? (
                <p className="text-sm text-foreground/90">{generationLocale.summary}</p>
              ) : null}

              {generationLocale?.pros.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                    {translate("advert.insights.pros", "Pros")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {generationLocale.pros.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {generationLocale?.cons.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    {translate("advert.insights.cons", "Cons")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {generationLocale.cons.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {generationLocale?.inspectionTips.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.inspection_tips", "Inspection tips")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {generationLocale.inspectionTips.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.selectedGeneration.production_countries?.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.generation.production_countries", "Production countries")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.selectedGeneration.production_countries.map((country, index) => (
                      <span
                        key={`${country}-${index}`}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Insights (model-level: pros/cons/common_issues/etc.) */}
          {showInsights && data.insights ? (
            <div className="space-y-6">
              {translatedInsights?.pros.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                    {translate("advert.insights.pros", "Pros")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.pros.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.cons.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    {translate("advert.insights.cons", "Cons")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.cons.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.inspectionTips.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.inspection_tips", "Inspection tips")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {translatedInsights.inspectionTips.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.notableFeatures.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.notable_features", "Notable features")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {translatedInsights.notableFeatures.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {translatedInsights?.engineExamples.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.engine_examples", "Engine examples")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.engineExamples.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.commonIssues.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.common_issues", "Common issues")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-orange-600 dark:text-orange-400">
                    {translatedInsights.commonIssues.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showScores ? (
                <div className="flex gap-4 border-t pt-2">
                  {reliabilityScoreDisplay !== null ? (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {translate("advert.insights.reliability", "Reliability")}:{" "}
                      </span>
                      <span className="text-sm font-medium">{reliabilityScoreDisplay}</span>
                    </div>
                  ) : null}
                  {popularityScoreDisplay !== null ? (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {translate("advert.insights.popularity", "Popularity")}:{" "}
                      </span>
                      <span className="text-sm font-medium">{popularityScoreDisplay}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* KB disclaimer — always visible when KB content is shown */}
          <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
            {translate("advert.kb.disclaimer", "Reference info. LyVoX knowledge base — general model information, not a guarantee for this specific item.")}
          </p>
        </section>
      ) : domain === "vehicle" && data.generations && data.generations.length > 0 ? (
        /* Ambiguous generation CTA — bug #1996 fix: no silent guess */
        <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">
            {translate("advert.kb.no_generation_title", "About this model")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate(
              "advert.kb.no_generation_body",
              "The production generation was not specified. Edit the listing to add it and unlock model insights.",
            )}
          </p>
          {editHref ? (
            <a
              href={editHref}
              className="mt-3 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {translate("advert.kb.no_generation_edit_link", "Edit listing")} →
            </a>
          ) : null}
          {/* TODO §13: KB for non-transport categories (electronics/pets/fashion) */}
        </section>
      ) : null}
```

- [ ] **Step 6: Full green check**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/ad/\[id\]/page.tsx
git commit -m "feat(62-kb-block): wire KeySpecsStrip/DocumentBadges/CatalogDetailsSection + KB disclaimer + ambiguous CTA (#1996)"
```

---

### Historical documentation note

The original plan ended by updating a now-retired tracker. That instruction has been removed. Any remaining requirement or implementation evidence must be reconciled through `docs/MASTER_PRODUCTION_TZ.md`; subordinate PRD headers do not carry current status.

---

## Self-Review

**Spec coverage:**
- §3.1 key-specs strip ✓ (Task 2), document badges ✓ (Task 3)
- §3.2/3.3 tab/section layout via CatalogGroupTabs ✓ (Task 1 + Task 5)
- §5/§6 KB block with disambiguation fix ✓ — disclaimer ✓, ambiguous CTA ✓, bug #1996 ✓
- §4 non-transport KB tables — **NOT built this round** (§13 follow-up, TODO comment added)
- §9 i18n 5-locale parity ✓ (Task 4)
- §13 DoD: resolveGeneration range-aware ✓ (F7 already done); contig razkiadas via catalog_groups ✓; key-specs + trust header ✓; KB transport ✓; doc badges ✓

**Placeholder scan:** None — all code blocks are complete.

**Type consistency:**
- `loadCatalogGroups` returns `CatalogSchemaGroup[]` matching `CatalogGroupTabs` props ✓
- `CatalogDetailsSection` passes `onChange={() => {}}` — no-op, TypeScript `(fieldKey: string, value: unknown) => void` ✓
- `KeySpecsStrip` and `DocumentBadges` receive `TFunction` which matches page.tsx's `translate` type ✓
- `domain` variable used in both schema loading and component props ✓
- `data.generations` type is `VehicleGeneration[]` (already in AdvertData) ✓
