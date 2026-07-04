# T11 — Конвейер изображений: 400px WebP превью + стабильные URL

**Модель:** сильная (gpt xhigh / opus-класс). Крупная perf-волна: Storage/API + клиентский upload + SSR-каталог + GDPR/purge + LCP-поведение.
**Ветка:** `feat/image-pipeline` · **Приоритет:** P1 (крупнейший байтовый/LCP выигрыш перед редизайнами) · **Оценка:** 1-2 дня. Первый коммит — эта инструкция, дальше коммиты по слоям.

## Зачем
Сейчас `signMediaUrls()` пере-подписывает bucket paths на каждом ISR/SSR-рендере (`apps/web/src/lib/media/signMediaUrls.ts`, вызовы на `/`, `/c`, `/ad`, `/profile`, API favorites/comparison). Короткоживущий signed URL меняется без изменения картинки, поэтому браузерный/CDN-кэш не работает как продукту нужно. По `docs/strategy/SITE_BLUEPRINT.md` конвейер изображений должен быть сделан до редизайнов: 400px WebP превью, стабильные кэшируемые URL и фикс blanket-lazy.

Supabase Storage Image Transformations по официальной документации доступны на Pro Plan и выше, включаются в Dashboard Storage Settings, а usage считается по origin images (Pro/Team: 100 origin images quota, overage $5/1000). Перед выбором реализации обязательно проверить текущий проект, не только документацию.

## Слои (коммит на слой)
1. **Проверка Supabase transform endpoint.**
   - Не печатать секреты. Использовать `.env/.env.local` только локально.
   - Найти один существующий `media.url` через service-role/DB, создать signed URL с transform `{ width: 400, resize: "contain", format: "webp", quality: 75 }` или проверить `/storage/v1/render/image/...` HEAD/GET.
   - Если endpoint возвращает рабочий 200 WebP и проектный план/квота подтверждены — можно использовать transform-derived preview URL только если URL стабилен между рендерами. Если URL все равно signed/TTL-зависимый, для публичных карточек он не годится.
   - Если endpoint недоступен, план не Pro+, квота/стоимость не подтверждены или URL не стабилен — путь по умолчанию: генерация вариантов при аплоаде.
   - Если проверку нельзя выполнить уверенно — STOP/BLOCKED, не мержить.
2. **Модель данных и URL-helpers.**
   - Добавить миграцию `supabase/migrations/*_media_preview_urls.sql`: `media.preview_url text`, `media.preview_w integer`, `media.preview_h integer`, опционально `media.preview_mime text`; индексы не нужны.
   - Обновить `supabase/types/database.types.ts` только через `pnpm gen:types` после DB push, если доступ к DB есть. Если DB недоступна локально — обновить типы вручную нельзя; STOP/BLOCKED.
   - Добавить helper в `apps/web/src/lib/media/previewUrls.ts`: строит public preview URL из bucket path через `NEXT_PUBLIC_SUPABASE_URL`, пропускает absolute URLs, возвращает `null` при отсутствии `preview_url`.
   - Обновить `apps/web/src/lib/media/signMediaUrls.ts`: для карточек и списков отдавать стабильный `previewUrl` без signed URL, full-size signed URL оставлять для detail/gallery и owner flows. Не ломать legacy absolute URLs.
3. **Upload-time generation (default path).**
   - Расширить `apps/web/src/lib/media/compressImage.ts`: экспортировать генерацию двух файлов из одного исходника: `full` до ~1600px WebP/JPEG fallback и `preview` до ~400px WebP/JPEG fallback. GIF pass-through: full как есть, preview `null` либо JPEG/WebP static only если явно безопасно.
   - Обновить `apps/web/src/components/upload-gallery.tsx`: после `/api/media/sign` для full получать также signed upload для preview. Не загружать preview через клиент в произвольный путь: путь должен быть выдан сервером.
   - Обновить `apps/web/src/app/api/media/sign/route.ts`: возвращать `path` и `previewPath`. Preview path должен быть sibling-путь вроде `<user>/<advert>/previews/<basename>-400.webp` либо отдельный public bucket, если `ad-media` приватный и path-level public невозможен. Не делать bucket public для оригиналов.
   - Обновить `apps/web/src/app/api/media/complete/route.ts`: принимать `previewStoragePath`, `previewWidth`, `previewHeight`, проверять префикс `<user>/<advert>/`, писать `media.preview_url/preview_w/preview_h`, возвращать `previewUrl`.
   - Если Supabase не позволяет публичный path внутри приватного `ad-media`, создать отдельный public bucket `ad-media-preview` миграцией/policy и хранить `preview_url` как bucket-relative path с bucket marker или как full public URL. Оригиналы остаются приватными.
4. **Read path + stable caching.**
   - Home/category/profile/favorites/comparison карточки должны брать `previewUrl` first, full signed URL только fallback для legacy rows без preview.
   - `/ad/[id]`: первое фото галереи может использовать full signed URL, но thumbnails/related cards должны использовать preview. Для OG/JSON-LD full signed URL не должен стать вечным публичным URL; оставить существующую осторожность или использовать preview только если этого достаточно.
   - `apps/web/next.config.ts`: разрешить public preview URL pattern (`/storage/v1/object/public/...` для preview bucket/path) и при необходимости `/storage/v1/render/image/...` только если transform path выбран.
   - Стабильные preview URL должны быть версионированы самим storage path: новая загрузка = новый path. Не добавлять timestamp/cache-buster на рендере.
5. **Blanket-lazy/LCP fix.**
   - `apps/web/src/components/ad-card.tsx`: добавить props `priority?: boolean`, `loading?: "eager" | "lazy"`, `fetchPriority?: "high" | "auto" | "low"` или один `aboveFold?: boolean`.
   - На главной и категорийных листингах первый видимый ряд карточек: `loading="eager"` + `fetchPriority="high"`; остальные `lazy`.
   - `apps/web/src/components/AdvertGallery.tsx`: первое активное фото `/ad` — `loading="eager"` + `fetchPriority="high"`; thumbnails lazy/auto.
6. **Deletion/erasure/purge.**
   - Обновить `apps/web/src/app/api/media/[id]/route.ts`, `apps/web/src/app/api/adverts/[id]/route.ts`, `apps/web/src/lib/account/erasure.ts`, `scripts/seed/purge.mjs`: удалять и `url`, и `preview_url`, пропуская absolute external URLs.
   - GDPR erasure invariant: preview удаляется тем же enumerated-path путем, что оригинал. Не удалять по широкому user-prefix.
   - Обновить `apps/web/src/lib/account/__tests__/erasure.test.ts` и media route tests.
7. **Seed/backfill policy.**
   - Не перезаливать существующие seed-фото массово в этой задаче.
   - Для старых rows без `preview_url` оставить fallback на signed full URL.
   - Если нужен backfill, добавить отдельный dry-run script/spec с оценкой: количество media rows без preview, суммарный размер origin, прогноз Storage/transform cost. Сам backfill не запускать без явного отдельного шага.

## Проверка
- Focused tests: `pnpm test -- --run apps/web/src/lib/media apps/web/src/lib/account apps/web/src/app/api/media`.
- Type/lint gate перед merge: `pnpm typecheck && pnpm test && pnpm lint`.
- Проверить стабильность URL: два последовательных SSR/route вызова для `/` или `/c/...` должны вернуть одинаковый `previewUrl` для одной и той же картинки.
- Проверить LCP attributes в SSR HTML с cache-buster: первый ряд карточек и первое фото `/ad` имеют eager/high, нижние изображения остаются lazy.
- После кодовых изменений: `graphify update .`.

## Красные линии
- Не делать оригиналы публичными и не переводить весь `ad-media` в public, если там лежат full-size фото.
- Не хранить signed preview URL в БД: signed URL нестабилен и TTL-зависим.
- Не ломать legacy rows: отсутствие `preview_url` не должно скрывать фото.
- Не менять seed-витрину массовым reupload/backfill без отдельной оценки объема и явного разрешения.
- Не печатать `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` или signed URLs в логах/ответах.
- Не мержить, если не подтвержден выбранный путь Supabase transform vs upload-time variants.
