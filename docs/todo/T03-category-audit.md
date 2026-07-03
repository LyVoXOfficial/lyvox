# T03 — Аудит категорий и вертикальный контракт (ДОКУМЕНТ, кода нет)

**Модель:** сильная (gpt xhigh / opus-класс) — это анализ и проектирование, не механика.
**Ветка:** `docs/category-audit` · **Приоритет:** P0-фундамент · **Оценка:** 3 часа.
**Деливерабл:** файл `docs/strategy/CATEGORY_VERTICAL_AUDIT.md`. НИКАКИХ правок кода в этом задании.

## Зачем
Codex CTO-бриф (`docs/strategy/AI_FEATURES_2026_EVALUATION_FOR_FABLE5.md` §7.6) и краш-тест сходятся: категорийный слой — зависимость для цен, поиска, SEO, AI. Сейчас `SearchFilters.tsx:62` исключает 5 главных вертикалей из схемных фильтров (`SCHEMA_EXCLUDED_TYPES`), контракт размазан по switch'ам.

## Что изучить (обязательный список чтения)
1. `apps/web/src/lib/utils/categoryDetector.ts` — как слаг → domain.
2. `apps/web/src/components/SearchFilters.tsx` — какие фильтры на какую вертикаль (и что hardcoded).
3. `apps/web/src/app/post/PostForm.tsx` + `apps/web/src/components/catalog/*Fields.tsx` — какие поля в форме на вертикаль.
4. `apps/web/src/catalog/renderer/*` + `apps/web/src/app/api/catalog/schema/route.ts` — схемный механизм (F13).
5. `apps/web/src/components/ad/KeySpecsStrip.tsx` — чипы на карточке.
6. БД: таблицы `categories` (slug/path/level/is_active), `catalog_groups`, `catalog_fields`, `catalog_field_options`, `catalog_subcategory_schema` — `supabase/types/database.types.ts`.
7. Живое дерево: `psql "$SUPABASE_DB_URL" -c "select path, level, is_active from categories order by path"` (URL в `.env`, переменная `SUPABASE_DB_URL`; НЕ печатать её значение).

## Структура деливерабла
1. **Таблица аудита** (по каждой из 9 корневых веток + выборочно 2-3 листа на ветку): path · detected domain (categoryDetector) · ожидаемый domain · поля формы · поисковые фильтры · раскладка /ad · чего не хватает · какие фильтры неуместны.
2. **Контракт `CategoryVertical`** — взять форму из брифа §7.6 (typescript-тип), адаптировать к реальной схеме БД; решить и обосновать: добавлять ли колонку `categories.domain` (рекомендация: да, enum-текст с CHECK, миграция идемпотентная) или продолжать выводить из слага.
3. **План замены `SCHEMA_EXCLUDED_TYPES`**: per-вертикаль filter-схемы (что переносится из hardcoded-блоков в `catalog_*`-таблицы, что остаётся кастомным кодом и почему).
4. **Тест-план** из брифа §7.6 (куртка без объёма двигателя; авто с пробегом/топливом; смена категории чистит несовместимые URL-параметры; API отклоняет чужие catalog_field_*).
5. **Фазировка**: волна A (колонка domain + контракт + тесты на detector), волна B (search-фильтры), волна C (post/detail унификация).

## Проверка
- Документ ссылается на реальные file:line (проверь каждую ссылку grep'ом перед записью).
- Коммит: `docs(catalog): category vertical audit + contract design (T03)` — merge --no-ff, push.

## Красные линии
- НЕ менять код/схему БД в этом задании. НЕ предлагать переименование слагов категорий (159 URL уже в sitemap/индексе).
- Помнить: объявления крепятся к ЛИСТЬЯМ; хабы агрегируют поддерево (fix 5f8fa17) — контракт обязан это учитывать.
