# T19 — Дрейф ключей specifics: читатели терпимы к вариантам записи

**Модель:** средняя (gpt high / sonnet-класс).
**Ветка:** `fix/specifics-key-drift` · **Приоритет:** внеочередной (после T05, перед T06) · **Оценка:** 1-2 часа.

## Зачем
Находка №5 аудита T03 (`docs/strategy/CATEGORY_VERTICAL_AUDIT.md`, «Main Findings» п.5): читатели и писатели specifics разошлись по именам ключей, из-за чего часть чипов/бейджей на карточке объявления МОЛЧА не показывается:
- `DocumentBadges.tsx` читает `safety_certified`, а живая baby-схема хранит `catalog_field_baby_safety_certified` → бейдж «Safety certified» не загорается никогда, хотя данные в БД есть (единственная активная схема — детские товары).
- Форма пишет `property_type_id` / `job_category_id` / `contract_type_id`, чипы читают `property_type` / `job_category` / `contract_type`.

## Скоуп — ТОЛЬКО читатели (writer-сторона = Волна C аудита, НЕ трогать)
Сериализацию prepareSpecifics НЕ менять. Меняем два компонента-читателя, делая их терпимыми к вариантам ключей.

## Шаги
1. Прочитай `apps/web/src/components/ad/KeySpecsStrip.tsx` (там уже есть helper `specValue(specifics, ...keys)` — принимает НЕСКОЛЬКО ключей-кандидатов) и `apps/web/src/components/ad/DocumentBadges.tsx`.
2. `DocumentBadges.tsx`, ветка baby_kids: проверку `specifics.safety_certified` расширь до `specifics.safety_certified ?? specifics.catalog_field_baby_safety_certified` (через существующий isTruthy). Аналогично проверь vehicle/real_estate/pets ветки на префиксные варианты `catalog_field_*` — добавь фолбэки ТОЛЬКО для ключей, которые реально встречаются (сверь со списком из аудита: 9 живых baby-полей; для остальных доменов живых полей нет — не выдумывай).
3. `KeySpecsStrip.tsx`: в вызовы `specValue` добавь кандидатов: `property_type_id` (real estate), `job_category_id`, `contract_type_id` (jobs), `catalog_field_baby_*`-варианты для baby-полей, если они там читаются. ВАЖНО: `*_id`-ключи могут содержать uuid/код вместо человекочитаемого значения — если значение похоже на uuid (regex `^[0-9a-f]{8}-`), НЕ показывать его в чипе (лучше ничего, чем uuid).
4. Юнит-тесты на оба компонента (первые для них): рендер с каноническим ключом, с альтернативным, с uuid-значением (не рендерится), пусто (null). Смотри паттерн тестов компонентов в `apps/web/src/components/**/__tests__/` (найди grep'ом существующий пример; если компонентных тестов нет — тестируй экспортированную логику, вынеся выбор значения в чистую функцию `resolveSpecValue` в том же файле).
5. Локальная проверка: `curl -s "http://localhost:3000/ad/<id детского объявления>?x=$RANDOM"` — бейдж safety появился в SSR-HTML (найди id: psql `select a.id from adverts a join categories c on c.id=a.category_id where c.path like 'dlya-doma-hobbi-i-detey/detskie-tovary%' and a.status='active' limit 3;` — пробуй пока не найдёшь объявление с safety_certified=true).

## Проверка
- `pnpm typecheck && pnpm test && pnpm lint` зелёные (полный сьют в хуке).
- Коммит: `fix(ad): key-spec chips and badges tolerate live specifics key variants (T19)` — merge --no-ff, push.
- Прод: тот же curl-чек на www.lyvox.be после деплоя (~2 мин).

## Красные линии
- prepareSpecifics / формы / API / схему БД НЕ трогать — только два компонента-читателя + тесты.
- Никаких новых i18n-ключей (используются существующие лейблы бейджей).
- uuid в чипах не показывать.
