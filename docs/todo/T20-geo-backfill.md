> [!WARNING]
> **ARCHIVE / SUBORDINATE REFERENCE.** Этот файл сохраняет provenance координат и геоконтракт, но не является активной задачей, backlog, статусом или порядком rollout. Работу активирует и принимает только [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md).

# Геоданные: provenance бельгийского справочника

## Инварианты

- Для этого набора используются только координаты из таблицы ниже. Нельзя дополнять её координатами «по памяти».
- PostGIS point создаётся как `ST_MakePoint(lng, lat)`: долгота всегда первая.
- Неизвестный город оставляет `location_id = null` и не должен ломать публикацию.
- Исходный текст `adverts.location` не перезаписывается.
- RPC `search_adverts` сохраняет фиксированную 13-аргументную сигнатуру.
- `resolve_location_id(text)` остаётся server-only: без EXECUTE для `public`, `anon`, `authenticated`.

## Зафиксированный источник координат

| city         | postcode | region   | lat     | lng    |
| ------------ | -------- | -------- | ------- | ------ |
| Brussel      | 1000     | Brussels | 50.8503 | 4.3517 |
| Antwerpen    | 2000     | Flanders | 51.2194 | 4.4025 |
| Gent         | 9000     | Flanders | 51.0543 | 3.7174 |
| Charleroi    | 6000     | Wallonia | 50.4114 | 4.4446 |
| Liège        | 4000     | Wallonia | 50.6326 | 5.5797 |
| Brugge       | 8000     | Flanders | 51.2093 | 3.2247 |
| Namur        | 5000     | Wallonia | 50.4674 | 4.8720 |
| Leuven       | 3000     | Flanders | 50.8798 | 4.7005 |
| Mechelen     | 2800     | Flanders | 51.0257 | 4.4776 |
| Aalst        | 9300     | Flanders | 50.9378 | 4.0409 |
| Kortrijk     | 8500     | Flanders | 50.8285 | 3.2649 |
| Hasselt      | 3500     | Flanders | 50.9307 | 5.3378 |
| Oostende     | 8400     | Flanders | 51.2154 | 2.9286 |
| Genk         | 3600     | Flanders | 50.9650 | 5.5000 |
| Sint-Niklaas | 9100     | Flanders | 51.1656 | 4.1437 |
| Turnhout     | 2300     | Flanders | 51.3227 | 4.9447 |
| Roeselare    | 8800     | Flanders | 50.9443 | 3.1264 |
| Mons         | 7000     | Wallonia | 50.4542 | 3.9563 |
| Tournai      | 7500     | Wallonia | 50.6071 | 3.3893 |
| Geel         | 2440     | Flanders | 51.1650 | 4.9900 |
| Wavre        | 1300     | Wallonia | 50.7167 | 4.6000 |
| Nivelles     | 1400     | Wallonia | 50.5983 | 4.3286 |

## Технические ссылки

- `supabase/migrations/20260703120000_geo_locations_backfill.sql`
- `apps/web/src/app/api/adverts/[id]/route.ts`
- `apps/web/src/app/api/adverts/[id]/__tests__/geo-resolve-route.test.ts`
