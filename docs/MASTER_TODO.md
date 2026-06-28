# LyVoX — MASTER TODO / ТЗ (единый источник правды)

Дата: 2026-06-28 · Это **единственный** рабочий бэклог. Старые TODO/план/roadmap-файлы — устарели (см. §6). Каждый пункт ведёт к **детальному отчёту** (PRD/аудит) — спека до мелочей уже написана; цель следующего этапа — довести каждый PRD многоролевым ревью до состояния «ни один специалист не докопается».

## Как читать
- **Приоритет:** `P0` (без этого нет бизнеса/комплаенса) · `P1` (важно к запуску) · `P2` (улучшение/бонус).
- **Статус:** ✅ готово · 🟡 частично · ⛔ не начато.
- **Дисциплины (кто ревьюит/делает):** `DEV` разработка · `LEGAL` юрист · `UX` дизайн/психология · `SEO` · `SEC` безопасность · `DATA` · `PROD` продукт · `CONTENT` копирайт/i18n.
- **Отчёт:** ссылка на детальный документ (PRD или раздел аудита) — это и есть «детальный отчёт по пункту».

## Рекомендуемый порядок (фазы)
1. **A. Дизайн/раскладка/функционал** (текущий фокус) — UX-фиксы из аудита + карточки по категориям + свайпы.
2. **B. Транзакционное ядро доверия** — escrow → споры → доставка → оплата → право/комплаенс.
3. **C. Идентичность и анти-фрод** — itsme, trust-score, модерация, ATO, фото-верификация.
4. **D. Рост/ретеншен** — saved-search/алерты, PWA/push, бонусы.
5. **E. Pre-launch hardening (последним)** — SEO + Security (по решению пользователя отложено).

---

## 1. Транзакционное ядро доверия (B)
| ID | Задача | Приор. | Статус | Дисциплины | Отчёт | Зависит от |
|---|---|---|---|---|---|---|
| 10 | Escrow / safe-deal (Stripe Connect) | P0 | ⛔ | DEV, LEGAL, SEC, PROD | [features/10](features/10-escrow-safe-deal.md) | 11,12,13,14,30 |
| 11 | Dispute-движок (споры) | P0 | ⛔ | DEV, LEGAL, UX, PROD | [features/11](features/11-disputes.md) | 10,12 |
| 12 | Интегрированная доставка (Bpost/PUDO) | P0 | ⛔ | DEV, PROD | [features/12](features/12-shipping-integration.md) | 10 |
| 13 | In-chat оплата Bancontact | P0 | ⛔ | DEV, LEGAL, SEC | [features/13](features/13-inchat-payment-bancontact.md) | 10,35 |
| 14 | Право потребителя / C2C-vs-трейдер | P0 | ⛔ | LEGAL, DEV, PROD | [features/14](features/14-consumer-trader-rights.md) | 40,10 |
| 15 | Recupel/WEEE + DAC7 гейты | P0 | 🟡 | LEGAL, DEV | [features/15](features/15-recupel-dac7-compliance.md) | 40,31 |

## 2. Идентичность и анти-фрод (C)
| ID | Задача | Приор. | Статус | Дисциплины | Отчёт | Зависит от |
|---|---|---|---|---|---|---|
| 30 | Идентичность/аккаунт (itsme, KYC, passkeys) | P0 | 🟡 | DEV, SEC, LEGAL | [features/30](features/30-identity-account.md) | — |
| 37 | Trust score + бейджи + отзывы | P0 | 🟡 | DEV, UX, DATA | [features/37](features/37-trust-reviews.md) | 30,10 |
| 38 | Модерация и жалобы (AI+fraud rules) | P0 | 🟡 | DEV, LEGAL, SEC | [features/38](features/38-moderation-reports.md) | 17,35 |
| 16 | Защита от угона аккаунта (ATO) | P1 | 🟡 | SEC, DEV | [features/16](features/16-account-takeover-protection.md) | 30 |
| 17 | Проверка фото (reverse-image/хеш) | P1 | ⛔ | DEV, SEC | [features/17](features/17-image-verification.md) | 38,31 |

## 3. Дизайн / раскладка / функционал (A) — ТЕКУЩИЙ ФОКУС
| ID | Задача | Приор. | Статус | Дисциплины | Отчёт | Зависит от |
|---|---|---|---|---|---|---|
| 01 | Свайп-система Discover (визуал+жесты+настройки) | P1 | 🟡 | UX, DEV | [features/01](features/01-discover-swipe-system.md) | 33,37 |
| 62 | Карточки товара по категориям + базы знаний (раскладка/поля/KB/фикс сопоставления) | P1 | 🟡 | UX, DEV, DATA, CONTENT | [features/62](features/62-listing-detail-per-category.md) | 32,31 |
| 31 | Создание объявления (8-шаг, медиа) | P0 | ✅ | UX, DEV | [features/31](features/31-listing-creation.md) | 32,38 |
| 32 | Категорийные каталоги | P1 | ✅ | DEV, DATA, CONTENT | [features/32](features/32-category-catalogs.md) | — |
| 33 | Поиск/фильтры/сортировки | P0 | ✅ | DEV, UX | [features/33](features/33-search.md) | 32 |
| 34 | Дискавери-дополнения (saved-search/рек./сравнение) | P1 | 🟡 | DEV, UX | [features/34](features/34-discovery-extras.md) | 33,36 |
| UX1 | Редизайн-фиксы страниц (home/discover/search/ad/post/profile) | P1 | ⛔ | UX, DEV | [audit/01](features/audit/01-ux-psychology-audit.md) · [макеты](features/audit/mockups/redesign-mockups.html) | — |
| UX2 | Мобильная раскладка (bottom-nav высоты, contact-bar, тач-таргеты) | P1 | ⛔ | UX, DEV | [audit/03](features/audit/03-security-mobile-audit.md) | — |

## 4. Коммуникация / рост / ретеншен (D)
| ID | Задача | Приор. | Статус | Дисциплины | Отчёт | Зависит от |
|---|---|---|---|---|---|---|
| 35 | Чат + чат-антифрод (scrubContacts) | P0 | ✅ | DEV, SEC | [features/35](features/35-chat-antifraud.md) | 30 |
| 36 | Уведомления (in-app/email, preferences) | P1 | 🟡 | DEV, CONTENT | [features/36](features/36-notifications.md) | 18,34 |
| 18 | PWA + push | P1 | ⛔ | DEV, UX | [features/18](features/18-pwa-push.md) | 36 |
| 61 | Помощник навигации (one-time onboarding) | P2 | ⛔ | UX, DEV | [features/61](features/61-navigation-help-assistant.md) | 42,01 |

## 5. Монетизация / бизнес / комплаенс-платформа
| ID | Задача | Приор. | Статус | Дисциплины | Отчёт | Зависит от |
|---|---|---|---|---|---|---|
| 39 | Монетизация (Stripe billing, бусты, Pro) | P1 | 🟡 | DEV, LEGAL | [features/39](features/39-monetization-billing.md) | 33,40 |
| 40 | Бизнес-аккаунты (KBO/CBE/VIES, команда) | P1 | 🟡 | DEV, LEGAL | [features/40](features/40-business-accounts.md) | 14,15,30 |
| 41 | GDPR/юр-страницы/cookies | P0 | 🟡 | LEGAL, DEV | [features/41](features/41-gdpr-legal.md) | 35 | _(статус понижен ✅→🟡 по LEGAL: механики есть, но нет RoPA/DPIA/реестра DPA — F4)_
| 42 | i18n/локализация (NL/FR/EN/DE/RU, hreflang) | P1 | ✅ | CONTENT, DEV, SEO | [features/42](features/42-i18n-localization.md) | 32 |

## 6. Бонусы (P2)
50 AI-листинг по фото · 51 «Ищу»/обратные объявления · 52 AI-цена/bait · 53 AI scam-check · 54 безопасные точки встречи · 55 рефералы · 56 price-drop алерты · 57 шаринг · 58 аналитика продавца · 59 circular-бейдж · 60 геймификация trust. → файлы `features/50…60-*.md`.

## 7. Pre-launch hardening (E) — ОТЛОЖЕНО на потом (решение пользователя)
SEO + Security задокументированы и ждут последним этапом: [audit/02 SEO](features/audit/02-seo-technical-audit.md), [audit/03 Security](features/audit/03-security-mobile-audit.md), сводка [audit/README](features/audit/README.md) (P0-пункты 1–5, P1 11–17).

---

## 8. Матрица многоролевого ревью (заполняется на этапе C — sub-agents)
Цель: каждый PRD проходит ревью профильных специалистов, пока не станет airtight. Статус: ⬜ не начато · 🔄 в ревью · ✅ sign-off.

| Область / PRD | LEGAL | DEV | UX/психолог | SEO | SEC | DATA |
|---|---|---|---|---|---|---|
| Транзакционное ядро (10–15) | 🔄⛔ | 🔄⛔ | 🔄 | — | 🔄⛔ | 🔄 |
| Идентичность/анти-фрод (16,17,30,37,38) | 🔄 | 🔄 | 🔄 | — | 🔄 | 🔄⛔ |
| Дизайн/карточки/свайпы (01,62,UX1,UX2,31) | — | 🔄⛔ | 🔄⛔ | 🔄⛔ | — | 🔄⛔ |
| Рост/комм. (18,34,35,36,61) | 🔄 | 🔄 | 🔄 | 🔄 | 🔄 | — |
| Монетизация/бизнес/комплаенс (39,40,41,42) | 🔄 | 🔄 | 🔄 | 🔄 | 🔄 | 🔄 |

> ⛔ = жёсткий блокер внутри области. Итог всех 6 ролей: **0 чистых ✅**. Синтез и список фундаментов F1–F14 → [reviews/README.md](features/reviews/README.md).

Результат каждого ревьюера → отдельный файл `docs/features/reviews/<role>-<area>.md` + правки в соответствующий PRD; матрица переводится в ✅.

**LEGAL-ревью (2026-06-28):** выполнен по 12 PRD с юр-нагрузкой → [reviews/legal-review.md](features/reviews/legal-review.md). Итог: **⛔ блокер — 10 (escrow, PSD2/AML)**; 🔄 правки — 11,13,14,15,30,38,39,40,41,54,59; ✅ с условием — 55. Сквозные блокеры: PSD2-статус не определён; нет RoPA/DPIA/DPA-реестра; DSA-роль/PoC/DSC не назначены.

---

## 9. Устаревшие файлы (свести в этот мастер → удалить/архивировать)
Поглощены этим MASTER + детальными PRD; больше не вести:
- `docs/TODO.md` · `docs/PLAN.md` · `docs/development/roadmap.md` · `docs/development/MASTER_CHECKLIST.md` · `docs/development/checklists.md`
- `docs/UX_AUDIT_AND_ROADMAP.md` · `docs/UX_RESEARCH_PLAN.md` · `docs/auth-improvements-plan.md`
- `docs/catalog/CATALOG_IMPLEMENTATION_STATUS.md` · `docs/catalog/FINAL_COMPLETION_REPORT.md` · `docs/REFACTORING_PROGRESS.md` · `docs/i18n-action-plan.md`

> Удаление файлов — действие пользователя/по подтверждению (см. вопрос в чате). До удаления каждый получает шапку-указатель на этот MASTER, чтобы не путать.

## 10. Артефакты финального ТЗ (готово 2026-06-28)
1. **Многоролевой ревью** — выполнен 6 ролями → [reviews/README.md](features/reviews/README.md) (синтез + 6 отчётов). Итог: 0 чистых ✅; блокеры и фундаменты выявлены.
2. **Требования ревью вписаны в каждый PRD** — во всех 36 PRD добавлен раздел «Ревью-требования и sign-off (2026-06-28)» с вердиктами ✅/🔄/⛔ по дисциплинам.
3. **Фундаменты F1–F14** оформлены тикетами → [features/FOUNDATIONS-F1-F14.md](features/FOUNDATIONS-F1-F14.md).
4. **Escrow legal-gate (F3)** → [features/escrow-legal-gate.md](features/escrow-legal-gate.md) — вопросы к Stripe/юристу/NBB + чек-лист sign-off перед стройкой.

## 11. Что дальше
Закрывать **фундаменты F1–F14** (порядок в их файле): первыми — внешне-долгие F3/F4/F5 (юр-гейт, GDPR-артефакты, DSA-роль), параллельно дешёвые F1/F8/F10, затем под текущий фокус F7/F13/F12/F14 (фикс 1996, вкладки, SEO/structured data, trust). После закрытия фундамента область переводится из 🔄 в ✅ в матрице §8.

## 12. Tech-debt ESLint (2026-06-28)
| Файл | Проблема | Правило | Приоритет |
|---|---|---|---|
| `SearchBar.tsx` | `setRecent(...)` внутри `useEffect` без внешней подписки | `react-hooks/set-state-in-effect` (warn) | P2 |
| `CookieConsentProvider.tsx` | `syncConsent()` внутри `useEffect` | `react-hooks/set-state-in-effect` (warn) | P2 |
| `CookiePreferenceCenter.tsx` | `setFunctional`/`setAnalytics` внутри `useEffect` | `react-hooks/set-state-in-effect` (warn) | P2 |
| `RecentlyViewed.tsx` | `setItems(getRecentlyViewed())` внутри `useEffect` | `react-hooks/set-state-in-effect` (warn) | P2 |

> **Контекст:** правило появилось в `eslint-plugin-react-hooks` v7.0.1. Все четыре паттерна — `useState` для чтения из localStorage при маунте через `useEffect` — технически вызывают лишний ре-рендер, но не ломают работу. Правильное решение: заменить `useEffect + setState` на `useSyncExternalStore` или `useState(() => readFromStorage())` (lazy initializer). Refactor перед следующим бампом плагина.

**`@typescript-eslint/no-explicit-any` (warn) — ~177 мест, P2.** Правило было исторически ВЫКЛЮЧЕНО (плагин `@typescript-eslint` не был зарегистрирован в flat config). При регистрации плагина (2026-06-28) все pre-existing `any` стали видимы. Переведено в `"warn"`, чтобы не блокировать CI. Правильное решение: планомерно заменять `any` на точные типы — в первую очередь в тестах и API-маршрутах. Новый `any` без eslint-disable-комментария с объяснением — запрещён.

## 12b. Прогресс по фундаментам (2026-06-28)
| Тикет | Статус | Коммит |
|---|---|---|
| **F1** webhook_events идемпотентность | ✅ | f2e9cfb |
| F2 server-side авторизация денег | ⛔ не начато | — |
| F3 PSD2/AML legal-gate | ⛔ не начато | — |
| F4 GDPR RoPA/DPIA | ⛔ не начато | — |
| F5 DSA-роль/PoC | ⛔ не начато | — |
| F6 analytics_events sink | ⛔ не начато | — |
| **F7** generation_id + resolveGeneration | ✅ | 53c7b31 |
| **F8** серверный client-IP | ✅ | 7a4de19 |
| **F9** fraud-engine в рантайм | ✅ | TBD |
| **F10** itsme_sub uniqueness | ✅ | 61d73c5 |
| F11 дедуп advert_views | ⛔ не начато | — |
| **F12** JSON-LD генераторы подключить | ✅ | 109ccf4, 2ff3836 |
| **F13** catalog_groups + ARIA-tabs | ✅ | f17df42 |
| F14 trust-score формула | ⛔ не начато | — |
