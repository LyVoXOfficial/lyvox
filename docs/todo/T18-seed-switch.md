> [!WARNING]
> **ARCHIVE / SUBORDINATE REFERENCE.** Это сохранённый инвариант seed-витрины, а не активная задача, launch-status или порядок реализации. Любое изменение режима активирует и принимает только [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md), а удаление seed-данных требует отдельной явной команды основателя.

# Seed-витрина: сохранённый контракт переключателя

## Неподвижная граница

- Seed-контент — управляемая основателем витрина до публичного launch-gate.
- Seed-аккаунты, объявления и связанные данные нельзя удалять, очищать, массово скрывать или деиндексировать без отдельной явной команды основателя.
- Код переключателя допустим только в безопасном состоянии OFF. `EXCLUDE_SEED_FROM_AGGREGATES=false` сохраняет витрину и текущее поведение.
- Возможное включение влияет только на явно перечисленные агрегаты/social proof/price samples. Оно не является разрешением на purge и не должно менять исходные объявления.
- Маркер `profiles.is_seed` не должен быть доступен для изменения обычному пользователю; RLS и server-only write boundary сохраняются.

## Технические ссылки

- `supabase/migrations/20260704140000_t18_seed_switch.sql`
- `apps/web/src/lib/seed/excludeSeedFromAggregates.ts`
- `apps/web/src/app/api/top-sellers/route.ts`
- `apps/web/src/app/api/price-suggestion/route.ts`
