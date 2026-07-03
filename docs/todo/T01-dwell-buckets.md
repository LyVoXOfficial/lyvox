# T01 — Dwell-бакетирование в свайп-аналитике

**Модель:** дешёвая достаточно (gpt medium / haiku-класс). Механическая правка одного файла.
**Ветка:** `fix/dwell-buckets` · **Приоритет:** P0 (приватность) · **Оценка:** 30 минут.

## Зачем
`apps/web/src/components/discover/SwipeDeck.tsx` шлёт сырое `dwell_ms` (точное время разглядывания карточки, миллисекунды) в `/api/analytics/track`. Отправка уже гейтится согласием (`discoverTrack.ts:40`), но сырое поведенческое время на сервере нарушает наш собственный privacy-стандарт (docs/strategy/BELGIUM_BEHAVIORAL_CRASH_TEST_FABLE5.md, агент A). Огрубляем ДО отправки.

## Шаги
1. В `SwipeDeck.tsx` найди ВСЕ места с `dwell_ms:` (их два-три: doLike, doPass, возможно doAction — grep `dwell`).
2. Добавь в этот же файл (рядом с другими хелперами, вне компонента) функцию:
```ts
// Privacy: raw dwell time never leaves the client — only coarse buckets do.
const dwellBucket = (ms: number): "glance" | "short" | "long" | "study" =>
  ms < 1500 ? "glance" : ms < 5000 ? "short" : ms < 15000 ? "long" : "study";
```
3. Замени в props событий `dwell_ms: dwell` на `dwell_bucket: dwellBucket(dwell)`. Само измерение `Date.now()` НЕ трогай.
4. Проверь, нет ли других отправителей `dwell_ms`: `grep -rn "dwell_ms" apps/web/src` — после правки должно остаться 0 вхождений.

## Проверка
- `pnpm typecheck` → 0 ошибок; `pnpm lint` → 0 ошибок.
- `grep -rn "dwell_ms" apps/web/src` → пусто; `grep -rn "dwell_bucket" apps/web/src` → все точки отправки.
- Коммит (хук прогонит полный сьют): `fix(privacy): dwell time leaves client only as coarse buckets`
- Merge в main --no-ff, push. Прод-проверка не нужна (клиентская аналитика).

Трейлер коммита: `Co-Authored-By: Codex <noreply@openai.com>` (или Claude-трейлер, если выполняет Claude).

## Красные линии
- НЕ менять формат других props события (advert_id, direction и т.д.) — по ним уже считается аналитика.
- НЕ убирать consent-гейт в discoverTrack.ts.
