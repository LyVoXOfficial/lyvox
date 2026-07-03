# T02 — URL-allowlist в чат-скраббере

**Модель:** средняя (gpt high / sonnet-класс) — правка безопасности, нужен аккуратный regex + тесты.
**Ветка:** `fix/scrub-url-allowlist` · **Приоритет:** P1 · **Оценка:** 1 час.

## Зачем
`apps/web/src/lib/chat/scrubContacts.ts` маскирует ВСЕ URL (`URL_RE`, строки 33 и 56). Это ломает легитимные технические ссылки в чате (каталог запчастей, спецификации GSMArena и т.п.) — боль агентов B и D краш-теста. IMEI/серийники уже сознательно НЕ маскируются (комментарий на строке 38) — их не трогать.

## Шаги
1. Прочитай ВЕСЬ `scrubContacts.ts` и его тесты (`apps/web/src/lib/chat/__tests__/scrubContacts.test.ts` — найди grep'ом точное имя).
2. Добавь allowlist доменов ПЕРЕД маскированием URL:
```ts
// Technical reference hosts buyers legitimately share; NEVER contact channels.
const ALLOWED_URL_HOSTS = new Set([
  "www.realoem.com", "realoem.com",
  "www.gsmarena.com", "gsmarena.com",
  "www.car-pass.be", "car-pass.be",
  "autoscout24.be", "www.autoscout24.be",
  "immoweb.be", "www.immoweb.be",
  "wikipedia.org", // + любой *.wikipedia.org — см. шаг 3
]);
```
3. В замене `URL_RE`: распарси хост матча (`new URL(match.startsWith("http") ? match : "https://" + match).hostname`, в try/catch — при ошибке парсинга маскируй как раньше). Если hostname ∈ allowlist ИЛИ оканчивается на `.wikipedia.org` — верни URL без маскировки и НЕ вызывай `mark("url")`. Иначе — прежнее поведение.
4. ВАЖНО: allowlist НЕ должен пропускать мессенджеры/соцсети (wa.me, t.me, facebook.com, instagram) — они контактные каналы, их маскируем как раньше. Добавь тест на это.
5. Добавь тесты: (а) realoem-ссылка проходит нетронутой; (б) wa.me маскируется; (в) битый URL не роняет функцию; (г) существующие тесты не сломаны.

## Проверка
- `pnpm test -- --run apps/web/src/lib/chat` → все зелёные (старые + новые).
- `pnpm typecheck && pnpm lint` → 0 ошибок.
- Коммит: `fix(chat): technical reference URLs pass the scrubber — contact channels still masked`
- Merge --no-ff, push.

## Красные линии
- Телефоны/email/IBAN-маскирование НЕ ослаблять ни на символ.
- Список хостов держать коротким и консервативным — сомневаешься → НЕ добавляй (маскирование безопаснее).
