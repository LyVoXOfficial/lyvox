# Category Vertical Audit

T03 deliverable: document only. No code or database schema was changed.

## Evidence Base

- Category detector: `apps/web/src/lib/utils/categoryDetector.ts:21` maps `path`/`slug` to `CategoryType`; `requiresSpecializedComponent()` hardcodes `vehicle`, `real_estate`, `electronics`, `fashion`, and `jobs` at `apps/web/src/lib/utils/categoryDetector.ts:163`.
- Search UI: `SCHEMA_EXCLUDED_TYPES` excludes those same five heavy domains from dynamic schema filters at `apps/web/src/components/SearchFilters.tsx:62`, resets dynamic filters on category change at `apps/web/src/components/SearchFilters.tsx:470`, serializes dynamic filters as `catalog_field_*` URL params at `apps/web/src/components/SearchFilters.tsx:584`, and renders the schema renderer only for non-excluded domains at `apps/web/src/components/SearchFilters.tsx:1148`.
- Search API: `/api/search` validates only generic params (`q`, `category_id`, price, location, condition, verified, radius, sort, pagination) in `apps/web/src/lib/validations/search.ts:7`; `catalog_field_*` params are forwarded by the client at `apps/web/src/app/search/page.tsx:141` but are not passed to the RPC parameter object at `apps/web/src/app/api/search/route.ts:113`.
- Post form: `PostForm` has the same exclusion set at `apps/web/src/app/post/PostForm.tsx:133`, loads schema only for non-excluded domains at `apps/web/src/app/post/PostForm.tsx:305`, renders bespoke heavy-domain components at `apps/web/src/app/post/PostForm.tsx:1903`, and serializes only vehicle fields plus dynamic `catalog_fields` into `specifics` at `apps/web/src/app/post/PostForm.tsx:735`.
- Schema API: `/api/catalog/schema` climbs from leaf to parent category until it finds an active `catalog_subcategory_schema` at `apps/web/src/app/api/catalog/schema/route.ts:81`, collects field keys from `steps` at `apps/web/src/app/api/catalog/schema/route.ts:15`, then loads `catalog_fields` and `catalog_field_options` at `apps/web/src/app/api/catalog/schema/route.ts:162`.
- Renderer: `FormRenderer` renders schema steps/groups at `apps/web/src/catalog/renderer/FormRenderer.tsx:8`; `CatalogGroupTabs` supports `tab` and `section` layouts at `apps/web/src/catalog/renderer/CatalogGroupTabs.tsx:86`; `FieldWidget` supports `text`, `textarea`, `number`, `select`, `boolean`, and `date` at `apps/web/src/catalog/renderer/FieldWidgets.tsx:203`.
- Detail page: listing domain is derived from detector or vehicle make at `apps/web/src/app/ad/[id]/page.tsx:530`, detail groups are loaded by `loadCatalogGroups(listingDomain)` at `apps/web/src/app/ad/[id]/page.tsx:537`, key-spec chips are rendered at `apps/web/src/app/ad/[id]/page.tsx:734`, and schema groups fall back to legacy details at `apps/web/src/app/ad/[id]/page.tsx:819`.
- Key specs and badges: `KeySpecsStrip` switches on domain at `apps/web/src/components/ad/KeySpecsStrip.tsx:166`; `DocumentBadges` switches on vehicle, real estate, baby/kids, and pets at `apps/web/src/components/ad/DocumentBadges.tsx:21`.
- Database types: `categories` has `slug`, `path`, `level`, `is_active`, and localized names but no domain column at `supabase/types/database.types.ts:625`; `catalog_fields` has `domain`, `field_key`, `field_type`, required/unit/range metadata at `supabase/types/database.types.ts:487`; `catalog_groups` has `domain`, `display`, `tab_key`, and `tab_order` at `supabase/types/database.types.ts:544`; `catalog_subcategory_schema` has `category_id`, `version`, `is_active`, and `steps`, but no surface field at `supabase/types/database.types.ts:580`.

## Live Database Snapshot

Query used: `select path, level, is_active from categories order by path`. It returned 172 rows.

Active roots are exactly these 9 branches:

| root | active nodes | active leaves | inactive legacy nodes |
|---|---:|---:|---:|
| `dlya-doma-hobbi-i-detey` | 30 | 25 | 1 |
| `elektronika-i-tehnika` | 29 | 23 | 2 |
| `lichnye-veshchi` | 25 | 21 | 0 |
| `nedvizhimost` | 12 | 9 | 0 |
| `osobye-kategorii` | 7 | 4 | 1 |
| `rabota-i-karera` | 9 | 6 | 0 |
| `transport` | 15 | 11 | 0 |
| `uslugi-i-biznes` | 15 | 12 | 3 |
| `zhivotnye` | 11 | 8 | 0 |

Inactive legacy roots also exist: `dom-i-sad`, `elektronika`, and `lichnye-veschi`. They should stay addressable for historical data and redirects, but they should not drive the future vertical contract.

Catalog schema coverage is much thinner than the category tree:

- `catalog_subcategory_schema` has one active row: `dlya-doma-hobbi-i-detey/detskie-tovary`.
- `catalog_fields` has 9 rows, all with `domain = 'dlya-doma-hobbi-i-detey'`: `baby_product_category`, `baby_age_group`, `baby_condition_grade`, `baby_brand`, `baby_color`, `baby_material`, `baby_quantity`, `baby_safety_certified`, `baby_expiration_date`.
- `catalog_groups` has layout rows for `vehicle`, `real_estate`, `electronics`, `fashion`, and `home`, but the live `catalog_fields` table has no matching field rows for those domains. As a result, `loadCatalogGroups()` returns no detail group payload for those domains today.

## Main Findings

1. `categoryDetector.ts` is useful as a fallback, but it is a heuristic over transliterated slugs. Mixed hubs such as `dlya-doma-hobbi-i-detey` and `lichnye-veshchi` prove that stable category metadata should live on `categories`, not in string matching.
2. The most important buyer filters do not exist in search. Heavy domains are excluded from schema filters, and dynamic `catalog_field_*` params are not validated or applied by `/api/search`.
3. Bespoke post fields for real estate, electronics, fashion, and jobs are rendered but not serialized into `specifics` by `prepareSpecifics()`. Vehicle fields and dynamic schema fields are serialized; the other bespoke domains are mostly presentation-only until this is fixed.
4. Detail rendering already has the right shape (`loadCatalogGroups` + `CatalogGroupTabs`), but the data is not populated for the current domains.
5. Field-key drift already exists. Examples: `RealEstateFields` writes `property_type_id`, while `KeySpecsStrip` reads `property_type`; `JobsFields` writes `job_category_id` and `contract_type_id`, while chips read `job_category` and `contract_type`; `DocumentBadges` reads `safety_certified`, while live baby schema stores `catalog_field_baby_safety_certified`.

## Audit Table

| Category paths | Detected domain | Expected domain | Form fields today | Search filters today | `/ad` layout today | Gaps and inappropriate filters |
|---|---|---|---|---|---|---|
| `transport`<br>`transport/legkovye-avtomobili/avtomobili-s-probegom`<br>`transport/zapchasti-i-aksessuary/shiny-diski-i-kolyosa`<br>`transport/motocikly-i-spectehnika/vodnyy-transport-lodki-katera-yahty` | `vehicle` | `vehicle`, with subtypes for cars, parts, motorcycles, boats | Rich bespoke vehicle flow: make/model/year/generation, steering/body/doors/color, engine/power/transmission/drive, mileage/condition/customs/warranty/VIN/options (`apps/web/src/app/post/PostForm.tsx:1638`, `apps/web/src/app/post/PostForm.tsx:1888`, `apps/web/src/app/post/PostForm.tsx:2148`, `apps/web/src/app/post/PostForm.tsx:2322`). | Heavy domain excluded from schema filters; only generic price/location/verified/condition/sort. No make/model/year/mileage/fuel/transmission/body filters. | Vehicle chips: year, mileage, fuel, transmission, body, city (`apps/web/src/components/ad/KeySpecsStrip.tsx:52`); Car-Pass badge if matching specifics exist (`apps/web/src/components/ad/DocumentBadges.tsx:24`). Catalog group rows exist for vehicle, but no matching field rows. | Car-specific fields are inappropriate for parts and boats without subtype constraints. Missing compatibility fields for parts; missing Car-Pass/inspection/damage state filters from the target contract. |
| `nedvizhimost`<br>`nedvizhimost/prodazha-nedvizhimosti/kvartiry`<br>`nedvizhimost/arenda-nedvizhimosti/arenda-kvartir`<br>`nedvizhimost/prodazha-nedvizhimosti/uchastki` | `real_estate` | `real_estate` | `RealEstateFields` captures property type/listing type, area, rooms, bedrooms, bathrooms, land area, EPC, rent charges/deposit/availability, postcode/municipality, parking/terrace/garden/elevator/cellar/pet friendly (`apps/web/src/components/catalog/RealEstateFields.tsx:69`). Not serialized by `prepareSpecifics()`. | Heavy domain excluded; only generic filters. No sale/rent, property type, area, rooms, EPC, outdoor/parking/elevator filters. | Real-estate chips expect listing type, property type, area, rooms, city (`apps/web/src/components/ad/KeySpecsStrip.tsx:74`); EPC badge reads `epc_rating`/`peb_rating`/`epc` (`apps/web/src/components/ad/DocumentBadges.tsx:33`). | Current field names drift (`property_type_id` vs `property_type`, `area_sqm` vs chip fallback `area_m2`/`area`). Land/garage/commercial categories need different required fields from apartments. |
| `elektronika-i-tehnika`<br>`elektronika-i-tehnika/telefony-i-planshety/mobilnye-telefony`<br>`elektronika-i-tehnika/kompyutery-i-orgtehnika/noutbuki`<br>`elektronika-i-tehnika/bytovaya-tehnika/tehnika-dlya-kuhni` | `electronics` | `electronics` | `ElectronicsFields` captures device type, brand/model/year, mobile storage/RAM/battery/color/unlocked, computer CPU/RAM/storage/GPU/OS, display specs, warranty/accessories (`apps/web/src/components/catalog/ElectronicsFields.tsx:107`). Not serialized by `prepareSpecifics()`. | Heavy domain excluded; only generic filters. No brand/model/storage/RAM/battery/warranty/device type filters. | Chips expect brand, storage, condition, battery (`apps/web/src/components/ad/KeySpecsStrip.tsx:92`). Detail group rows exist for electronics, but no field rows. | Device subtypes need different schemas: smartphone IMEI/battery, laptop CPU/RAM/storage, appliance energy/installation. Generic condition values do not match richer electronics validation (`like_new`, `good`, `fair`). |
| `lichnye-veshchi`<br>`lichnye-veshchi/zhenskiy-garderob/futbolki-i-topy`<br>`lichnye-veshchi/muzhskoy-garderob/rubashki`<br>`lichnye-veshchi/detskiy-garderob/verhnyaya-odezhda` | Root `fashion`; child `detskiy-garderob` -> `baby_kids` | Mixed hub: `fashion` for adult wardrobe, `baby_kids` for child wardrobe | `FashionFields` captures item type, gender, age group, brand, size systems, measurements, material/color/season/pattern, care, tags, never worn, authenticity, defects (`apps/web/src/components/catalog/FashionFields.tsx:90`). Not serialized by `prepareSpecifics()`. Child wardrobe has no DB schema. | Fashion heavy domain excluded; child `baby_kids` can try schema, but only `dlya-doma-hobbi-i-detey/detskie-tovary` has schema, so this branch gets schema missing. | Fashion chips expect brand, size, gender, condition (`apps/web/src/components/ad/KeySpecsStrip.tsx:109`). No baby clothing key specs; baby badge only reads `safety_certified`, not live `baby_safety_certified`. | Root-level detector hides that this branch is mixed. Missing size/gender/brand filters for fashion and age/size split for child clothing. No engine/EPC/job filters should ever appear here. |
| `dlya-doma-hobbi-i-detey`<br>`dlya-doma-hobbi-i-detey/detskie-tovary/avtokresla`<br>`dlya-doma-hobbi-i-detey/dlya-doma-i-dachi/mebel`<br>`dlya-doma-hobbi-i-detey/hobbi-i-otdyh/sportivnye-tovary` | Root `home`; `detskie-tovary` -> `baby_kids`; `hobbi-i-otdyh` -> `sports` | Mixed hub: `home`, `baby_kids`, `sports`, and some generic hobby/media leaves | Only `detskie-tovary` has live schema fields: baby product category, age group, condition grade, brand/color/material/quantity, safety certified, expiration date. Home/sports leaves have no live schema. | Non-heavy domains attempt dynamic schema. Only `detskie-tovary` can render dynamic filters; `/api/search` still does not apply `catalog_field_*`. Home/sports show schema missing. | No home/sports/baby key specs. Baby safety badge reads the wrong key. Home detail group rows exist, but no home fields. | Detector marks all `hobbi-i-otdyh/*` as `sports`, which is wrong for books, tickets, collecting, and musical instruments. Mixed root needs explicit per-node domain. |
| `rabota-i-karera`<br>`rabota-i-karera/vakansii/polnaya-zanyatost`<br>`rabota-i-karera/vakansii/chastichnaya-zanyatost`<br>`rabota-i-karera/rezyume/specialisty` | `jobs` | `jobs`, with subtype `vacancy` vs `resume` | `JobsFields` captures job category, employment type, title, contract type, CP code, salary, benefits, experience/education/languages/skills, remote/schedule/start/deadline, company and HR contact (`apps/web/src/components/catalog/JobsFields.tsx:111`). Jobs skip price step (`apps/web/src/app/post/PostForm.tsx:2148`). Not serialized by `prepareSpecifics()`. | Heavy domain excluded; only generic filters. No contract, salary, remote, sector, CP code filters. | Chips expect `job_category`, `contract_type`, location (`apps/web/src/components/ad/KeySpecsStrip.tsx:125`), but form writes `*_id` fields. Job JSON-LD code expects persisted `employment_type`, salary, company. | Resume leaves should not require employer/company fields. Vacancy and resume need different post/search/detail contracts. |
| `uslugi-i-biznes`<br>`uslugi-i-biznes/uslugi/remont-i-stroitelstvo`<br>`uslugi-i-biznes/uslugi/uborka`<br>`uslugi-i-biznes/zayavki-na-uslugi/ishchu-mastera` | `services` | `services`, with subtype `offer` vs `request` | No bespoke component and no live schema. Existing validation vocabulary includes service category/type, price type, availability, VAT for professional services (`apps/web/src/lib/validations/catalog/services.ts:40`). | Non-heavy domain tries dynamic schema, but no schema exists. Search has only generic filters. | Default detail: location only if no domain chips. No service badges/layout. | Service offers and requests need different required fields. Do not reuse product condition or delivery filters as primary filters here. |
| `zhivotnye`<br>`zhivotnye/domashnie-pitomcy/sobaki`<br>`zhivotnye/domashnie-pitomcy/koshki`<br>`zhivotnye/tovary-dlya-zhivotnyh/korm-i-lakomstva` | `pets` | `pets`, with subtype `animal` vs `pet_supplies` | No bespoke component and no live schema. Validation vocabulary exists for pet category, listing type, breed, age, gender, vaccinated, microchip (`apps/web/src/lib/validations/catalog/pets.ts:21`). | Non-heavy domain tries dynamic schema, but no schema exists. Search has only generic filters. | Pet chips expect breed, age, vaccinated (`apps/web/src/components/ad/KeySpecsStrip.tsx:139`); microchip badge exists (`apps/web/src/components/ad/DocumentBadges.tsx:52`). | Pet supplies should not show animal adoption/lost/found fields. Animal listings need breed/age/vaccination/microchip filters. |
| `osobye-kategorii`<br>`osobye-kategorii/otdam-darom/besplatno`<br>`osobye-kategorii/otdam-darom/na-obmen`<br>`osobye-kategorii/poisk-i-obmen/ishchu-veshch` | `generic` | `generic` / special-purpose marketplace flows | No bespoke component and no live schema. Generic post flow with common title/description/location/price/condition. | Generic filters only. Dynamic schema attempts can return missing. | Default detail layout; no key specs beyond location. | `besplatno`, exchange, and wanted flows should have explicit price/condition semantics so they do not inherit irrelevant product filters. |

## Proposed `CategoryVertical` Contract

Recommendation: add `categories.domain` as nullable text with a CHECK constraint over the domain enum below, backfill it from the current detector, then treat the detector as fallback only. Do not rename category slugs; 159+ indexed URLs depend on current paths.

Use `domain`, not `vertical_key`, for the first migration because the product already uses the word domain across detector, fields, groups, SEO, and detail. Add subtype metadata later through schema metadata or a `category_vertical_overrides` table when needed.

```ts
type CategoryDomain =
  | "vehicle"
  | "real_estate"
  | "electronics"
  | "fashion"
  | "home"
  | "baby_kids"
  | "pets"
  | "sports"
  | "services"
  | "jobs"
  | "generic";

type CategorySurface = "post" | "search" | "detail";

type CategoryVertical = {
  categoryId: string;
  path: string;
  rootPath: string;
  level: number;
  isActive: boolean;
  isLeaf: boolean;
  domain: CategoryDomain;
  domainSource: "categories.domain" | "detector_fallback";
  inheritedFromCategoryId: string | null;
  subtreeDomains: CategoryDomain[];
  post: {
    schemaId: string | null;
    version: number | null;
    fieldKeys: string[];
    customComponent: "vehicle" | null;
  };
  search: {
    schemaId: string | null;
    version: number | null;
    urlParams: Array<{
      name: string;
      type: "string" | "number" | "boolean" | "enum" | "range";
      fieldKey: string | null;
      multi: boolean;
      indexed: boolean;
      seoFacet: "never" | "category_only" | "whitelisted";
    }>;
    rejectUnknownCatalogFields: boolean;
  };
  detail: {
    layout: "tabs" | "sections" | "minimal";
    groupKeys: string[];
    keySpecFields: string[];
    documentBadges: string[];
  };
  priceComparableKeys: string[];
  seoIndexPolicy: "index_category_only" | "index_whitelisted_facets" | "noindex";
};
```

Database adaptation:

- `categories.domain`: nullable during migration, then required for active leaf categories. Mixed hubs may stay `generic` with `subtreeDomains` computed from children; leaves must be explicit because publishing attaches to leaves while hubs aggregate subtrees.
- `catalog_subcategory_schema.surface`: reuse this table rather than creating a parallel `catalog_filter_schema` first. Add `surface text check (surface in ('post','search','detail')) default 'post'`, and unique active semantics on `(category_id, surface, version)`. This preserves the existing parent-inheritance behavior in `/api/catalog/schema`.
- `catalog_fields.domain`: normalize values to `CategoryDomain` values. Current live value `dlya-doma-hobbi-i-detey` is a root path, not a domain, so future queries should not depend on it.
- `catalog_groups.domain`: keep as domain-level layout defaults, but let category-level detail schemas override groups for leaf-specific cases.
- Compatibility rule: a `catalog_field_*` is valid only when the selected category's `CategoryVertical.search.fieldKeys` contains that key. Otherwise API returns 400.

## Replacing `SCHEMA_EXCLUDED_TYPES`

Keep these filters as custom code because they are cross-cutting and not catalog-specific: `q`, `category_id`, `price_min`, `price_max`, location/radius, seller verification, sort, pagination. `condition` can remain common only if the domain contract controls allowed values and whether it renders.

Move these into per-domain `search` schemas:

- Vehicle: `make_id`, `model_id`, `generation_id`, `year_min`, `year_max`, `mileage_max`, `fuel_type`, `transmission`, `body_type`, `engine_volume_min/max`, `power_min`, `part_type`, compatibility fields, Car-Pass/document flags.
- Real estate: `listing_type`, `property_type`, `area_min/max`, `rooms_min`, `bedrooms_min`, `epc_rating`, parking/outdoor/elevator, postcode/municipality.
- Electronics: `device_type`, `brand_id`, `model_id`, `storage_gb`, `memory_ram_gb`, `battery_health_min`, warranty/accessories, condition.
- Fashion and baby clothing: item/clothing type, size system and size, gender/age, brand, condition, color, material, season.
- Jobs: vacancy/resume subtype, job category, contract type, CP code, salary range, remote option, schedule, experience, location.
- Home/sports/services/pets/generic: add schemas before exposing dynamic filters. Until then, render no category-specific filters rather than showing "schema missing" to users.

Migration sequence for search:

1. Add `surface='search'` schemas and stable URL param metadata.
2. Add `/api/catalog/schema?surface=search` and keep current default `surface=post`.
3. Change SearchFilters to use the category contract instead of `SCHEMA_EXCLUDED_TYPES`.
4. Add search API validation that loads the selected category contract, accepts only allowed `catalog_field_*`, rejects incompatible params, and translates allowed fields into SQL/RPC filters.
5. Extend `search_adverts` only after the API contract is explicit. Keep the 13-argument RPC signature stable until a coordinated migration replaces it.

## Test Plan

- Detector and metadata: every active leaf has non-null `categories.domain`; detector fallback matches the backfilled value for current paths; mixed hubs report multiple subtree domains.
- Post form: a baby jacket category never renders vehicle engine volume, fuel, transmission, VIN, EPC, CP code, or job salary fields.
- Post form: an auto leaf renders make/model/generation/year, mileage, fuel/engine type, transmission, body, VIN, and vehicle condition.
- Post form: real estate renders listing type, property type, area, rooms, EPC, postcode/municipality, and rental-only fields only when `listing_type=rent`.
- Search UI: changing category clears incompatible `catalog_field_*` URL params.
- Search API: with category set to baby/fashion, `catalog_field_engine_volume` returns 400; with vehicle category, vehicle fields are accepted and typed.
- Search API: `catalog_field_*` is ignored nowhere. It is either applied or rejected.
- Detail page: vehicle, real estate, jobs, electronics, fashion, pets, and baby details read the same field keys that post/search write.
- SEO: `/search` remains `noindex`; `/c/*` category pages can only index whitelisted facet combinations from the category contract.

## Phasing

Wave A: domain column and contract foundation.

- Add `categories.domain` with CHECK and idempotent backfill.
- Add detector parity tests and mixed-hub tests.
- Add a contract loader that resolves leaf domain from `categories.domain`, falls back to detector only when null, and computes subtree domains for hubs.
- Normalize field-key names for the existing bespoke components in a design doc before touching serialization.

Wave B: search filters.

- Add `surface='search'` schema support and URL param metadata.
- Replace `SCHEMA_EXCLUDED_TYPES` in SearchFilters with contract-driven schemas.
- Validate and apply `catalog_field_*` in `/api/search`; reject unknown or incompatible params.
- Add first complete vertical search schemas for vehicle, real estate, electronics, fashion/baby clothing, and jobs.

Wave C: post/detail unification.

- Move non-vehicle bespoke forms onto schema-backed fields or serialize their current fields into the same canonical field keys.
- Populate `catalog_fields` and `catalog_groups` for detail surfaces so `CatalogDetailsSection` becomes primary instead of fallback.
- Align `KeySpecsStrip`, `DocumentBadges`, JSON-LD, and price-comparable keys with the same contract.
- Add per-leaf subtype handling for vehicle parts/boats, job vacancy/resume, services offer/request, and pet animal/supplies.
