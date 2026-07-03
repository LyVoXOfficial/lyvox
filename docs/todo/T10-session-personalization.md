# T10 — Store-of-One: сессионная персонализация фида (client-only MVP)

**Модель:** средняя (gpt high / sonnet-класс); дизайн-часть уже решена документами.
**Ветка:** `feat/session-personalization` · **Приоритет:** P2 (потом/завтра) · **Оценка:** 1 день.

## Зачем
Бриф §4 + краш-тест агент A. Client-only пере-ранжирование «Рекомендуем сейчас» по сигналам ТЕКУЩЕЙ сессии. Никакого сервера, никакого профиля.

## Контракт (бриф §11.1, принят)
```ts
type PersonalizationMode = "off" | "session_only";
type SessionIntentState = {
  mode: PersonalizationMode; source: "memory" | "sessionStorage"; updatedAt: number;
  categories: Record<string, number>; priceBands: Record<string, number>;
  localRadiusKm: number | null;
};
```

## Шаги
1. `apps/web/src/lib/discovery/sessionIntent.ts`: чтение/запись state в sessionStorage (через существующий cookie-consent слой: functional-storage гейт — найди как RecentlyViewed гейтится, сделай так же), функции `recordCategoryClick`, `recordAdOpen(categoryId, priceBand)`, `reset()`.
2. Чистая функция `rankSessionItems(items, intent)`: НЕ удаляет элементы, только стабильно пере-сортирует (вес = совпадение категории + ценовой близости); при mode="off" возвращает вход без изменений. Юнит-тесты: без скрытых удалений; reset обнуляет; порядок детерминирован.
3. Подключение в `DiscoveryFeed.tsx`: пере-ранжирование ТОЛЬКО клиентских дозагруженных страниц (SSR-первая страница НЕ переставляется — иначе гидрация/CLS). Сигналы: клик по чипу категории, открытие /ad (пиши в sessionIntent из существующего RecentlyViewedRecorder — он уже client и знает категорию... если категории там нет, возьми из props карточки при клике).
4. UI-контролы НАД фидом (только когда mode=session_only и есть сигналы): текст `discovery.personalized_note` («Порядок скорректирован по этой сессии») + кнопка `discovery.personalized_reset` («Сбросить») + ссылка «Почему такой порядок?» на статичную секцию/страницу с объяснением. Ключи в 5 локалей.
5. Дефолт mode: "session_only" при данном functional-consent, иначе "off". Тумблер в настройках НЕ нужен в MVP — reset достаточно.

## Проверка
- Playwright/ручной: с off порядок не меняется при открытии объявлений; reset возвращает базовый порядок; network-таб — НИ ОДНОГО нового запроса с поведением (только существующая consent-gated аналитика).
- Полный сьют. Коммит: `feat(discovery): session-only client re-rank with visible reset (T10)` — merge --no-ff, push.

## Красные линии
- НИЧЕГО не отправлять на сервер (ни весов, ни intent). Никакого localStorage (только sessionStorage). Никаких скрытых удалений карточек. Consent-гейт обязателен.
