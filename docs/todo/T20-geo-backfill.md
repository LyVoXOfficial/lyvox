# T20 — Гео-бэкфилл: справочник городов + locations.point + привязка объявлений

**Модель:** средняя (gpt high / sonnet-класс). Работа с БД — аккуратно, но всё дано.
**Ветка:** `feat/geo-backfill` · **Приоритет:** перед T05 (разблокирует его) · **Оценка:** 2-3 часа.

## Зачем
T05 (радиус) заблокирован: `locations` пуста (0 строк), все 962 объявления хранят локацию текстом «Город, индекс», `adverts.location_id` = null у всех. PostGIS установлен (проверено). Нужны: справочник бельгийских городов с координатами → строки в `locations` → привязка существующих и НОВЫХ объявлений.

## КРИТИЧЕСКОЕ ПРАВИЛО — источник координат
Используй ТОЛЬКО координаты из таблицы ниже. Выдумывать/вспоминать координаты других городов ЗАПРЕЩЕНО (галлюцинация координат = битый радиус). Города вне списка остаются без location_id — это нормально, радиус их просто не увидит.

| city | postcode | region | lat | lng |
|---|---|---|---|---|
| Brussel | 1000 | Brussels | 50.8503 | 4.3517 |
| Antwerpen | 2000 | Flanders | 51.2194 | 4.4025 |
| Gent | 9000 | Flanders | 51.0543 | 3.7174 |
| Charleroi | 6000 | Wallonia | 50.4114 | 4.4446 |
| Liège | 4000 | Wallonia | 50.6326 | 5.5797 |
| Brugge | 8000 | Flanders | 51.2093 | 3.2247 |
| Namur | 5000 | Wallonia | 50.4674 | 4.8720 |
| Leuven | 3000 | Flanders | 50.8798 | 4.7005 |
| Mechelen | 2800 | Flanders | 51.0257 | 4.4776 |
| Aalst | 9300 | Flanders | 50.9378 | 4.0409 |
| Kortrijk | 8500 | Flanders | 50.8285 | 3.2649 |
| Hasselt | 3500 | Flanders | 50.9307 | 5.3378 |
| Oostende | 8400 | Flanders | 51.2154 | 2.9286 |
| Genk | 3600 | Flanders | 50.9650 | 5.5000 |
| Sint-Niklaas | 9100 | Flanders | 51.1656 | 4.1437 |
| Turnhout | 2300 | Flanders | 51.3227 | 4.9447 |
| Roeselare | 8800 | Flanders | 50.9443 | 3.1264 |
| Mons | 7000 | Wallonia | 50.4542 | 3.9563 |
| Tournai | 7500 | Wallonia | 50.6071 | 3.3893 |
| Geel | 2440 | Flanders | 51.1650 | 4.9900 |
| Wavre | 1300 | Wallonia | 50.7167 | 4.6000 |
| Nivelles | 1400 | Wallonia | 50.5983 | 4.3286 |

## Шаги
1. **Миграция** `supabase/migrations/<timestamp>_geo_locations_backfill.sql` (идемпотентная):
   - `create unique index if not exists locations_city_postcode_key on locations (lower(city), postcode);`
   - INSERT городов из таблицы выше: `insert into locations (country, region, city, postcode, point) values ('BE', ..., st_setsrid(st_makepoint(LNG, LAT), 4326)::geography) on conflict ... do nothing;` — ВНИМАНИЕ: makepoint(lng, lat) — долгота ПЕРВАЯ; перепутаешь — все точки в Сомали.
   - Функция `resolve_location_id(p_location text) returns uuid`: normalize (lower/trim), матч по `lower(city) = lower(split_part(p_location, ',', 1))` (+ опционально сверка индекса, если он есть во второй части); `language sql stable`. REVOKE от public/anon/authenticated, GRANT service_role (урок §4 AGENTS.md).
   - Бэкфилл: `update adverts set location_id = resolve_location_id(location) where location_id is null and location is not null and resolve_location_id(location) is not null;`
2. Применить: `echo Y | supabase db push --include-all --db-url "$SUPABASE_DB_URL"`.
3. **Проверка в БД:** `select count(*), count(location_id) from adverts where status='active';` — ожидание: location_id заполнен у ~955+ из 962 (все 8 seed-городов в справочнике). И smoke радиуса: `select count(*) from search_adverts(location_lat=>50.8503, location_lng=>4.3517, radius_km=>25, page_limit=>100);` — должно вернуть >0 (брюссельские объявления).
4. **Новые объявления:** найди server-роут создания/обновления объявления (grep `from("adverts")` + `insert` в `apps/web/src/app/api/adverts`), после записи location-текста добавь резолв: сервисным клиентом `rpc('resolve_location_id', ...)` → запись `location_id` (если null — оставить null, не падать).
5. Тест: юнит на роут (location резолвится / незнакомый город → null, публикация не падает) по образцу существующих adverts-тестов.
6. В `TODO.md`: сними пометку «заблокировано» со строки T05 (верни формулировку приоритета).

## Проверка
- Полный сьют зелёный; проверки из шага 3 выполнены и вписаны в отчёт.
- Коммит: `feat(geo): Belgian city reference + locations backfill + publish-time resolve (T20)` — merge --no-ff, push.

## Красные линии
- Координаты — только из таблицы. lng/lat не перепутать (шаг 1). Существующий текст `adverts.location` НЕ перезаписывать — только location_id. Сигнатуру search_adverts НЕ трогать.
