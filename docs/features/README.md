# LyVoX — Документация фич (Feature Specs)

Дата старта: 2026-06-27 · Язык: русский (поля данных/API/i18n — английский) · Шаблон: [`_TEMPLATE.md`](./_TEMPLATE.md)

Цель набора: по **каждой** фиче — отдельный детальный PRD «что это и как именно должно работать», до мелочей, на уровне зрелого бизнеса. Каждый документ самодостаточен и следует единому шаблону. Этот файл — оглавление и порядок выпуска.

**Легенда статуса:** ✅ ГОТОВО (as-built) · 🟡 ЧАСТИЧНО · ⛔ НЕ НАЧАТО
**Приоритет:** P0 (без этого нет бизнеса) · P1 (важно к запуску) · P2 (улучшение/бонус)

---

## Порядок выпуска документов
1. **Свайп-система Discover** (по запросу — первой). → `01-discover-swipe-system.md`
2. **Критический блок «чего не хватает»** (escrow → споры → доставка → оплата → право → комплаенс).
3. **Блок «что уже есть»** (полные as-built спеки).
4. **Блок «бонусы»**.
5. Финальная сверка индекса и зависимостей.

---

## A. Discover / Свайпы
| # | Фича | Статус | Приоритет | Документ |
|---|---|---|---|---|
| 01 | Свайп-система Discover (визуал + жесты + настройки) | 🟡 | P1 | [`01-discover-swipe-system.md`](./01-discover-swipe-system.md) |

## B. Чего категорически не хватает (критическое)
| # | Фича | Статус | Приоритет | Документ |
|---|---|---|---|---|
| 10 | Safe-deal / Escrow (Stripe Connect) | ⛔ | P0 | `10-escrow-safe-deal.md` |
| 11 | Dispute-движок (споры по сделкам) | ⛔ | P0 | `11-disputes.md` |
| 12 | Интегрированная доставка (Bpost/Mondial Relay, PUDO/локеры) | ⛔ | P0 | `12-shipping-integration.md` |
| 13 | In-chat оплата Bancontact (betaalverzoek) | ⛔ | P0 | `13-inchat-payment-bancontact.md` |
| 14 | Право потребителя / C2C-vs-трейдер (14 дней, гарантии) | ⛔ | P0 | `14-consumer-trader-rights.md` |
| 15 | Комплаенс-гейты: Recupel/WEEE + DAC7 | 🟡 | P0 | `15-recupel-dac7-compliance.md` |
| 16 | Защита от угона аккаунта (ATO, device fingerprint, гео) | 🟡 | P1 | `16-account-takeover-protection.md` |
| 17 | Проверка фото (reverse-image, хеш, краденые фото) | ⛔ | P1 | `17-image-verification.md` |
| 18 | PWA + push-уведомления | ⛔ | P1 | `18-pwa-push.md` |

## C. Что уже есть (полные as-built спеки)
| # | Фича | Статус | Приоритет | Документ |
|---|---|---|---|---|
| 30 | Идентичность и аккаунт (email/OTP/WebAuthn/TOTP/itsme/KYC) | 🟡 | P0 | `30-identity-account.md` |
| 31 | Создание объявления (8-шаговый мастер, медиа, категории) | ✅ | P0 | `31-listing-creation.md` |
| 32 | Категорийные каталоги (транспорт/недвиж/работа/электроника) | ✅ | P1 | `32-category-catalogs.md` |
| 33 | Поиск, фильтры, сортировки (FTS, гео) | ✅ | P0 | `33-search.md` |
| 34 | Дискавери-дополнения (saved-searches, рекомендации, сравнение, похожие, недавнее) | 🟡 | P1 | `34-discovery-extras.md` |
| 35 | Чат + чат-антифрод (scrubContacts) | ✅ | P0 | `35-chat-antifraud.md` |
| 36 | Уведомления (in-app, email, preferences) | 🟡 | P1 | `36-notifications.md` |
| 37 | Доверие: trust score + бейджи + отзывы | 🟡 | P0 | `37-trust-reviews.md` |
| 38 | Модерация и жалобы (AI-moderation, fraud-rules, очереди) | 🟡 | P0 | `38-moderation-reports.md` |
| 39 | Монетизация (Stripe billing, бусты, benefits, Pro) | 🟡 | P1 | `39-monetization-billing.md` |
| 40 | Бизнес-аккаунты (KBO/CBE/VIES, команда, Pro-онбординг) | 🟡 | P1 | `40-business-accounts.md` |
| 41 | Комплаенс-флоу (GDPR export/delete/consent, юр-страницы, cookies) | ✅ | P0 | `41-gdpr-legal.md` |
| 42 | i18n и локализация (NL/FR/EN/DE/RU, SEO/hreflang) | ✅ | P1 | `42-i18n-localization.md` |

## D. Приятные бонусы
| # | Фича | Статус | Приоритет | Документ |
|---|---|---|---|---|
| 50 | AI-листинг по фото (заголовок/цена/категория) | ⛔ | P2 | `50-ai-listing-from-photo.md` |
| 51 | Обратные объявления «Ищу» (wishlist-спрос) | ⛔ | P2 | `51-wanted-reverse-listings.md` |
| 52 | AI справедливая цена + флаг bait-листингов | ⛔ | P2 | `52-ai-fair-price.md` |
| 53 | AI «это скам?» — проверка чата/ссылок | ⛔ | P2 | `53-ai-scam-check.md` |
| 54 | Безопасные точки встречи + QR/NFC подтверждение | ⛔ | P2 | `54-safe-meetup-points.md` |
| 55 | Реферальная программа / инвайты | ⛔ | P2 | `55-referrals.md` |
| 56 | Price-drop алерты на избранном | ⛔ | P2 | `56-price-drop-alerts.md` |
| 57 | Шаринг карточек в соцсети/мессенджеры | ⛔ | P2 | `57-social-sharing.md` |
| 58 | Аналитика продавца | ⛔ | P2 | `58-seller-analytics.md` |
| 59 | Circular-economy бейдж (CO₂/«спасено от свалки») | ⛔ | P2 | `59-circular-badge.md` |
| 60 | Геймификация trust-уровня | 🟡 | P2 | `60-trust-gamification.md` |
| 61 | Помощник навигации (one-time onboarding-подсказки) | ⛔ | P2 | [`61-navigation-help-assistant.md`](./61-navigation-help-assistant.md) |
| 62 | Карточки товара по категориям + базы знаний (раскладка/поля/KB/фикс сопоставления) | 🟡 | P1 | [`62-listing-detail-per-category.md`](./62-listing-detail-per-category.md) |

## E. Аудит live-сайта (UX/SEO/Security/Mobile)
Полный аудит продакшена + кода: [`audit/README.md`](./audit/README.md) — приоритезированный список фиксов (P0/P1/P2) перед отдачей в разработку, плюс детальные разделы по UX/психологии, SEO и безопасности/мобайл.

---

## Как пользоваться
- Каждый документ — самостоятельный PRD по [`_TEMPLATE.md`](./_TEMPLATE.md).
- Зависимости указаны в шапке каждого PRD (например, «Споры» зависят от «Escrow»).
- Источник продуктовой правды верхнего уровня: [`../PROJECT_VISION_AND_TZ.md`](../PROJECT_VISION_AND_TZ.md) и [`../COMPETITIVE_STRATEGY.md`](../COMPETITIVE_STRATEGY.md).
- Статусы здесь — снимок на дату; при реализации обновляем и таблицу, и шапку PRD.
