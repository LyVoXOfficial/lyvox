# AI Features 2026 - CTO Evaluation Brief For Fable5

Дата: 2026-07-03  
Авторская роль: Codex, верховный системный архитектор / CTO LyVoX  
Адресат: Claude / Fable 5  
Статус: **оценочное ТЗ, не команда на немедленную реализацию**

## 0. Жесткая инструкция для Fable5

Не начинать реализацию сразу.

Сначала подготовить по каждой фиче короткий assessment pack:

1. Архитектурный вариант A/B/C.
2. Оценка пользы для cold start / liquidity / contact conversion.
3. Mobile performance budget.
4. GDPR/DSA/privacy review.
5. Схема данных и RLS implications.
6. Feature flag / kill switch.
7. Acceptance criteria.
8. Что не делать в MVP.

Только после этого founder/CTO выбирает, что идет в implementation wave.

## 1. Agentic Commerce Readiness - AIO/AEO

### Продуктовая ценность

Цель: сделать LyVoX понятным для внешних AI agents и answer engines: ChatGPT, Perplexity, Gemini, Google AI surfaces, обычных crawlers.

Для холодного старта это важно не потому, что "AI купит товар", а потому что:

- молодой домен может выиграть цитирование за счет чистой структуры, если монополисты отдают грязные/неполные карточки;
- agent answer может привести buyer intent сразу на релевантное объявление или category hub;
- прозрачные seller signals и contact-only limits снижают риск неверной AI-цитаты "платформа защищает оплату".

### Архитектурное решение

Опора на существующий код:

- `apps/web/src/lib/seo/catalog/listingJsonLd.ts`
- `apps/web/src/lib/seo/generateJsonLd.ts`
- `apps/web/src/app/ad/[id]/page.tsx`
- `apps/web/src/lib/seo/generateMetadata.ts`
- `docs/strategy/SITE_BLUEPRINT.md`

Решение:

1. Довести JSON-LD на `/ad/[id]` до стабильного Product/Offer/Car/RealEstateListing/JobPosting слоя.
2. Все поля JSON-LD должны совпадать с видимым UI. Нельзя добавлять safety/payment claims только для AI/crawlers.
3. Для contact-only режима:
   - `Offer.seller` допустим;
   - `price`, `priceCurrency`, `availability`, `url`, `itemCondition`, `datePosted` допустимы;
   - `shippingDetails`, `hasMerchantReturnPolicy`, escrow/payment/buyer protection не добавлять, пока реально не существует платформенной политики.
4. Добавить `ItemList` JSON-LD для category hubs, но только above quality/inventory threshold.
5. Добавить human-readable transparency pages:
   - `/transparency/ranking`
   - `/safety`
   - `/pro/paid-placement`
6. Оценить `llms.txt` / AI-readable catalog summary, но не считать стандартом и не полагаться на него как основной канал. Базой остаются HTML, sitemap, JSON-LD, canonical/hreflang.

### Задачи для Fable5

Evaluation tasks:

- Проверить, какие поля реально есть в `ListingJsonLdInput`, и составить gap list против Google Product/Merchant structured data.
- Предложить расширение `listingJsonLd.ts` без нарушения "visible content parity".
- Добавить тест-план для `apps/web/src/lib/seo/catalog/__tests__/listingJsonLd.test.ts`.
- Спроектировать `ranking disclosure` copy для 5 локалей, но не писать UI strings в коде до approval.
- Проверить sitemap/indexation policy: `/search` и arbitrary filters должны оставаться `noindex, follow`; indexable только active ads и threshold category/location hubs.

Possible schema additions:

```sql
alter table public.adverts
  add column if not exists agent_summary text,
  add column if not exists agent_summary_locale text,
  add column if not exists structured_data_version integer default 1;
```

Но: `agent_summary` только если он видим пользователю или является кратким пересказом видимого контента.

### Риски и красные линии

Красные линии:

- Нельзя делать AI-only контент, который отличается от UI.
- Нельзя обещать escrow, safe payment, buyer protection.
- Нельзя выдавать paid listing за organic recommendation.
- Нельзя выводить seller PII в JSON-LD сверх публично разрешенных trader/KYBC fields.

Риск: answer engines могут неверно интерпретировать "verified". Поэтому verification labels должны быть literal:

- Phone checked.
- Business register checked.
- Identity not a transaction guarantee.

### Sources

- Google Product structured data: https://developers.google.com/search/docs/appearance/structured-data/product
- Google merchant listing structured data: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- DSA overview: https://digital-strategy.ec.europa.eu/en/policies/digital-services-act

### CTO recommendation

**Do now.** Это низкорисковая, SEO/AEO-compatible работа, если держать parity with visible UI.

## 2. Client-Side Multimodal AI - Local WebGPU In `/post`

### Продуктовая ценность

Главная проблема cold start - supply. Продавец должен быстро создать качественное объявление. Локальный AI может:

- подсказать категорию по фото;
- предложить теги;
- улучшить title/description;
- снизить пустые/плохие listings;
- не создавать серверный AI-cost на каждый draft.

Но это не must-have для MVP. Это risky productivity layer, а не foundation.

### Архитектурное решение

Опора на код:

- `apps/web/src/app/post/PostForm.tsx`
- `apps/web/src/components/upload-gallery.tsx`
- `apps/web/src/lib/utils/categoryDetector.ts`
- `docs/catalog/AI_ENRICHMENT.md`
- `docs/catalog/POSTFORM_INTEGRATION.md`

Решение только behind capability flag:

```ts
CAPABILITY_LOCAL_AI_POST_ASSIST=true
```

Execution model:

1. Не грузить AI bundle на initial `/post`.
2. Dynamic import только после photo upload и явного opt-in: "Suggest details from this photo".
3. Run in Web Worker.
4. Prefer small model / classifier first:
   - Phase A: image classification / zero-shot labels.
   - Phase B: category suggestion + tags.
   - Phase C: title/description suggestions in source locale.
   - Phase D: multilingual translation only through approved translation pipeline, not browser VLM.
5. Cache model in browser, but provide "clear local AI cache".
6. If `navigator.gpu` missing or device memory low: no error, fallback to manual form.

Possible libraries:

- `@huggingface/transformers`
- ONNX/WebGPU-compatible model from Hugging Face community
- Start with Florence-2 WebGPU spike; Moondream2/Moondream3 only if browser/ONNX path is stable enough.

### Задачи для Fable5

Do not implement production UI first. Build spike report:

1. Create branch-only prototype outside critical `/post` route or behind hidden flag.
2. Measure on:
   - Android Chrome mid-range;
   - desktop Chrome;
   - Safari/iOS fallback behavior;
   - low-memory browser.
3. Record:
   - model download MB;
   - first inference time;
   - warm inference time;
   - memory/GPU errors;
   - INP impact;
   - user cancellation path.
4. Compare:
   - Florence-2 base;
   - Moondream web-ready model if available;
   - CLIP/SigLIP style classifier + rule-based copy generation;
   - no-AI category detector baseline.
5. Add proposed data shape:

```sql
create table if not exists public.advert_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('client_webgpu', 'server_ai', 'manual')),
  model_id text,
  model_version text,
  locale text not null,
  suggestions jsonb not null,
  accepted_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.advert_ai_suggestions enable row level security;
```

### Риски и красные линии

Risks:

- WebGPU limited availability.
- Huge first download can destroy `/post` conversion.
- Mobile GPU memory failures.
- User may treat generated copy as platform-verified truth.
- Generated description in 5 languages can create legal mismatch.

Red lines:

- No AI bundle in initial page chunk.
- No blocking `/post`.
- No auto-publish AI-generated fields.
- No generated condition/defect claims unless user confirms.
- No sending photos to third-party inference provider without explicit consent.
- No "generated SEO description in 5 languages" as MVP. First generate suggestions in source locale, then use translation pipeline.

### Sources

- Transformers.js docs: https://huggingface.co/docs/transformers.js/en/index
- Transformers.js WebGPU guide: https://huggingface.co/docs/transformers.js/en/guides/webgpu
- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Florence-2 WebGPU demo context: https://huggingface.co/spaces/Xenova/florence2-webgpu

### CTO recommendation

**Spike only.** Не в production до proof на реальных мобильных устройствах.

## 3. Multi-Modal Native Search - pgvector Hybrid Search

### Продуктовая ценность

Фича полезна, но "отказ от классических фильтров" - неверный тезис. Для LyVoX нужен hybrid search:

- keyword/FTS для точности;
- structured filters для price/location/category/trust;
- vector search для semantic/photo intent.

Сценарий "найди этот велосипед, но синий, до 150 EUR, 20 км от Geel" должен стать:

1. image embedding similarity;
2. text semantic modifier;
3. structured constraints: color, price, distance;
4. trust/risk ranking.

### Архитектурное решение

Опора на код:

- `apps/web/src/app/api/search/route.ts`
- `supabase/migrations/20250128120000_search_function.sql`
- `apps/web/src/lib/validations/search.ts`
- `apps/web/src/components/SearchBar.tsx`
- `apps/web/src/components/ads-grid.tsx`

Database:

```sql
create extension if not exists vector;

create table if not exists public.advert_embeddings (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  modality text not null check (modality in ('text', 'image', 'joint')),
  locale text,
  model_id text not null,
  embedding vector(768) not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (advert_id, modality, locale, model_id, source_hash)
);

alter table public.advert_embeddings enable row level security;
```

Index:

```sql
create index if not exists advert_embeddings_hnsw_idx
on public.advert_embeddings
using hnsw (embedding vector_cosine_ops);
```

RPC:

```sql
create or replace function public.match_adverts_semantic(
  query_embedding vector(768),
  p_category_id uuid default null,
  p_price_max numeric default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km numeric default null,
  p_limit int default 24
) returns table (
  advert_id uuid,
  similarity double precision,
  rank_score double precision
)
language sql
stable
as $$
  -- Fable5: draft only after validating pgvector dimensions and PostGIS availability.
  select e.advert_id,
         1 - (e.embedding <=> query_embedding) as similarity,
         1 - (e.embedding <=> query_embedding) as rank_score
  from public.advert_embeddings e
  join public.adverts a on a.id = e.advert_id
  where a.status = 'active'
  order by e.embedding <=> query_embedding
  limit p_limit;
$$;
```

Search route:

- Keep current `/api/search`.
- Add optional `mode=semantic|hybrid`.
- Add separate endpoint only for image query upload if needed:
  - `/api/search/semantic-query`
  - rate-limited;
  - does not persist query images by default.

Embedding generation:

- For adverts: background job after publish/update.
- For query image: prefer client-side embedding if model is small and already cached; otherwise server edge function with explicit consent and no retention.

### Задачи для Fable5

Assessment:

1. Confirm current Supabase pgvector version and available dimensions.
2. Compare embedding models:
   - multilingual text embedding;
   - image embedding;
   - CLIP/SigLIP-style joint embedding.
3. Build offline eval set:
   - 100 Belgian ads;
   - 30 image+text queries;
   - exact filter constraints.
4. Measure:
   - precision@10;
   - latency p95;
   - RPC query plan;
   - index size;
   - impact of WHERE filters with HNSW.
5. Do not replace existing search UI. Add semantic mode as optional pilot.

### Риски и красные линии

Risks:

- Vector search can look smart but return legally risky irrelevant results.
- HNSW + filters need careful query planning.
- Embeddings from images may encode personal/sensitive data.
- Multilingual query quality can vary.

Red lines:

- Do not remove structured price/location/category filters.
- Do not store user-uploaded query photos unless user explicitly saves search.
- Do not expose private/draft/rejected ads through vector RPC.
- Do not use semantic rank to bypass moderation/trust gates.

### Sources

- Supabase semantic search: https://supabase.com/docs/guides/ai/semantic-search
- Supabase vector columns: https://supabase.com/docs/guides/ai/vector-columns
- Supabase HNSW indexes: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes
- pgvector: https://github.com/pgvector/pgvector

### CTO recommendation

**Pilot next, not replace.** Hybrid search can become differentiator, but only after classic search is stable.

## 4. Zero-Party Store Of One - Session Personalization Without Tracking

### Продуктовая ценность

На пустом рынке нельзя ждать, что пользователь найдет идеальное объявление сразу. Session personalization может:

- быстрее поднимать похожие товары;
- превращать browsing в intent loop;
- улучшать "More to explore";
- не требовать invasive cross-session profiling.

Это помогает cold start, если не притворяется полноценной ML-рекомендацией.

### Архитектурное решение

Опора на код:

- `apps/web/src/components/discovery/DiscoveryFeed.tsx`
- `supabase/migrations/20260629230000_discover_prefs.sql`
- `apps/web/src/app/api/search/route.ts`
- `apps/web/src/lib/analytics/trackServerEvent.ts`

Architecture:

1. MVP: client-only, in-memory/sessionStorage.
2. No stable user profile.
3. No third-party cookies.
4. No behavioral ad targeting.
5. User has visible reset: "Reset this session".
6. Ranking explanation: "Adjusted in this session based on what you opened or saved."

Signals allowed:

- category chip clicks;
- saved/favorite;
- opened ad;
- dwell bucket on ad photo, coarsened client-side;
- price range interaction;
- location/radius interaction.

Signals not allowed in MVP:

- raw mouse tracking;
- cross-session identity;
- sensitive inference;
- hidden sale of behavioral segments.

Local scoring:

```ts
type SessionIntent = {
  categoryWeights: Record<string, number>;
  priceMin?: number;
  priceMax?: number;
  locationBias?: { lat: number; lng: number; radiusKm: number };
  sellerTrustPreference?: 'any' | 'verified_contact' | 'business';
  updatedAt: number;
};
```

### Задачи для Fable5

1. Audit `DiscoveryFeed` and search response shape.
2. Propose a pure client `rankSessionItems(items, intent)` function.
3. Do not persist raw behavioral signals in Supabase for MVP.
4. If server re-ranking is proposed, classify it as personal data and require explicit privacy design.
5. Add unit tests:
   - no hidden item removal;
   - reset clears intent;
   - base rank remains visible;
   - accessibility labels do not change unexpectedly.

### Риски и красные линии

Risks:

- GDPR profiling if stored.
- Filter bubble.
- User mistrust if ranking changes mysteriously.
- Performance churn if rerank causes layout shifts.

Red lines:

- No cross-session behavioral profile without explicit consent.
- No ad targeting.
- No sensitive category inference.
- No raw dwell events stored server-side in MVP.
- No infinite feed that hides legal footer.

### CTO recommendation

**Do a small MVP.** Client-only session re-rank is low cost and can improve discovery without GDPR debt.

## 5. Post-Contract Reputation Sharing - Trust Economy 2.0

### Продуктовая ценность

LyVoX needs real trust, not seed/fake reviews. Authentic review requests after likely successful contact can:

- increase verified reviews;
- reduce fake review risk;
- help buyers trust thin supply;
- distinguish LyVoX from generic classifieds.

But this is privacy-sensitive because it touches chat content.

### Архитектурное решение

Опора на код:

- `apps/web/src/app/api/chat/send/route.ts`
- `apps/web/src/lib/chat/scrubContacts.ts`
- `apps/web/src/app/api/reviews/route.ts`
- `supabase/migrations/20260627270000_reviews.sql`
- `supabase/migrations/20251108120000_chat_tables.sql`

Principle:

- Do not auto-create reviews.
- Generate a review request token only.
- Store minimal evidence signals, not message bodies.
- Let both parties opt out/report abuse.

Signal model:

- conversation exists;
- buyer and seller both participated;
- minimum message count;
- time window after contact;
- optional seller marks "deal completed";
- buyer confirms;
- heuristic chat patterns:
  - pickup address/time exchange;
  - "sold", "thank you", "picked up", "deal done" in supported locales;
  - absence of open dispute/report.

Data model:

```sql
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  evidence_version text not null,
  evidence_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'used', 'expired', 'revoked', 'reported')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (advert_id, reviewer_id, reviewee_id)
);

alter table public.review_requests enable row level security;
```

Token:

- HMAC server secret;
- bound to advert_id, conversation_id, reviewer_id, reviewee_id, expiry;
- store hash only;
- one use;
- rotate secret with version.

### Задачи для Fable5

1. Read `create_review` RPC and propose how token requirement integrates without breaking existing conversation-based review flow.
2. Design detection as rules first, not LLM over private chat.
3. Add `review_request_events` only if necessary; keep minimal retention.
4. Add abuse controls:
   - rate limits;
   - per advert unique;
   - cannot review self;
   - report/revoke;
   - no seed reviews;
   - suspicious accounts blocked.
5. Add tests:
   - token cannot be reused;
   - expired token rejected;
   - wrong reviewer rejected;
   - reported conversation suppresses request;
   - no request for contact-masked high-risk chat until reviewed.

### Риски и красные линии

Risks:

- GDPR chat profiling.
- False positives.
- Coerced reviews.
- Revenge reviews.
- Bot-generated conversations.

Red lines:

- No fake/seed reviews.
- No automatic rating.
- No public "deal completed" badge unless both sides confirm.
- No storing raw private chat snippets as review evidence.
- No AI-only decision to declare success.

### CTO recommendation

**Design now, implement later.** First fix review integrity and contact safety; then add tokenized review requests.

## 6. Automatic Translation For All Platform Languages

### Продуктовая ценность

Belgium is multilingual. Translation is one of the highest-value features for cold start:

- one seller listing becomes discoverable to `nl/fr/en/de/ru` users;
- search recall improves;
- category pages avoid looking empty by language;
- buyers understand listings without forcing sellers to write five versions.

This should be higher priority than browser VLM generation.

### Архитектурное решение

Опора на код:

- `apps/web/src/i18n/locales/{en,fr,nl,de,ru}.json`
- `apps/web/src/app/ad/[id]/page.tsx`
- `apps/web/src/app/api/adverts/[id]/route.ts`
- `supabase/migrations/20260628000001_add_content_locale_to_adverts.sql`

Data model:

```sql
create table if not exists public.advert_translations (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  source_locale text not null,
  target_locale text not null,
  title text not null,
  description text,
  generated_by text not null,
  model_or_provider text not null,
  source_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'stale', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advert_id, target_locale, source_hash)
);

alter table public.advert_translations enable row level security;
```

Rules:

1. Source text remains canonical.
2. Machine translated text is labeled:
   - "Machine translated from Dutch"
   - "Переведено автоматически с нидерландского"
3. UI provides "View original".
4. Do not translate legal platform copy through this pipeline.
5. Do not translate unverifiable claims into stronger language.
6. Translation job runs async after draft save or publish.

Provider options to evaluate:

- Server-side translation provider via Edge Function.
- Open-source small translation model in batch worker.
- Browser local translation only as future enhancement, not MVP.

Search:

- Create FTS materialization for source + translations.
- Search result should prefer user's locale translation but show generated label on detail page.

SEO:

- Do not create indexable duplicate ad pages per locale unless hreflang/canonical is correct and translated content is stable.
- Generated translation can be indexed only if visible, labeled and meets quality thresholds.

### Задачи для Fable5

1. Inspect `content_locale` migration and current ad page translation behavior.
2. Propose `advert_translations` migration + RLS.
3. Propose async job:
   - on publish;
   - on source edit with source_hash invalidation;
   - retry queue;
   - stale mark.
4. UI spec:
   - generated translation badge;
   - original toggle;
   - report bad translation.
5. Moderation:
   - run prohibited-content checks on source;
   - optional checks on generated target text;
   - never allow translation to bypass moderation.
6. Tests:
   - all locales generated/marked;
   - original fallback;
   - stale after edit;
   - label visible in ad page;
   - no hardcoded strings.

### Риски и красные линии

Risks:

- Legal meaning changes in translation.
- Seller disputes "I did not say that".
- SEO duplicate/thin content.
- Cost if every draft triggers five translations.

Red lines:

- Never hide that translation is generated.
- Never replace original.
- Never translate platform legal promises through seller-content pipeline.
- Never strengthen seller claims.
- Never index generated translations without hreflang/canonical control.

### CTO recommendation

**Do now, async and labeled.** This is likely the highest ROI among AI features for Belgian cold start.

## 7. Additional 2026 Features Worth Evaluating

### 7.1 Listing Quality Coach

Value:

- Improves supply quality before publish.
- Cheaper and safer than full generative AI.

Architecture:

- Rule-based + optional local AI.
- Shows checklist: photo, title, location, price, condition, defects, pickup/delivery.
- Feeds first-grid eligibility.

Recommendation: **Do now.**

### 7.2 Demand Capture / Buyer Intent Cards

Value:

- Empty search becomes supply signal.
- Helps cold start by telling sellers what buyers want.

Architecture:

- Aggregate zero-result searches with privacy-safe bucketing.
- No raw personal query logs exposed.
- Surface "buyers are looking for X near Y" only above threshold.

Recommendation: **Do next.**

### 7.3 AI-Assisted Safety Copy Per Category

Value:

- Category-specific safety boosts trust and SEO.
- For cars: Car-Pass, VIN, inspection.
- For electronics: IMEI, receipt, battery.

Architecture:

- Static expert-authored templates first.
- AI only suggests drafts for admin review.

Recommendation: **Do now manually; AI only as internal drafting helper.**

### 7.4 On-Device Photo Privacy Check

Value:

- Warn seller if photo shows face, license plate, document, address.
- Improves trust and GDPR posture.

Architecture:

- Lightweight local object detection if WebGPU available.
- Fallback manual checklist.

Recommendation: **Spike after WebGPU post-assist.**

### 7.5 Fair Price Intelligence - Price Suggestion And Price Critique

This is not "AI guesses a price". This is a seller guidance, buyer safety, and marketplace liquidity feature.

#### Product value

Cold start problem:

- Sellers hesitate because they do not know the Belgian second-hand price.
- Overpriced listings stay unsold and make the market look dead.
- Underpriced listings can be legitimate urgency, but also bait/scam.
- Buyers need confidence: "this is ok", "this is high", "this is unusually low".

Expected product effect:

- In `/post`: show a recommended range and a confidence state before publish.
- On `/ad/[id]`: show a restrained price anchor only when statistically defensible.
- In moderation/fraud: very low price becomes an internal risk signal, not an automatic accusation.
- In seller analytics: explain why the ad is not getting contact: price, photos, description, trust, location.

#### Current project context

Existing references:

- `docs/features/52-ai-fair-price.md`
- `docs/strategy/SITE_BLUEPRINT.md` already requires median price only above a real non-seed threshold.
- `supabase/migrations/20251105215500_belgium_validation_functions.sql` contains `check_price_outlier()`, but it uses average/stddev, which is too fragile for small marketplaces.
- `apps/web/src/app/api/comparison/route.ts` already normalizes comparable adverts and specifics; it is useful context, not a final pricing engine.

The existing `check_price_outlier(category_slug, price, threshold_sigma)` must not be treated as production-grade fair-price logic. Mean plus standard deviation is weak against outliers, seed data, thin categories, and bait feedback loops.

#### Architecture

Use robust statistics first, not generative AI.

Data sources in MVP:

- Published real adverts.
- Sold/archived adverts only when the status semantics are trustworthy.
- Exclude seed/demo adverts when a seed flag exists.
- Exclude blocked sellers, fraud-flagged adverts, removed adverts, and the advert being evaluated.
- Do not use external scraping unless legal review explicitly approves it.

Price estimator contract:

```ts
type PriceSuggestionResult =
  | {
      status: "ready";
      currency: "EUR";
      low: number;
      median: number;
      high: number;
      label: "low" | "ok" | "high";
      confidence: "low" | "medium" | "high";
      sampleSize: number;
      backoffLevel: string;
      explanationKey: string;
    }
  | {
      status: "insufficient_data";
      reason: "too_few_comparables" | "missing_attributes" | "unsupported_category";
    };
```

Backoff hierarchy:

1. Exact vertical slice: category + brand/model/generation + condition + year band.
2. Same model/brand + condition.
3. Same leaf category + condition.
4. Same parent category + condition.
5. Insufficient data; show no numeric estimate.

Statistics:

- Median + IQR, not mean/stddev.
- Minimum sample threshold: start with `n >= 8` for internal suggestion, `n >= 20` for public price anchor.
- Winsorize or trim extreme outliers.
- Keep configurable thresholds: low/high labels should not be hardcoded in UI.

Possible schema, only after Fable5 assessment:

```sql
create table public.price_reference_snapshots (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  attribute_hash text not null,
  currency text not null default 'EUR',
  sample_size int not null,
  median_price numeric not null,
  p25_price numeric,
  p75_price numeric,
  backoff_level text not null,
  computed_at timestamptz not null default now(),
  source_window_days int not null,
  metadata jsonb not null default '{}'::jsonb
);
```

Do not add this table if an on-demand SQL/RPC with good indexes is enough for MVP. The assessment must compare live RPC vs cached snapshots.

#### Tasks for Fable5

1. Read `docs/features/52-ai-fair-price.md`, `docs/strategy/SITE_BLUEPRINT.md`, and the current outlier SQL.
2. Produce a price-intelligence assessment before implementation:
   - categories supported in wave 1;
   - required fields per category;
   - minimum sample rules;
   - backoff levels;
   - seed exclusion strategy;
   - fraud/moderation integration;
   - public UI copy for "low/ok/high";
   - API shape and tests.
3. Propose an API, likely `GET /api/price-suggestion`, accepting category, price, condition, and category-specific attributes.
4. Add no public badge until the estimator can return `status:"ready"` with a defensible sample size.
5. Instrument:
   - `price_suggestion_shown`;
   - `price_suggestion_applied`;
   - `price_suggestion_ignored`;
   - `price_warning_shown`.
6. Design UI for:
   - `/post` seller guidance;
   - `/ad/[id]` buyer-facing price anchor;
   - profile/seller analytics improvement suggestion.

#### Risks and red lines

- Do not call it "market value" or "fair value" as a guarantee.
- Do not show exact numbers with tiny sample sizes.
- Do not show public "too expensive" shame labels on thin data.
- Do not use seed/demo adverts in medians.
- Do not let bait listings push future medians downward.
- Do not make moderation decisions solely from price.
- Do not compare a child's jacket to all fashion, or a BMW E39 to all transport; vertical slice matters.
- Do not scrape competitors without legal review.

#### CTO recommendation

**Do next as a robust-statistics MVP, not an LLM MVP.** It is commercially valuable, but only after category/filter taxonomy is clean enough to define "similar item".

### 7.6 Category Tree And Vertical Filter Architecture - Each Category As Its Own Marketplace

This is a foundational product architecture issue, not a small UI improvement.

The target behavior: choosing cars should feel like a cars marketplace; choosing real estate should feel like a real estate marketplace; choosing baby clothes should never expose engine volume, fuel type, VIN, EPC, or CP-code filters.

#### Product value

Cold start and liquidity impact:

- Buyers tolerate thin inventory only if the category experience feels precise and trustworthy.
- Wrong filters destroy trust immediately; a marketplace that lets a child's jacket filter by engine size feels unfinished.
- Sellers complete more listings when fields match the item, not a generic "describe everything" form.
- Category-specific fields feed search, SEO/AEO, price suggestions, and recommendations.

This feature is a dependency for:

- price suggestions;
- vector/hybrid search filters;
- automatic listing quality score;
- SEO category pages `/c/*`;
- structured JSON-LD;
- agentic commerce readability.

#### Current project context

Relevant files and docs:

- `docs/features/32-category-catalogs.md`
- `docs/features/33-search.md`
- `docs/features/62-listing-detail-per-category.md`
- `docs/catalog/POSTFORM_INTEGRATION.md`
- `docs/catalog/SEARCHFILTERS_EXTENSION.md`
- `apps/web/src/lib/utils/categoryDetector.ts`
- `apps/web/src/components/SearchFilters.tsx`
- `apps/web/src/app/post/PostForm.tsx`
- `apps/web/src/app/api/catalog/schema/route.ts`
- `apps/web/src/catalog/renderer/*`

Important finding:

- `SearchFilters.tsx` currently has `SCHEMA_EXCLUDED_TYPES = new Set(["vehicle", "real_estate", "electronics", "fashion", "jobs"])`.
- That means the most important verticals are excluded from dynamic schema filters.
- There is already a schema API and renderer, but the filter contract is not yet a full vertical search contract.

#### Architecture

Fable5 must first audit the category tree end-to-end:

1. Category taxonomy:
   - root categories;
   - leaf categories;
   - active/inactive categories;
   - localized names;
   - `slug` and `path` consistency;
   - category-to-domain mapping.
2. Form fields:
   - fields required to publish;
   - optional quality fields;
   - compliance fields;
   - hidden/admin-only fields.
3. Search filters:
   - filterable fields;
   - index strategy;
   - URL parameter name;
   - display widget;
   - mobile behavior.
4. Listing detail:
   - key-specs strip;
   - sections/tabs;
   - document badges;
   - KB blocks.
5. SEO/AEO:
   - category metadata;
   - JSON-LD fields;
   - index/noindex facet strategy.

Recommended data contract:

```ts
type CategoryVertical = {
  domain:
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
  categoryId: string;
  path: string;
  formSchemaId: string | null;
  filterSchemaId: string | null;
  detailLayout: "tabs" | "sections" | "minimal";
  priceComparableKeys: string[];
  seoIndexPolicy: "index_category_only" | "index_whitelisted_facets" | "noindex";
};
```

The same category contract should drive:

- `/post` fields;
- `/search` filters;
- `/c/*` category page filters;
- `/ad/[id]` key-specs and tabs;
- JSON-LD generators;
- price suggestion comparable keys;
- vector search structured constraints.

Do not maintain separate hardcoded switch statements for every surface unless the assessment proves it is safer for a narrow transition phase.

#### Required category examples

Cars / transport:

- Fields: make, model, generation, year, mileage, fuel, transmission, body, engine volume, power, VIN, Car-Pass status, inspection validity, damage state.
- Filters: make/model, year range, mileage max, fuel, transmission, body, price, location radius, seller verified, Car-Pass/document badges.
- No fields like clothing size, EPC, CP-code, pet breed.

Real estate:

- Fields: sale/rent, property type, area, rooms, bedrooms, bathrooms, EPC/PEB, address granularity, municipality/postcode, charges, availability.
- Filters: sale/rent, property type, area, rooms, EPC, outdoor/parking/elevator, price/rent, city/radius.
- No engine volume, mileage, IMEI, clothing size.

Fashion / baby clothes:

- Fields: brand, size system, size, gender/age group, material, color, condition, season, authenticity notes if premium.
- Filters: size, gender/age, brand, condition, color, price.
- No engine, EPC, job contract, property area.

Electronics:

- Fields: device type, brand, model, storage/RAM, battery health, IMEI/serial where relevant, warranty, defects/accessories.
- Filters: brand/model, storage, RAM, battery health, warranty, condition, price.
- No property rooms or vehicle mileage.

Jobs:

- Fields: job category, CP-code, contract type, salary range, schedule, remote, experience, location.
- Filters: contract, salary, remote, sector, location.
- No product condition or delivery pickup.

#### Tasks for Fable5

1. Produce a taxonomy audit table before implementation:
   - category path;
   - detected domain from `categoryDetector.ts`;
   - expected domain;
   - form schema;
   - filter schema;
   - detail layout;
   - missing required fields;
   - wrong/inapplicable filters.
2. Verify that `categoryDetector.ts` does not rely on brittle Russian transliteration where a stable category metadata field would be better.
3. Propose whether to add explicit `categories.domain` or `categories.vertical_key`.
4. Propose a single `catalog_filter_schema` or reuse `catalog_subcategory_schema` with a `surface: "post" | "search" | "detail"` distinction.
5. Remove the need for `SCHEMA_EXCLUDED_TYPES` by replacing it with explicit filter schemas for heavy domains.
6. Define URL params for category filters so they are stable, typed, and do not create SEO crawl traps.
7. Ensure `/search` remains `noindex`, while `/c/*` category pages get a controlled facet strategy.
8. Create tests:
   - "baby jacket never renders engine volume";
   - "cars render mileage/fuel/transmission";
   - "real estate renders EPC/rooms/area";
   - "jobs render contract/salary";
   - "changing category clears incompatible filter params";
   - "API rejects unknown or incompatible catalog_field_* params".

#### Risks and red lines

- Do not patch this by adding more one-off `if categoryType === ...` blocks in `SearchFilters.tsx`.
- Do not show a filter unless the backend can actually apply it.
- Do not let stale URL params from one category affect another category.
- Do not index arbitrary filter combinations.
- Do not let generic categories inherit dangerous/silly fields from a parent.
- Do not use a field in price suggestions unless the field is validated and consistently stored.
- Do not hardcode UI strings; all labels must go through i18n.

#### CTO recommendation

**Do now as a foundation audit and contract design.** Implementation can be phased, but no advanced AI/search/price work should depend on the current incomplete category-filter layer without this audit.

## 8. Decision Matrix

| Feature | Recommendation | Why |
|---|---|---|
| Agentic Commerce Readiness | Do now | Low risk, SEO/AEO compatible, builds on existing JSON-LD |
| Automatic Translation | Do now | Direct Belgian liquidity multiplier |
| Store of One | Small MVP | Client-only session personalization has low GDPR debt |
| Vector Search | Pilot next | Valuable, but must stay hybrid and measured |
| Trust Economy 2.0 | Design now, implement later | High trust value, high privacy risk |
| Client WebGPU AI | Spike only | Interesting, but mobile/model risk is high |
| Listing Quality Coach | Do now | High ROI, can be rule-based |
| Demand Capture | Do next | Turns empty demand into supply strategy |
| Fair Price Intelligence | Do next after taxonomy audit | High liquidity value, but depends on clean comparables and non-seed data |
| Category Tree / Vertical Filters | Do now as foundation audit | Prevents category nonsense and unlocks price/search/SEO quality |

## 9. Global Red Lines

- No money-flow/payment/escrow claims until F3 legal gate is closed.
- No AI-generated seller claims without user confirmation.
- No hidden profiling.
- No persistent behavioral personalization without consent and DPIA-style review.
- No public trust badge that is not backed by actual data.
- No AI-only moderation decisions for high-impact user outcomes.
- No client-heavy AI in initial page bundles.
- No hardcoded UI strings.
- No new table without RLS.
- No feature without capability flag and kill switch.
- No price label or public median below the minimum real non-seed sample threshold.
- No category filter unless that field belongs to the selected category and is enforced by backend validation.

## 10. Required Fable5 Deliverable Before Implementation

Fable5 must produce:

1. A scored proposal for each feature: value, effort, risk, dependencies, data model, rollout.
2. A category taxonomy and filter audit table before any price/search/AI implementation.
3. A recommended wave plan:
   - Wave 0: docs/tests/spikes only.
   - Wave 1: low-risk foundations.
   - Wave 2: pilot features behind flags.
   - Wave 3: public rollout.
4. Exact files to touch.
5. Exact migrations to add.
6. Test plan:
   - unit;
   - integration;
   - migration;
   - RLS;
   - i18n;
   - accessibility;
   - CWV/performance.
7. Rollback plan.

No implementation PR should be accepted until this assessment exists.

## 11. Belgium Behavioral Crash-Test - Synthetic Customer Agent Corrections

This section is a behavioral stress test, not marketing storytelling.

Full Codex execution report: `docs/strategy/BELGIUM_BEHAVIORAL_CRASH_TEST_CODEX.md`.

Fable5 must run the same test independently before implementation and compare its answers against this section. If Fable5 disagrees, it must cite concrete code, schema, PRD, or legal evidence. No "I think UX will be fine" answers.

### 11.0 Mandatory Fable5 Replication Protocol

Fable5 must produce a file or appendix with:

1. The same six agents below, with the same starting scenarios.
2. Its own simulated review for each agent.
3. A comparison table:
   - Codex finding;
   - Fable5 finding;
   - agreement/disagreement;
   - new risks discovered by Fable5;
   - implementation decision.
4. A final "do / defer / reject" recommendation per system gap.
5. Acceptance criteria mapped to tests.

If Fable5 skips this replication step, implementation is blocked.

Assumption for the simulation: features from sections 1-10 are imagined as implemented in their intended direction. The crash-test looks for gaps where the requirements are still too vague, too optimistic, or unsafe for the Belgian market.

### 11.1 Agent A - Flemish Local Privacy Maximalist

Profile:

- Name: Pieter Van den Broeck.
- Locale: Geel, Antwerp province.
- Language: Dutch first, tolerates English, avoids French unless necessary.
- Buying mode: strictly local, usually within 10-20 km.
- Fear: hidden tracking, behavioral profiling, "AI decides what I see".
- Trust trigger: clear local radius, no dark patterns, visible explanation of ranking.

Scenario:

- Searches for a used cargo bike near Geel.
- Tests "Store of One" personalization.
- Changes privacy settings mid-session.
- Opens three listings, then checks whether feed order changed without explanation.

What he liked:

- Local radius and map/location constraints make LyVoX feel Belgian, not generic.
- Session personalization is acceptable when it visibly says it is local/session-only.
- "Why this order?" and "Reset session preferences" reduce panic.
- Verified seller and local pickup signals matter more than broad AI recommendations.

What broke the experience:

- Any unexplained feed reshuffle feels like hidden profiling.
- If dwell time is sent to the server, he assumes GDPR abuse.
- If a broader region fallback silently mixes Antwerp, Limburg, and Brussels, he loses trust.
- If Dutch copy uses generic machine-translated wording, the product feels foreign.

Ultimate missing requirement for a deal:

- A privacy-visible mode: "local only, no personalization, no tracking beyond this request".

#### System gaps

- Store-of-One requirements do not yet force a user-visible explanation and reset control on every personalized surface.
- Search radius behavior is not specified tightly enough for local Belgian users.
- Analytics boundaries are not strict enough: raw dwell/click behavior must not leak into server logs for MVP personalization.
- NL-BE localization quality is a trust feature, not a nice-to-have.

#### Architecture correction

- Add a `PersonalizationMode` contract:

```ts
type PersonalizationMode = "off" | "session_only";

type SessionIntentState = {
  mode: PersonalizationMode;
  source: "memory" | "sessionStorage";
  updatedAt: number;
  categories: Record<string, number>;
  priceBands: Record<string, number>;
  localRadiusKm: number | null;
};
```

- `mode:"off"` means no session re-ranking, no `sessionStorage`, no behavioral analytics except aggregate pageview/search events already allowed by privacy policy.
- `mode:"session_only"` means client-side state only; no stable user profile, no cross-session replay.
- Search radius must be strict by default. Any fallback outside radius must be visually labeled as "outside selected radius" and separated.
- Add a `/privacy/personalization` explanation page or modal linked from "Why this order?"

#### Acceptance criteria

- E2E: with personalization off, opening listings does not change feed order.
- Network test: dwell time and per-card ranking weights are not POSTed to server in MVP.
- E2E: Geel + 20 km search does not mix in Brussels results unless explicitly shown in an "outside radius" section.
- Component test: every personalized feed has "Why this order?" and "Reset" controls.
- i18n test: Dutch copy for privacy controls exists and does not fall back to English keys.

### 11.2 Agent B - Walloon Car Enthusiast And Parts Buyer

Profile:

- Name: Julien Masson.
- Locale: Namur / Charleroi corridor.
- Language: French first. Dutch seller messages frustrate him.
- Buying mode: used cars, engines, rims, body panels, obscure parts.
- Fear: wrong compatibility, wrong generation, seller hiding damage.
- Trust trigger: generation-level vehicle filters, Car-Pass, French translation, technical specificity.

Scenario:

- Searches for BMW 5 Series parts compatible with an E39.
- Filters by fuel, transmission, year, mileage, body, and distance.
- Opens a Flemish seller listing written in Dutch.
- Checks whether auto-translation preserves technical terms.

What he liked:

- Vehicle filters by make/model/generation are the first sign LyVoX understands cars.
- Car-Pass and inspection/document badges improve trust.
- French machine translation helps, if clearly marked and technically sane.
- Price critique is useful only when comparables are truly similar.

What broke the experience:

- Generic "transport" filters are useless for serious car buyers.
- If E34/E39 overlap years are guessed silently, he will not trust the platform.
- Auto-translation that turns technical terms into vague consumer language is worse than no translation.
- Flemish seller chat without translation blocks the deal.

Ultimate missing requirement for a deal:

- Generation-safe vehicle search plus bidirectional chat/listing translation with technical glossary.

#### System gaps

- Vehicle vertical filters must be deeper than normal category filters.
- Generation ambiguity handling is a hard requirement, not a future improvement.
- Translation must preserve domain terms: trims, engines, transmission, body styles, part numbers.
- Chat translation has not been explicitly connected to the automatic listing translation requirement.

#### Architecture correction

- Vehicle filter schema must include `make_id`, `model_id`, `generation_id`, `year_min/max`, `mileage_max`, `fuel_type`, `transmission`, `body_type`, `engine_volume`, `power`, `part_type`, and compatibility fields.
- `generation_id` must be normalized and never re-derived silently from year at render time.
- Add a domain glossary layer for translations:
  - vehicle terms;
  - electronics terms;
  - real estate terms;
  - job/legal terms.
- Chat auto-translation should be opt-in per conversation, labeled as machine-generated, and should preserve original text.

#### Acceptance criteria

- Unit: BMW 5 Series year 1996 returns `ambiguous`, not first match.
- E2E: selecting E39 excludes incompatible E34-only parts.
- E2E: French UI displays a Dutch listing with generated translation label and "show original".
- Translation test: `boîte automatique`, `automatische versnellingsbak`, and `automatic transmission` map consistently.
- API test: vehicle search rejects incompatible filter params for non-vehicle categories.
- Chat test: translated message stores original and generated text separately.

### 11.3 Agent C - Brussels Expat Mother In A Hurry

Profile:

- Name: Sofia Alvarez.
- Locale: Brussels, often moving between Ixelles, Etterbeek, and school runs.
- Language: English first, understands some French.
- Buying/selling mode: baby clothes, stroller, toys, small household goods.
- Fear: wasting time, choosing wrong price, filling long forms, unsafe kids products.
- Trust trigger: photo-first posting, instant suggestions, clear pickup radius, price guidance.

Scenario:

- Takes one photo of a baby jacket and tries to publish in under two minutes.
- Expects category, title, size, condition, and price suggestion.
- Searches for a stroller near Brussels with fast pickup.
- Tests whether generated translations and safety labels are understandable.

What she liked:

- Photo-first `/post` removes friction.
- AI-assisted category/title suggestions feel modern.
- Price guidance prevents both underpricing and embarrassing overpricing.
- "Generated translation" labels are acceptable if originals are one tap away.

What broke the experience:

- Eight-step posting is too long for low-value items.
- If WebGPU model loading blocks the first screen, she abandons.
- If baby/kids categories ask irrelevant generic fields, the platform feels unfinished.
- If price suggestion says "insufficient data" too often without guidance, she is still stuck.

Ultimate missing requirement for a deal:

- A lightweight "fast post" path for simple goods: photo, title/category, price, location, publish.

#### System gaps

- Client-side AI section must not imply every seller gets instant local model inference.
- `/post` needs category-dependent compression: four-step fast path for simple C2C goods, richer progressive disclosure for vehicles/real estate/jobs.
- Baby/kids category requires safety/compliance fields without making every small listing feel like paperwork.
- Price guidance needs a non-numeric fallback when comparables are insufficient.

#### Architecture correction

- Define `PostFlowMode`:

```ts
type PostFlowMode = "fast_goods" | "vehicle_deep" | "real_estate_deep" | "job_deep" | "generic";
```

- `fast_goods` required fields:
  - photo;
  - title;
  - category;
  - price or free/negotiable;
  - condition;
  - location.
- Optional category quality fields are asked after draft creation, not before first publish intent.
- Local AI is lazy-loaded after photo selection and must be cancellable.
- If price data is insufficient, show qualitative guidance:
  - "No reliable LyVoX range yet";
  - "Check similar listings";
  - "Price lower for fast pickup";
  - no fabricated median.

#### Acceptance criteria

- E2E: baby jacket can reach preview in <= 4 required screens.
- Performance: no AI model is loaded before photo upload and explicit assist action/eligibility.
- E2E: baby/kids category never renders vehicle, property, or job fields.
- Unit: insufficient price data returns no numeric estimate.
- i18n: English and French labels exist for generated translation, original text, safety notices, and price guidance.
- A11y: mobile `/post` primary action remains reachable above keyboard/safe-area.

### 11.4 Agent D - Professional Electronics Reseller And Lowball Negotiator

Profile:

- Name: Karim El Idrissi.
- Locale: Antwerp/Brussels, buys everywhere if margin exists.
- Language: multilingual but transactional.
- Buying mode: phones, laptops, consoles; sends many low offers.
- Behavior: aggressive negotiation, repeated templates, conflict-prone chat.
- Trust trigger: fast search, price anomalies, seller verification, device specs.

Scenario:

- Searches for iPhones below median.
- Sends repeated low offers to multiple sellers.
- Challenges seller description and pushes for off-platform contact.
- Tries to use chat as negotiation automation.

What he liked:

- Deep electronics filters make arbitrage efficient.
- Battery health, storage, warranty, IMEI/serial checks are valuable.
- Price critique highlights underpriced items fast.
- Verified sellers reduce wasted time.

What broke the experience:

- If lowball messages are unrestricted, sellers get annoyed and leave.
- If anti-contact masking is too aggressive, legitimate model/serial/technical URLs may be damaged.
- If "too low" price warnings are public, he can game them.
- If professional trader identity is not visible, buyers/sellers cannot calibrate risk.

Ultimate missing requirement for a deal:

- Structured offers and abuse-resistant negotiation controls without pretending LyVoX has escrow.

#### System gaps

- Chat safety currently focuses on contact masking, not negotiation abuse.
- Price intelligence must not become a public arbitrage exploit.
- Professional/reseller behavior needs product constraints: rate limits, structured offers, seller controls.
- Electronics filters require specs and device trust fields before price intelligence is useful.

#### Architecture correction

- Add structured offer events inside chat, not payment flow:

```ts
type ChatOffer = {
  advertId: string;
  conversationId: string;
  amountCents: number;
  currency: "EUR";
  message?: string;
  status: "sent" | "declined" | "accepted_in_chat" | "expired";
};
```

- This is not escrow, not checkout, not payment authorization.
- Add per-user and per-ad lowball rate limits.
- Seller can:
  - set minimum acceptable offer;
  - auto-decline offers below threshold;
  - block buyer from an advert conversation;
  - report negotiation abuse.
- Keep extreme price flags internal unless public threshold and sample size are defensible.

#### Acceptance criteria

- API: offer amount is validated server-side and cannot trigger payment/escrow code.
- Rate limit: repeated lowball offers across adverts trigger soft friction or cooldown.
- Seller control: seller can auto-decline offers below a chosen threshold.
- Chat: contact masking does not corrupt allowed technical identifiers unless they are external contact channels.
- Fraud: very low listing price creates internal risk signal only; it does not auto-hide a listing.
- DSA/trader: professional seller/buyer status is disclosed when account type requires it.

### 11.5 Agent E - Rural Older Buyer With Low Digital Confidence

Profile:

- Name: Marie Peeters.
- Locale: rural Limburg.
- Language: Dutch, simple wording preferred.
- Buying mode: furniture, home goods, occasional pets.
- Fear: scams, confusing interfaces, wrong pickup location, hidden costs.
- Trust trigger: clear seller verification, simple chat, no forced AI, no fake urgency.

Scenario:

- Searches for a dining table nearby.
- Opens a listing with generated translation and AI price label.
- Starts a chat and worries about being asked to pay outside the platform.

What she liked:

- Simple trust labels and phone verification are more useful than abstract AI.
- Clear pickup location and seller age-on-platform calm her down.
- Safety bottom-sheet is acceptable if it does not block chat.

What broke the experience:

- Too many badges create badge inflation.
- "AI recommended" copy feels manipulative.
- If chat warnings are hidden too deep, she misses them.
- If text is small or UI controls are dense, she gives up.

Ultimate missing requirement for a deal:

- A low-cognitive-load safety layer: clear, optional, repeated at the right moments.

#### System gaps

- AI/trust labels need a strict hierarchy and plain-language wording.
- Accessibility and older-user readability must be acceptance criteria, not a post-launch polish item.
- Safety guidance must appear in chat context without adding blocking friction before contact.

#### Architecture correction

- Define a `TrustSignalPolicy`:
  - verified phone;
  - verified email;
  - itsme/KBO when available;
  - generated translation;
  - price guidance;
  - promoted listing.
- Each signal gets:
  - visible label;
  - public explanation;
  - source of truth;
  - minimum threshold;
  - banned wording.
- Chat start should include one concise safety hint plus link to full checklist.

#### Acceptance criteria

- A11y: trust labels and chat controls meet keyboard and screen-reader requirements.
- UX: no more than the approved set of trust/AI badges can appear above the fold.
- Copy: no badge uses "guaranteed", "safe payment", or "verified purchase" before legal gates.
- E2E: chat start shows concise safety copy without blocking message send.
- Visual: mobile text and buttons do not overlap at large system font sizes.

### 11.6 Agent F - Small Belgian Professional Seller

Profile:

- Name: Anke De Smet.
- Locale: Leuven.
- Language: Dutch/French business reach, English acceptable.
- Selling mode: refurbished electronics and small home goods.
- Fear: legal obligations, repetitive listing work, unfair ranking, unclear trader disclosure.
- Trust trigger: KBO/VAT clarity, batch tools, multilingual listings, transparent promotion labels.

Scenario:

- Creates a business seller profile.
- Posts ten refurbished phones.
- Checks whether translations, Recupel/EPR hints, and trader disclosures are correct.
- Tests boosted listings and ranking explanations.

What she liked:

- Automatic translations can expand reach across Belgium.
- Business trust profile helps distinguish her from private casual sellers.
- Category-specific electronics specs save time if reusable.
- Transparent boost labels are acceptable if ranking rules are stable.

What broke the experience:

- Re-entering the same brand/model/specs ten times is unacceptable.
- If generated translations alter warranty/refurbished claims, legal risk shifts to her.
- If trader obligations are vague, she will not trust the platform.
- If boost ranking is opaque, she suspects pay-to-win manipulation.

Ultimate missing requirement for a deal:

- Professional seller workflow: reusable specs, compliant disclosures, translation review, and ranking transparency.

#### System gaps

- The current AI feature package is C2C-heavy; B2C/pro-seller workflows need separate constraints.
- Automatic translation requires seller review controls for legal/commercial claims.
- Category specs should be reusable templates for professional inventory.
- Ranking transparency must include paid promotion and relevance explanation.

#### Architecture correction

- Add `business_listing_templates` only after business account/KYB review:

```sql
create table public.business_listing_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  category_id uuid not null references public.categories(id),
  name text not null,
  specifics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- RLS: owner business members only; public cannot read templates.
- Translation workflow must allow:
  - generated draft;
  - seller reviewed;
  - stale after source edit;
  - hidden from SEO until publish/review policy is satisfied.
- Ranking explanation must disclose paid promotion and main organic factors.

#### Acceptance criteria

- RLS: business templates are invisible to unrelated users.
- E2E: professional seller can create a second similar electronics listing from template without retyping specs.
- Translation: editing source text marks all generated translations stale.
- Compliance: business listing shows trader disclosure fields required by platform policy.
- Ranking: promoted listing visibly displays promotion label on search/feed/discover.
- Tests: generated translations cannot silently overwrite reviewed translations.

### 11.7 Cross-Agent System Corrections

These are not optional refinements. They are blockers for Belgian-market credibility.

| Gap | Why It Matters | Required Correction |
|---|---|---|
| Persona-visible privacy controls | Flemish trust fails without clear boundaries | Add `PersonalizationMode`, reset control, "Why this order?", no server raw dwell in MVP |
| True vertical filters | Every agent punished generic marketplace behavior | Replace ad-hoc category logic with explicit vertical/filter contracts |
| Translation with originals | Belgium is multilingual by default | Store original + generated + reviewed states; label every generated translation |
| Robust price intelligence | Price guidance drives liquidity but can mislead | Use median/IQR/backoff/sample thresholds; no seed; no tiny-sample public labels |
| Chat negotiation controls | Resellers can poison seller experience | Add structured non-payment offers, lowball rate limits, seller controls |
| Trust signal governance | Badge inflation destroys trust | Central `TrustSignalPolicy`, thresholds, banned copy, public explanations |
| Pro seller workflow | B2C supply needs legal and operational support | Business templates, trader disclosure, translation review, ranking transparency |
| Accessibility as acceptance | Older/rushed users fail dense UI | A11y tests for mobile font size, keyboard, screen readers, safe-area |

### 11.8 Commands To Fable5

Fable5 must not implement from this section directly. It must first deliver:

1. `BELGIUM_BEHAVIORAL_CRASH_TEST_FABLE5.md` with the replicated synthetic agent test.
2. A comparison table against section 11.
3. A prioritized gap list:
   - P0: blocks trust, privacy, category correctness, or legal claims;
   - P1: blocks conversion/liquidity;
   - P2: useful but deferrable.
4. A test map:
   - unit;
   - API;
   - RLS;
   - i18n;
   - Playwright;
   - accessibility;
   - performance.
5. A "do not build" list for any feature whose acceptance criteria cannot be met with current data.

Default CTO priority after this crash-test:

1. Category Tree / Vertical Filters.
2. Translation with originals and generated/reviewed states.
3. Privacy-visible Store of One.
4. Robust Fair Price Intelligence.
5. Chat negotiation controls.
6. Pro seller templates and compliance.

Any advanced AI feature that depends on weak category data or hidden personalization is deferred.
