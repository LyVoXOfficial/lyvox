# T17 — /ad: sticky one-primary contact-bar + safety bottom-sheet

**Модель:** 🟡 средняя (gpt high / sonnet-класс).
**Ветка:** `feat/ad-contact-bar` · **Приоритет:** P1 (North Star — успешный контакт) · **Оценка:** 1 день.

## Зачем
SITE_BLUEPRINT волна 3: `/ad/[id]` — страница North Star. Ноль трения между пальцем и кнопкой «Написать»; safety-контент рядом, но не блокирует контакт.

## Что УЖЕ есть
- `apps/web/src/components/AdvertMobileContactBar.tsx` — мобильный contact-bar (изучи текущее состояние: сколько CTA, есть ли layout-shift).
- `apps/web/src/components/AdvertContactPanel.tsx` — панель контакта.
- Страница: `apps/web/src/app/ad/[id]/page.tsx`.
- Мобильные переменные bottom-spacing: `--contact-bar-h`, `--bottom-nav-h` в globals.css (UX2-волна) — ИСПОЛЬЗОВАТЬ, не вводить новые.

## Скоуп
1. **Sticky contact-bar: ОДИН primary «Написать»**, «Предложить цену» (T07 ChatOffer, если уже смержен) — secondary. Появление через transform/opacity (не layout-shift), место зарезервировано padding-bottom с учётом safe-area-inset-bottom (переменные уже есть). Два равных CTA делят клики — primary должен быть один визуально доминирующий.
2. **Safety-контент — необязательный bottom-sheet** (не блокирующий интерстишл): одна строка микрокопи под кнопкой («Чат внутри LyVoX — контакты защищены»), тап открывает bottom-sheet с чеклистом («встречайтесь в людном месте · осмотр до оплаты · переписка внутри LyVoX»). Ноль обязательных чеклистов МЕЖДУ пользователем и контактом.
3. **Чат-хинт**: тот же safety-чеклист — первым сообщением-подсказкой уже ВНУТРИ чата (найди где начинается разговор — `api/chat/start` / ChatWindow — добавь системную подсказку, текст из i18n).
4. Мотион (bottom-sheet) — по emil-design-eng: ease-out ≤300мс, prefers-reduced-motion, тач-таргеты 44px.
5. i18n новых строк — 5 локалей (`advert.safety_*`, `chat.safety_hint`).

## Проверка
- Полный сьют; локально на мобильном preview (resize mobile): contact-bar без layout-shift, bottom-sheet открывается/закрывается, primary один.
- merge --no-ff, push, прод `/ad/<id>` 200 + визуальная проверка.

## Красные линии
- **F3**: «контакты защищены»/«чат внутри LyVoX» — ОК (реальный механизм); «безопасная оплата/гарантия» — НЕТ. Никаких обязательных интерстишлов до контакта. Не ломать identity-гейт физ-продавца. bottom-spacing только через существующие переменные. i18n 5 локалей.
