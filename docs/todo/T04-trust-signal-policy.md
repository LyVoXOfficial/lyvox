# T04 — TrustSignalPolicy: единый конфиг trust-сигналов

**Модель:** средняя (gpt high / sonnet-класс).
**Ветка:** `feat/trust-signal-policy` · **Приоритет:** P1 · **Оценка:** 2 часа.

## Зачем
Trust-правила размазаны: cap-3 бейджей в `apps/web/src/lib/profile/sellerBadges.ts`, 1 чип на карточку в ad-card, запрещённые формулировки — только в доках (SITE_BLUEPRINT «красные линии»). Кодифицируем в один конфиг, чтобы код физически не мог нарисовать запрещённое (краш-тест, агент E).

## Шаги
1. Создай `apps/web/src/lib/trust/signalPolicy.ts`:
```ts
// Single source of truth for every trust-flavoured signal on the site.
// A signal not registered here MUST NOT be rendered as a badge/counter.
export type TrustSignalKey =
  | "verified_email" | "verified_phone" | "verified_business"
  | "vat_registered" | "generated_translation" | "promoted" | "car_pass" | "epc";

export const TRUST_SIGNAL_POLICY: Record<TrustSignalKey, {
  i18nKey: string;            // label key, exists in all 5 locales
  explanationI18nKey: string; // "what was checked" key
  minThreshold?: number;      // counters only: hide below this
}> = { /* заполни по факту существующих бейджей — grep их i18n-ключи */ };

// Wording that must never appear in any trust-flavoured UI copy (F3 + UCPD).
export const BANNED_TRUST_WORDING = [
  "guaranteed", "safe payment", "buyer protection", "escrow", "verified purchase",
  "безопасная оплата", "защита покупателя", "гарантия возврата",
  "veilige betaling", "kopersbescherming", "paiement sécurisé", "protection acheteur",
  "sicherer Kauf", "Käuferschutz",
];
```
2. Заполни policy по РЕАЛЬНЫМ существующим сигналам (grep: `verified_seller`, `document_badge`, `BenefitsBadge`, `TraderPanel`) — их i18n-ключи уже есть, новые НЕ выдумывай.
3. Напиши guard-тест `apps/web/src/lib/trust/__tests__/signalPolicy.test.ts`:
   - каждый `i18nKey`/`explanationI18nKey` существует во всех 5 локалях (загрузи JSON'ы как в существующем parity-тесте — найди его grep'ом `locales` в `__tests__`);
   - НИ ОДНА строка ни одной локали не содержит фраз из `BANNED_TRUST_WORDING` (case-insensitive). Если тест упал на легитимной строке (например, юр-страница объясняет, что escrow НЕТ) — добавь точечный allowlist-ключ в тест с комментарием, а не ослабляй проверку.
4. Подключи policy минимум в одном месте (без визуальных изменений): `sellerBadges.ts` импортирует ключи из policy вместо локальных литералов.

## Проверка
- `pnpm test -- --run apps/web/src/lib/trust` зелёный; полный сьют через хук.
- Коммит: `feat(trust): TrustSignalPolicy config + banned-wording guard test (T04)` — merge --no-ff, push.

## Красные линии
- Никаких НОВЫХ бейджей/сигналов — только кодификация существующих.
- Guard-тест не должен ложно падать на словах в НЕ-trust контексте юридических страниц — allowlist точечный, с комментарием почему.
