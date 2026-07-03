# T06 — Внутренний прайс-оценщик median/IQR (БЕЗ публичного UI)

**Модель:** сильная (gpt xhigh / opus-класс) — статистика + SQL + API-дизайн.
**Ветка:** `feat/price-estimator-internal` · **Приоритет:** P1 · **Оценка:** 4 часа.

## Зачем
Бриф Codex §7.5 + краш-тест: `check_price_outlier` (avg/stddev, `supabase/migrations/20251105215500_belgium_validation_functions.sql:371`) статистически хрупок и, по проверке, из рантайма НЕ вызывается (мёртвый). Строим robust-оценщик. **ПУБЛИЧНОГО UI НЕТ**: решение основателя «seed остаётся витриной» делает порог «≥20 non-seed» недостижимым до launch-gate — сейчас оценщик только внутренний (модерация/фрод/будущее).

## Шаги
1. Прочитай `docs/features/52-ai-fair-price.md` и §7.5 брифа (`docs/strategy/AI_FEATURES_2026_EVALUATION_FOR_FABLE5.md`).
2. Миграция `supabase/migrations/<timestamp>_price_estimate_rpc.sql` (идемпотентно, `create or replace`):
   - функция `estimate_price(p_category_id uuid, p_condition text default null)` → `(sample_size int, p25 numeric, median numeric, p75 numeric, backoff_level text)`;
   - выборка: активные объявления ПОДДЕРЕВА категории (path-префикс, как в fix 5f8fa17: `c.path = X or c.path like X/'%'`), `price > 0`, `percentile_cont(0.25/0.5/0.75)`;
   - backoff: точная категория+condition → категория → родительская категория; вернуть уровень строкой;
   - если итоговый n < 8 → вернуть sample_size и NULL-квантили;
   - **seed-готовность**: оставь `-- TODO launch-gate:` комментарий, где добавится фильтр seed-аккаунтов (флага в схеме пока нет);
   - `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;` — функция ТОЛЬКО для сервера (урок кодбазы: Supabase раздаёт EXECUTE всем по умолчанию).
3. Применение: `supabase db push --include-all --db-url "$SUPABASE_DB_URL"` (echo Y |). Проверка вживую: `psql ... -c "select * from estimate_price('<uuid листа transport>');"` — квантили правдоподобны.
4. API `GET /api/price-suggestion` (service-роут, `withRateLimit` 30/мин по-user, конверт `createSuccessResponse`): параметры categoryId+condition; ответ — контракт `PriceSuggestionResult` из брифа §7.5 (status ready/insufficient_data). Доступ: только авторизованным (requireAuthenticatedUser) — это внутренний инструмент.
5. Тесты: route-тест (401 аноним, 200 форма ответа, insufficient при мок-null), по образцу `apps/web/src/app/api/media/__tests__`.

## Проверка
- Полный сьют зелёный; миграция применена и проверена psql'ом.
- Коммит: `feat(price): internal median/IQR estimator RPC + API (T06)` — merge --no-ff, push.

## Красные линии
- НИКАКОГО публичного бейджа/якоря цены. НИКАКИХ надписей «рыночная стоимость».
- Не удалять check_price_outlier (мёртвый, но пусть решает T03/аудит).
- Функция — service_role-only. Не забыть REVOKE (иначе дыра).
