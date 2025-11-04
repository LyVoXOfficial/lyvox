# MCP (Model Context Protocol) Services Integration

> Эта документация описывает MCP сервисы, доступные для работы с проектом LyVoX через интеллектуальных агентов (например, Codex).

## Обзор

MCP (Model Context Protocol) позволяет интеллектуальным агентам взаимодействовать с внешними сервисами напрямую через стандартизированный протокол. В проекте LyVoX настроены два основных MCP сервиса:

1. **Supabase MCP** — для работы с базой данных, миграциями, Edge Functions
2. **Vercel MCP** — для управления деплоями и проектами

---

## 1. Supabase MCP

### Описание

Supabase MCP предоставляет доступ к проекту Supabase для управления схемой базы данных, выполнения миграций, работы с Edge Functions и мониторинга.

### Доступные операции

#### Управление схемой базы данных

- **`mcp_supabase_list_tables`** — получить список всех таблиц в схеме(ах)
  - Параметры: `schemas` (массив строк, по умолчанию `["public"]`)
  - Использование: для анализа структуры БД перед изменениями

- **`mcp_supabase_execute_sql`** — выполнить произвольный SQL запрос (только для DML/запросов, не для DDL)
  - Параметры: `query` (SQL строка)
  - Использование: для чтения данных, отладки, проверки состояния
  - ⚠️ Не использовать для изменения схемы — используйте миграции

#### Миграции

- **`mcp_supabase_list_migrations`** — получить список всех примененных миграций
  - Использование: проверка истории миграций, отслеживание версий схемы

- **`mcp_supabase_apply_migration`** — применить новую миграцию (DDL операции)
  - Параметры:
    - `name` (строка, snake_case, например `add_user_preferences_table`)
    - `query` (SQL строка с DDL операциями)
  - Использование: создание новых таблиц, изменение схемы, добавление RLS политик
  - ⚠️ Важно: следуйте правилам из `docs/ARCH_RULES.md` — все таблицы должны иметь RLS = ON

#### Типы базы данных

- **`mcp_supabase_generate_typescript_types`** — сгенерировать TypeScript типы из текущей схемы БД
  - Использование: обновление `supabase/types/database.types.ts` после изменения схемы
  - Результат нужно сохранить в `supabase/types/database.types.ts`

#### Edge Functions

- **`mcp_supabase_list_edge_functions`** — список всех Edge Functions в проекте
- **`mcp_supabase_get_edge_function`** — получить содержимое Edge Function
  - Параметры: `function_slug` (строка, имя функции)
- **`mcp_supabase_deploy_edge_function`** — развернуть новую или обновить существующую Edge Function
  - Параметры:
    - `name` (строка, имя функции)
    - `files` (массив объектов с `name` и `content`)
    - `entrypoint_path` (строка, по умолчанию `index.ts`)
    - `import_map_path` (опционально, строка)

#### Расширения и метаданные

- **`mcp_supabase_list_extensions`** — список установленных PostgreSQL расширений

#### Мониторинг и отладка

- **`mcp_supabase_get_logs`** — получить логи за последние 24 часа для указанного сервиса
  - Параметры: `service` (enum: `api`, `postgres`, `edge-function`, `auth`, `storage`, `realtime`, `branch-action`)
  - Использование: отладка проблем, мониторинг ошибок

- **`mcp_supabase_get_advisors`** — получить рекомендации по безопасности и производительности
  - Параметры: `type` (enum: `security`, `performance`)
  - Использование: проверка уязвимостей, оптимизация схемы

#### Конфигурация проекта

- **`mcp_supabase_get_project_url`** — получить API URL проекта
- **`mcp_supabase_get_anon_key`** — получить anonymous API key

### Примеры использования Supabase MCP

#### Создание новой таблицы с миграцией

```typescript
// Пример использования в коде агента
await mcp_supabase_apply_migration({
  name: "add_user_preferences_table",
  query: `
    create table if not exists public.user_preferences (
      user_id uuid primary key references auth.users(id) on delete cascade,
      theme text default 'light',
      language text default 'en',
      notifications jsonb default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table public.user_preferences enable row level security;

    create policy "Users can read own preferences"
      on public.user_preferences
      for select
      using (auth.uid() = user_id);

    create policy "Users can update own preferences"
      on public.user_preferences
      for update
      using (auth.uid() = user_id);

    create trigger set_updated_at_user_preferences
      before update on public.user_preferences
      for each row
      execute function public.set_updated_at();
  `
});
```

#### Обновление TypeScript типов после миграции

```typescript
// 1. Применить миграцию
await mcp_supabase_apply_migration({ ... });

// 2. Сгенерировать типы
const types = await mcp_supabase_generate_typescript_types();

// 3. Сохранить в supabase/types/database.types.ts
```

#### Проверка безопасности схемы

```typescript
// После создания таблицы проверить рекомендации
const advisors = await mcp_supabase_get_advisors({ type: "security" });
// Проверить наличие предупреждений о missing RLS policies
```

### Интеграция с рабочим процессом

1. **Перед изменением схемы:**
   - Использовать `list_tables` для понимания текущей структуры
   - Проверить `list_migrations` для понимания истории

2. **При создании миграции:**
   - Использовать `apply_migration` с корректным SQL
   - Убедиться, что RLS включен для всех новых таблиц
   - Обновить типы через `generate_typescript_types`

3. **После изменений:**
   - Проверить `get_advisors` на наличие проблем безопасности
   - Обновить документацию в `docs/requirements.md` (раздел Database Schema)
   - Обновить `docs/ARCHITECTURE.md` если изменилась архитектура

---

## 2. Vercel MCP

### Описание

Vercel MCP предоставляет доступ к управлению проектами и деплоями на платформе Vercel.

### Доступные операции

#### Управление проектами

- **`mcp_Vercel_list_projects`** — получить список всех проектов (до 50)
  - Параметры: `teamId` (строка, обязательный)
  - Использование: поиск Project ID для работы с конкретным проектом

- **`mcp_Vercel_get_project`** — получить информацию о конкретном проекте
  - Параметры:
    - `projectId` (строка, Project ID начинается с `prj_`)
    - `teamId` (строка, обязательный)
  - Использование: проверка настроек проекта, конфигурации

#### Деплои

- **`mcp_Vercel_list_deployments`** — список деплоев для проекта
  - Параметры:
    - `projectId` (строка)
    - `teamId` (строка)
    - `since` (опционально, число, timestamp)
    - `until` (опционально, число, timestamp)
  - Использование: просмотр истории деплоев, поиск конкретного деплоя

- **`mcp_Vercel_get_deployment`** — получить информацию о конкретном деплое
  - Параметры:
    - `idOrUrl` (строка, ID или URL деплоя)
    - `teamId` (строка)
  - Использование: проверка статуса деплоя, просмотр деталей

- **`mcp_Vercel_get_deployment_build_logs`** — получить логи сборки деплоя
  - Параметры:
    - `idOrUrl` (строка)
    - `teamId` (строка)
    - `limit` (опционально, число, по умолчанию 100)
  - Использование: отладка failed деплоев, анализ ошибок сборки

- **`mcp_Vercel_deploy_to_vercel`** — развернуть текущий проект на Vercel
  - Использование: автоматический деплой после изменений

#### Доступ к защищенным URL

- **`mcp_Vercel_get_access_to_vercel_url`** — создать временную ссылку для доступа к защищенному деплою (без авторизации)
  - Параметры: `url` (строка, полный URL деплоя)
  - Результат: ссылка с параметром `_vercel_share`, действительна 23 часа

- **`mcp_Vercel_web_fetch_vercel_url`** — получить содержимое защищенного деплоя через Vercel Authentication
  - Параметры: `url` (строка, полный URL с путем)
  - Использование: проверка работы деплоя, тестирование endpoints

#### Команды и информация

- **`mcp_Vercel_list_teams`** — список команд пользователя
  - Использование: определение `teamId` для работы с проектами

- **`mcp_Vercel_search_vercel_documentation`** — поиск в документации Vercel
  - Параметры:
    - `topic` (строка, тема для поиска)
    - `tokens` (опционально, число, максимум токенов, по умолчанию 2500)
  - Использование: получение актуальной информации о возможностях Vercel

#### Домены

- **`mcp_Vercel_check_domain_availability_and_price`** — проверить доступность доменных имен и цены
  - Параметры: `names` (массив строк, 1-10 доменных имен)
  - Использование: проверка доступности доменов для проекта

### Примеры использования Vercel MCP

#### Проверка статуса последнего деплоя

```typescript
// 1. Получить список команд
const teams = await mcp_Vercel_list_teams();
const teamId = teams[0].id; // или использовать известный teamId

// 2. Получить список проектов
const projects = await mcp_Vercel_list_projects({ teamId });
const projectId = projects.find(p => p.name === 'lyvox')?.id;

// 3. Получить последние деплои
const deployments = await mcp_Vercel_list_deployments({ projectId, teamId });

// 4. Проверить статус последнего деплоя
const latest = deployments[0];
const deployment = await mcp_Vercel_get_deployment({ 
  idOrUrl: latest.id, 
  teamId 
});

if (deployment.readyState === 'ERROR') {
  // Получить логи для отладки
  const logs = await mcp_Vercel_get_deployment_build_logs({ 
    idOrUrl: latest.id, 
    teamId 
  });
}
```

#### Автоматический деплой после изменений

```typescript
// После применения миграций и обновления кода
await mcp_Vercel_deploy_to_vercel();
```

#### Проверка работы деплоя

```typescript
// Для preview деплоя с защитой
const deployment = await mcp_Vercel_get_deployment({ ... });
const shareableUrl = await mcp_Vercel_get_access_to_vercel_url({ 
  url: deployment.url 
});
// Использовать shareableUrl для проверки
```

### Интеграция с рабочим процессом

1. **После каждого коммита и push в GitHub (ОБЯЗАТЕЛЬНО):**
   - Проверить статус последнего деплоя через `list_deployments` для проекта `lyvox-frontend`
   - Определить деплой по commit SHA или времени создания
   - Если статус `ERROR`:
     - Получить логи через `get_deployment_build_logs`
     - Проанализировать ошибки сборки
     - Либо исправить проблему и создать новый коммит, либо сообщить пользователю
   - Если статус `READY`:
     - Подтвердить успешный деплой пользователю
     - Упомянуть URL деплоя для проверки
   
2. **После изменений кода (перед коммитом):**
   - Можно использовать `deploy_to_vercel` для автоматического деплоя (опционально)
   - Проверить статус через `get_deployment`

3. **При проблемах с деплоем:**
   - Получить логи через `get_deployment_build_logs`
   - Использовать `search_vercel_documentation` для поиска решений
   - Проверить настройки проекта через `get_project`

4. **Для мониторинга:**
   - Регулярно проверять `list_deployments` для отслеживания активности
   - Использовать `get_deployment` для детального анализа проблемных деплоев

---

## Правила использования MCP сервисов

### Общие принципы

1. **Безопасность:**
   - Никогда не выводить секреты (service keys, tokens) в логах или ответах
   - Использовать `supabaseService()` только на сервере для привилегированных операций
   - Проверять права доступа перед выполнением операций

2. **Идемпотентность:**
   - Миграции должны быть идемпотентными (можно применять повторно безопасно)
   - Использовать `IF NOT EXISTS` / `IF EXISTS` в SQL миграциях

3. **Синхронизация документации:**
   - После изменения схемы через `apply_migration` обновить `docs/requirements.md`
   - После изменения типов обновить `supabase/types/database.types.ts`
   - После архитектурных изменений обновить `docs/ARCHITECTURE.md`

4. **Тестирование:**
   - Проверять миграции на тестовой базе перед продакшеном
   - Использовать `get_advisors` для проверки безопасности после изменений

### Ограничения

- **Supabase MCP:**
  - `execute_sql` не должен использоваться для DDL — используйте миграции
  - Все таблицы должны иметь RLS = ON (см. `docs/ARCH_RULES.md`)
  - Изменения схемы только через миграции

- **Vercel MCP:**
  - Требуется авторизация и доступ к проекту Vercel
  - `teamId` обязателен для большинства операций
  - Деплои могут занять время — проверяйте статус асинхронно

---

## Troubleshooting

### Проблемы с Supabase MCP

**Ошибка: "Migration failed"**
- Проверить SQL синтаксис
- Убедиться, что миграция идемпотентна
- Проверить логи через `get_logs({ service: "postgres" })`

**Ошибка: "RLS policy missing"**
- Использовать `get_advisors({ type: "security" })` для проверки
- Создать политики для всех таблиц (см. `docs/requirements.md`)

### Проблемы с Vercel MCP

**Ошибка: "Team ID not found"**
- Использовать `list_teams` для получения правильного `teamId`
- Проверить `.vercel/project.json` для локального `orgId`

**Ошибка: "Project not found"**
- Использовать `list_projects` для поиска правильного `projectId`
- Проверить доступ к проекту в Vercel dashboard

---

## Ссылки

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- `docs/ARCH_RULES.md` — правила работы с базой данных
- `docs/requirements.md` — схема базы данных и политики
- `docs/INSTALL.md` — инструкции по настройке окружения

---

## Change Log

- 2025-01-XX: Создана документация по MCP сервисам для Supabase и Vercel

