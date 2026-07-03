## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- Treat `CLAUDE.md` as the shared project guidance for this repository. Read it before non-trivial work and follow it alongside this file.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Shannon Pre-Customer Security Gate

- Shannon is available locally at `C:\Users\power\.codex\vendor_imports\KeygraphHQ-shannon` for future pre-customer proof-by-exploitation testing.
- Use the project `shannon` skill for Shannon planning/runs when available.
- Use Shannon only for LyVoX-owned local or staging environments with disposable data and explicit authorization. Never run it against production or real customer/payment data.
- Before first customer traffic, follow `docs/security/shannon-precustomer-runbook.md` and `security/shannon/lyvox-precustomer.example.yaml`.
- Treat Shannon findings as evidence to review and reproduce; do not ship with confirmed critical/high exploitable findings open.

## Правила среды — предотвращение повторяющихся ошибок

Этот раздел обязателен к прочтению ПЕРЕД первой командой в сессии. Каждое правило родилось из реально повторённой ошибки.

### 0. Рабочая директория
- Проект — ТОЛЬКО `C:\LyvoxMarketPlace`. Перед любой работой: `git remote -v` должен показывать `github.com/LyVoXOfficial/lyvox`. Не показывает — СТОП, ты в чужом репозитории (прецедент: сессия стартовала в `C:\Larum14huis\ElectricalProject`).
- Первая команда каждой сессии: `git pull origin main` (другие агенты пушат между твоими сессиями).

### 1. Shell: Windows + PowerShell 5.1 + Git Bash — не смешивать
- В PowerShell 5.1 НЕТ `&&` и `||` — это parser error. Либо `;`, либо `if ($?) { ... }`, либо выполняй команду в Git Bash.
- Одна команда = один синтаксис. Bash-конструкции (`$VAR`, `[ -f x ]`, heredoc) в PowerShell не работают, и наоборот (`$env:X`, backtick-переносы) — в bash.
- `head/tail/wc/touch` в PowerShell отсутствуют. `sed -i` на Windows портит CRLF — не использовать для правок; правь файлы своим edit-инструментом.

### 2. Кодировки — источник худших багов проекта
- PowerShell 5.1 читает файлы БЕЗ BOM как ANSI/cp1251; `Out-File`/`>` пишут UTF-16. Итог — можибейк класса «BELGIГ«» (реально жил на проде: 1278 битых строк в локалях).
- ПРАВИЛО: любой не-ASCII текст (кириллица, ë é ü, тире —) записывается в файлы ТОЛЬКО edit/write-инструментом агента, НИКОГДА через echo/Set-Content/Out-File/sed.
- После любой правки `apps/web/src/i18n/locales/*.json`: `grep -c "Г«\|вЂ\|Г¤" apps/web/src/i18n/locales/*.json` — все нули. Не нули = ты внёс можибейк, откатывай.

### 3. Git-дисциплина
- Строки `[graphify hook] launching background rebuild` и `[graphify] Branch switched` в выводе git — НЕ ошибки. Игнорируй.
- Пре-коммит хук гоняет ПОЛНЫЙ тест-сьют (~2 мин, 700+ тестов). Это норма: не прерывай, не решай что «зависло», НИКОГДА не используй `--no-verify` для обхода упавших тестов.
- НИКОГДА `git add -A` / `git add .` — в дереве живут артефакты других агентов и хуков (graphify-out/, .superpowers/, чужие незакоммиченные файлы). Добавляй ТОЛЬКО файлы своей задачи поимённо.
- Чужие незакоммиченные файлы в `git status` — не трогать, не коммитить, не стэшить. Возможно, параллельно работает другой агент.
- Multiline-коммит: пиши сообщение через несколько `-m` или файл (`git commit -F msg.txt`); не вставляй в сообщение backtick'и и `$`.

### 4. Проектные инварианты (дублируют TODO.md — потому что нарушались)
- i18n-ключ добавляется СРАЗУ в 5 файлов (en/fr/nl/de/ru), иначе guard-тест валит весь сьют. Локали правятся только edit-инструментом (см. §2).
- Клиенты API читают `body.data.X` (конверт `{ok, data}`), не `body.X`.
- RPC `search_adverts` — 13 аргументов, сигнатура ФИКСИРОВАНА (изменение = DROP+CREATE + координация с задеплоенным кодом).
- PostgREST `.or()`: LIKE-шаблон пишется `path.like.foo/*` — символ `*`, НЕ `%` (иначе тихо возвращает мусор).
- Новая SECURITY DEFINER функция: `revoke execute from public, anon, authenticated` + grant только нужной роли — Supabase по умолчанию раздаёт EXECUTE всем.
- RLS-политика с подзапросом на СВОЮ ЖЕ таблицу = бесконечная рекурсия 42P17. Только SECURITY DEFINER-хелпер (образцы: `is_conversation_participant()`, `is_business_member()`).
- Миграции: `supabase db push --include-all --db-url "$SUPABASE_DB_URL"` (переменная в `.env`; значение НИКОГДА не печатать, не логировать, не коммитить).

### 5. Верификация
- Дев-сервер (`pnpm dev`): CSS/JS-чанки НЕ контент-хешированы — браузер кэширует старьё, и «фикс не работает» оказывается кэшем. Истина = SSR-HTML: `curl -s "http://localhost:3000/путь?x=$RANDOM"`. В прод-сборке проблемы нет.
- Прод после пуша в main готов через ~2 мин (Vercel). Проверяй с cache-buster'ом (`?x=случайное`). `robots.txt` кэшируется Cloudflare ~4 часа — тоже только с cache-buster.
- `pnpm test` / `pnpm typecheck` / `pnpm lint` — из КОРНЯ репозитория, не из apps/web.

### 6. Журнал граблей (самопополняющийся — это твоя обязанность)
ПРАВИЛО: наступил на одну и ту же ошибку ДВАЖДЫ (в одной сессии или узнал из прошлой) — обязан дописать сюда ОДНУ строку формата `симптом → причина → правило` тем же коммитом, что и основная работа. Не раздувай: одна строка, без историй.

- `fatal: 'origin' does not appear...` при pull → сессия открыта не в том репозитории → проверяй remote до любых действий (§0).
- Тесты «висят» на коммите → это пре-коммит хук с полным сьютом → ждать ~2 мин (§3).
