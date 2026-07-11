# LyVoX Production Design Contract

Дата: 2026-07-10
Статус: канонический дизайн-контракт, подчинённый [MASTER_PRODUCTION_TZ.md](MASTER_PRODUCTION_TZ.md)

Этот документ заменяет прежнее направление «gradient trust / premium glass / hero mesh» и любые указания копировать AI-мокап pixel-by-pixel. При конфликте старые mockups, build notes и UI guides считаются историческими.

## 1. Design Read

Сохраняющий редизайн бельгийского trust-first marketplace для обычных покупателей, продавцов и малого бизнеса. Язык продукта спокойный, конкретный и европейский. Существующие Tailwind, Radix, Onest, semantic tokens и рабочие продуктовые flows сохраняются. Главный визуальный материал: реальные товары и полезные данные, а не декоративный брендовый театр.

| Поверхность        | Variance | Motion | Density |
| ------------------ | -------: | -----: | ------: |
| Public / marketing |        4 |      3 |       4 |
| Product flows      |        3 |      2 |       6 |
| Admin / operations |        2 |      1 |       8 |

Variance показывает допустимое разнообразие композиции, motion — интенсивность движения, density — информационную плотность. Эти значения являются ограничителями, а не целью «добавить больше эффектов».

## 2. Визуальная идея

LyVoX должен выглядеть как сервис, который:

- уважает время пользователя;
- не прячет условия и ограничения;
- показывает реальные объявления раньше брендового рассказа;
- объясняет, что именно проверено;
- одинаково убедителен на NL, FR, EN, DE и RU;
- сохраняет спокойствие в ошибках, спорах и модерации.

Характер бренда строится через ясность, локальность, аккуратную типографику, реальные фотографии и последовательную trust-грамматику. Слова «premium», «AI-powered» и «verified» сами по себе не являются дизайном.

## 3. Референсы, не шаблоны

Актуальный срез на 2026-07-10:

- https://www.2dehands.be/ — поиск, категории, локальность и размещение объявления выше брендового storytelling;
- https://www.vinted.be/ — быстрый переход от компактного seller CTA к реальным товарам, цене и состоянию;
- https://www.backmarket.be/fr-be — доверие через проверяемые данные: состояние, отзывы, гарантия, возврат и история цены.

LyVoX берёт product-first и evidence-first принципы, но не копирует сетку, цвета, компоненты или тексты конкурентов.

## 4. Anti-AI запреты

На public и product surfaces запрещены:

- radial hero mesh, светящиеся blobs и декоративные aurora-фоны;
- gradient headline и gradient CTA;
- три одинаковые feature cards как универсальный способ объяснить продукт;
- glassmorphism и blur на обычных content surfaces;
- постоянные uppercase eyebrow labels;
- fake metrics, fake screenshots, fake testimonials и недоказанный social proof;
- одинаковые большие радиусы у всех контейнеров;
- pills для обычных кнопок, полей и контейнеров;
- декоративные dots, badges и status lights без данных;
- hover-lift/zoom на каждом card;
- «красивый» gradient placeholder вместо честного no-photo;
- маркетинговый текст внутри task-focused flows;
- несколько равноценных primary CTA на одном экране;
- декоративные em/en dash в видимом UI-тексте;
- pixel-by-pixel перенос сгенерированного макета;
- несуществующие trust, identity, dispute, delivery или payment обещания.

Градиент разрешён только в настоящем logo mark либо в одном редком identity-completion moment. Это исключение, не utility для всего интерфейса.

## 5. Foundations

### 5.1 Typography

- Onest является единственным UI/display font и обязан содержать glyphs всех пяти локалей.
- Mono используется только для ID, KBO/VAT, timestamps, hashes и технических значений.
- Основные веса: 400, 500, 600, изредка 700. `extrabold` не используется как default heading.
- Отрицательный letter-spacing удаляется из обычного UI. Uppercase допустим для короткого системного code/status, но не для section labels.
- Длина prose: 55-75 символов; формы и таблицы не растягиваются на весь wide viewport.
- Цифры цены и метрик используют tabular numerals.

### 5.2 Colour

- Один teal primary для primary action, focus и links.
- Amber только для предупреждения или прозрачного paid/boost context.
- Red только destructive/error, green только confirmed success.
- Purple/sky/rose/rainbow action palettes запрещены.
- Trust level различается текстом и icon, не только цветом.
- Все значения идут через semantic tokens; hardcoded brand colours в feature components запрещены.

### 5.3 Radius

| Token            |  Размер | Использование                    |
| ---------------- | ------: | -------------------------------- |
| `radius-control` |   8-9px | Inputs, buttons, small controls  |
| `radius-card`    | 12-13px | Listing cards, panels            |
| `radius-shell`   | 18-20px | Dialog, drawer, large shell      |
| `radius-pill`    |   999px | Только chip, compact tab, status |

Listing card не получает shell-radius. Вложенные cards должны быть обоснованы и обычно заменяются spacing/divider.

### 5.4 Elevation

- Обычные grid/list/card поверхности: border или spacing, без постоянной тени.
- Soft shadow допустим у sticky header, popover, dialog, drawer и floating action.
- Hover не меняет layout. Допустимое изменение: border/foreground или лёгкая тень.
- `backdrop-blur` применяется только там, где контент реально проходит под sticky overlay.

### 5.5 Spacing и layout

- Основная шкала: 4, 8, 12, 16, 24, 32, 48, 64.
- Произвольные pixel values требуют объяснения в component contract.
- Public max-width и gutters едины на home/search/category/detail.
- Product flow использует task-width, sticky actions и ясное progress state.
- Admin использует отдельный dense shell, а не public header/hero/footer.
- Mobile строится как самостоятельная композиция, а не сжатый desktop.

### 5.6 Imagery

- Реальные фотографии объявлений задают цвет и ритм каталога.
- No-photo: нейтральный background, category icon и локализованный текст.
- Нельзя генерировать товар, которого пользователь не загрузил.
- Crop не скрывает дефекты/состояние; detail сохраняет доступ к полному изображению.
- Image error и slow loading имеют отдельные состояния.

### 5.7 Icons

- Lucide является основной UI icon family.
- OAuth/service logos могут использовать официальный asset или `react-icons`.
- Inline SVG разрешён только для уникального LyVoX mark или официального provider logo.
- Icon-only action имеет accessible name, tooltip при необходимости и touch target.

## 6. Trust grammar

### 6.1 Разрешённые формулировки

Используется самый конкретный доказанный статус:

- Contact confirmed;
- Email confirmed;
- Phone confirmed;
- Identity checked;
- Business checked;
- Payment protected;
- Paid placement.

Общий label `Verified` без уточнения запрещён.

### 6.2 Правила

- На listing card максимум один trust/status label.
- Detail page объясняет, что проверено, кем, когда и чего проверка не гарантирует.
- Private seller не является trust badge и не получает декоративную green dot.
- Identity/business labels рендерятся только из effective capability и фактического user evidence.
- Paid placement визуально отделён и не маскируется под органический trust.
- Trust score должен быть объясним, а не выглядеть как банковский рейтинг без основания.

## 7. Контракты поверхностей

### 7.1 Home

Обязательный порядок:

1. короткое value proposition без superlative;
2. один главный search;
3. реальные SSR listings;
4. понятная category navigation;
5. один seller CTA;
6. краткое evidence-based safety explanation.

До появления доказанной ценности удаляются или скрываются Top Sellers, Top Advert, carousel stack и три равные trust cards. Hero не должен занимать первый экран декоративным фоном.

### 7.2 Listing card

- Фото, цена, название, location/condition и один status составляют hierarchy.
- Primary click area семантически является link.
- Favourite/report доступны keyboard и touch, не только hover.
- Hover lift и image zoom не являются default.
- Price `0`, free и price-on-request различаются явно.
- Sponsored/reserved/sold/removed имеют отдельные честные states.

### 7.3 Search и category

- Результаты важнее декоративного header card.
- Filters на mobile имеют draft/apply/reset и видимое число активных фильтров.
- Broadening search объясняется текстом, не цветной карточкой.
- Empty state предлагает действие на основе запроса, без fake scarcity.
- Pagination/end state не меняет layout скачком.

### 7.4 Advert detail

- Цена, title, location, condition и contact action доступны без hunting.
- Safety/trust facts отделены от seller claims.
- Category specs используют стабильную tab/section структуру.
- Sticky mobile contact bar учитывает safe area и не перекрывает content.
- Error/not-found/removed/sold states локализованы и дают безопасный next action.

### 7.5 Auth

- Login/register имеют один визуальный язык.
- Split-screen marketing panel необязателен и скрывается, если не несёт проверяемой пользы.
- Никаких трёх feature cards и статических identity promises.
- Captcha, magic link, OAuth, rate limit, offline и expired states проектируются явно.

### 7.6 Post flow

- Один основной action на шаг.
- Category choice использует button/radio semantics, не clickable `div`.
- Saving/saved/failed/conflict status видим.
- Upload показывает progress, retry, remove и validation.
- Field limit в UI совпадает с schema/HTML limit.
- Capability-unavailable не теряет draft.

### 7.7 Chat

- Conversation и composer главнее decorative avatars/gradients.
- Pending/failed/retry/reconnecting/session-expired states различимы.
- Scam warning конкретен и не блокирует без объяснения.
- Block/report имеет confirmation и recovery guidance.
- Message bubble colour не снижает contrast в dark mode.

### 7.8 Admin

- Отдельный shell: navigation, context header, dense queue/table, details drawer.
- Public marketplace header/footer и marketing CTA не используются.
- Loading: table/row skeleton, не spinner-only page.
- Bulk action поддерживает partial failure и per-item result.
- AI score является одним сигналом, не финальным решением.
- Destructive action требует reason и audit record.
- Capability screen следует [CAPABILITY_ACTIVATION_MATRIX.md](production/CAPABILITY_ACTIVATION_MATRIX.md).

## 8. Обязательные состояния

| Область      | Состояния                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Listing card | image, no-image, image-error; free, price, request-price; long title; missing location; all trust/status variants  |
| Search       | skeleton, exact, broadened, zero, API error/retry, offline, zero-count filter, pagination end                      |
| Post         | draft, saving, saved, save-failed, conflict, invalid field, upload progress/error/retry, moderation statuses       |
| Auth         | default, autofill, error, captcha loading/failure, rate limit, OAuth unavailable, magic-link sent/expired, offline |
| Chat         | empty, reconnecting, history error, send pending/failed/retry, blocked/reported, session expired                   |
| Admin        | skeleton, empty, stale, provider/AI degraded, pending action, conflict, partial bulk failure, success, audit       |
| Capability   | admin off, missing config, legal block, release block, provider outage, ready, enabled, emergency off              |

Skeleton повторяет финальную геометрию. Spinner используется только внутри короткого action.

## 9. Motion

- Duration: 120-220ms.
- Анимируются только transform и opacity, кроме обоснованного progress.
- Motion сообщает feedback/state transition; не «оживляет» статичную страницу.
- Public может использовать один restrained entrance sequence.
- Product ограничивается feedback, expand/collapse и navigation continuity.
- Admin почти статичен.
- `prefers-reduced-motion` убирает pulse, lift, zoom, auto-scroll и decorative entrance.
- Никакая информация не доступна только через animation.

## 10. Dark mode

Dark mode обязателен как законченная система:

- system default + persisted user choice;
- SSR initialization без flash;
- semantic tokens для surfaces, borders, focus и status;
- никаких hardcoded white header/nav/card;
- изображения и logos не получают destructive filters;
- visual/a11y smoke выполняется в обеих темах.

До готового theme mechanism нельзя считать наличие блока `.dark` поддержкой dark mode.

## 11. Accessibility, responsive, i18n

- WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text/UI.
- Axe: 0 critical и 0 serious на release surfaces.
- Touch target не меньше 44x44px, кроме обычной inline text link.
- Keyboard-only покрывает все действия; focus всегда видим.
- Dialog: focus trap, initial focus, Esc и focus return.
- Нет horizontal scroll при 320px; 400% zoom не теряет действия/информацию.
- RTL не входит в текущий scope, но layout не зависит от длины English.
- Fixtures включают длинный NL/DE, French accents и Cyrillic.
- Нет raw i18n key, English leak и обрезанного CTA во всех пяти локалях.
- Critical action не зависит только от hover, swipe, drag или цвета.

## 12. Visual quality gate

### Маршруты

`/`, `/search`, fixture `/ad`, `/sell`, `/login`, `/register`, `/post`, `/chat`, `/profile`, `/admin/moderation`, `/admin/reports`, `/admin/settings`.

### Viewports

- 390x844;
- 768x1024;
- 1440x900;
- отдельный reflow 320px и 400% zoom.

### Доказательства

- deterministic data fixtures;
- light/dark screenshots;
- five-locale smoke для home/search/detail/auth/admin;
- visual diff <= 0.5% primitives и <= 1% pages после маскирования только времени/динамических изображений;
- axe, keyboard и reduced-motion tests;
- p75 mobile: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

Visual snapshot не заменяет functional assertion.

## 13. Порядок внедрения

1. Tokens, typography, radius, elevation, theme mechanism.
2. Button/input/card/badge/dialog/table primitives.
3. Trust grammar и capability-aware copy.
4. Header, home, listing card, no-photo.
5. Search/category/detail.
6. Login/register/post/chat/profile.
7. Admin shell, queues, settings и audit.
8. Visual, axe, responsive, locale и CWV harness.

Каждый слой мигрирует завершённую вертикаль. Нельзя одновременно «редизайнить всё» без baseline screenshots и route-by-route acceptance.

## 14. Definition of done

- [ ] Старые universal gradient/mesh/glass utilities не используются продуктом.
- [ ] Home product-first и не состоит из повторяющихся promotional sections.
- [ ] Trust copy конкретен и привязан к реальным данным/capability.
- [ ] Public, product и admin выглядят как одна семья с разной плотностью.
- [ ] Light/dark, mobile/desktop и пять локалей проверены.
- [ ] Все обязательные states существуют.
- [ ] Accessibility и visual gates зелёные в CI.
- [ ] Новая страница не добавляет anti-AI pattern из раздела 4.
- [ ] Независимый design verifier проверил screenshots, а не только JSX/CSS diff.
