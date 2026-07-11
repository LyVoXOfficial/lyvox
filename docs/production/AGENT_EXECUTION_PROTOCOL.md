# LyVoX: протокол работы Codex и Claude Code

Дата: 2026-07-10
Статус: обязательная подчинённая спецификация к [MASTER_PRODUCTION_TZ.md](../MASTER_PRODUCTION_TZ.md)

## 1. Цель

Протокол превращает несколько сильных моделей в одну проверяемую инженерную команду. Он не разрешает агентам объявлять задачу готовой по уверенности или красивому diff. Production-статус появляется только из воспроизводимых доказательств.

Названия Sol, Terra, Luna, Sonnet и Fable5 ниже являются ролями по умолчанию. Если фактические возможности модели или доступные инструменты отличаются, Sol меняет назначение, но не снижает acceptance.

## 2. Роли

| Роль            | Основная ответственность                                                        | Не может единолично закрыть                        |
| --------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `Codex Sol`     | Оркестрация, архитектура, зависимости, task contract, ADR, финальный синтез     | Собственную high-risk реализацию                   |
| `Codex Terra`   | Backend/platform: Supabase, RLS, migrations, integrations, admin, CI/ops        | Security/money/migration без независимого verifier |
| `Codex Luna`    | Независимая verification, E2E, release evidence, staging/live-safe smoke        | Менять acceptance после получения результата       |
| `Claude Sonnet` | Атомарные implementation slices, tests, bounded refactors, docs                 | Расширять scope без нового task contract           |
| `Claude Fable5` | Product/design/copy, five-locale UX, adversarial spec review, trust consistency | Подменять legal/security sign-off                  |

Для UI-задачи Fable5 может быть implementer, а Luna verifier. Для backend-задачи Terra или Sonnet implementer. Для security, auth, money и migrations автор никогда не является единственным verifier.

## 3. Канонический поток

`Sol: scope + invariants + acceptance
  -> Terra / Sonnet / Fable5: bounded implementation
  -> peer review другой модельной семьи
  -> Luna: independent verification
  -> Sol: synthesis, evidence link, master status`

Можно распараллеливать независимые slices, но нельзя пропускать verification или позволять двум агентам одновременно писать один файл.

## 4. Task contract

До первой правки Sol создаёт или обновляет `docs/aegis/plans/YYYY-MM-DD-<id>.md`. Контракт содержит:

`ID:
release mode:
goal:
owner:
independent verifier:
scope:
allowed files:
explicit non-goals:
baseline evidence:
architecture and compatibility boundary:
project invariants:
acceptance criteria:
focused verification:
full verification:
migration/rollback:
activation blockers:
expected evidence:
handoff target:`

Если задача касается внешнего provider, отдельно фиксируются sandbox availability, secrets, legal/company gates, fallback и kill-switch.

## 5. Перед началом

Каждый write-owner обязан:

1. убедиться, что workspace — `C:\LyvoxMarketPlace` и remote — LyVoXOfficial/lyvox;
2. синхронизироваться с `origin/main` до своей ветки/worktree;
3. прочитать `AGENTS.md`, `CLAUDE.md`, master и task plan;
4. проверить dirty worktree и не трогать чужие изменения;
5. запросить Graphify по задаче до широкого source search;
6. записать baseline failure или текущее поведение;
7. назвать точные файлы, которыми он владеет.

Агент не делает `git add -A`, не stash-ит чужое, не обходит hooks и не печатает secrets.

## 6. File ownership и параллельность

- Один файл в один момент имеет одного write-owner.
- Shared files (`capabilities.ts`, `env.ts`, locale JSON, master, workflow, generated DB types) изменяются отдельным integration owner.
- Subagents по умолчанию read-only, пока им явно не выделен непересекающийся scope.
- Если два slices требуют один shared file, сначала создаётся совместимый интерфейс, затем изменения интегрирует один owner.
- Generated files обновляются один раз после migrations, не каждым агентом.
- Любой обнаруженный out-of-scope blocker отправляется Sol; агент не «заодно» переписывает соседний модуль.

## 7. Risk lanes

### Low

Docs, безопасный config, локальная copy correction, механический refactor.

- один implementer;
- focused checks;
- обычный review;
- Sol может синтезировать после CI.

### Medium

Один product flow, API route, adapter без денег, компонентная система.

- implementer;
- reviewer другой модели;
- unit/integration и relevant E2E;
- rollback описан.

### High

Auth, admin, privacy, capability resolver, cron, uploads, caching, public claims.

- Sol утверждает архитектуру;
- implementer;
- adversarial peer review;
- Luna независимо воспроизводит;
- staging evidence обязательно.

### Regulated

Money, payout, identity, KYC/KYB, VAT/DAC7, PSD2/AML, destructive migration.

- архитектурный plan и compatibility boundary;
- human legal/accounting sign-off где применимо;
- deterministic simulator/contract tests до внешнего доступа;
- cross-model review;
- Luna staging verification;
- founder-controlled activation;
- live capability default OFF.

Ни одна модель не заменяет юриста, бухгалтера, DPO или provider certification.

## 8. Правила реализации

- Минимальный diff, который полностью закрывает acceptance.
- Сначала invariant/test, затем implementation для security и bug fixes.
- UI меняется слоями по [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), а не page-by-page с новыми локальными стилями.
- Все user-visible strings проходят через 5 locale files одновременно.
- API сохраняет envelope `{ok,data}` / `{ok:false,error}`.
- Capability проверяется server-side через effective resolver.
- Provider adapter имеет timeout, typed errors, retry policy, idempotency и fallback.
- Новая SECURITY DEFINER функция revoke-ит default execute и grant-ит минимальную роль.
- Миграция имеет RLS/grants, generated types, forward verification и recovery plan.
- После code changes выполняется `graphify update .`.

## 9. Verification ladder

### V0: Static

- format/lint touched files;
- typecheck;
- no new secret/client boundary issue;
- docs/links/schema consistency.

### V1: Focused

- unit/contract tests изменённого модуля;
- negative paths;
- regression test исходного дефекта;
- capability OFF/missing/degraded path.

### V2: Integration

- API + DB/RLS;
- webhook duplicate/out-of-order;
- provider sandbox/fake;
- locale and accessibility assertions.

### V3: Product

- Playwright critical journey;
- responsive and keyboard;
- visual baseline where UI changed;
- staging with disposable data.

### V4: Release

- full required CI on exact SHA;
- migration rehearsal;
- health/alerts;
- production-like smoke;
- rollback/emergency-off.

High и regulated задачи не закрываются ниже V4. Medium обычно требует V3. Low не освобождается от relevant CI.

## 10. Независимая verification Luna

Luna получает task contract, а не объяснение автора «почему всё должно работать». Она:

1. проверяет SHA и clean evidence environment;
2. воспроизводит acceptance своими командами;
3. атакует negative/permission/concurrency/failure paths;
4. сравнивает public claim с runtime capability;
5. проверяет rollback или kill-switch;
6. возвращает `PASS`, `FAIL` или `BLOCKED_EXTERNAL` с доказательством.

`BLOCKED_EXTERNAL` допустим для code-complete provider adapter, но не превращается в `VERIFIED`.

## 11. Review policy

Reviewer ищет не стиль, а:

- нарушенный invariant;
- скрытый call-site;
- fail-open;
- permission escalation;
- stale cache/config;
- race/idempotency;
- data loss/retention;
- misleading UI/copy;
- missing state/localisation;
- unbounded cost/query;
- migration compatibility;
- отсутствующий operational owner.

Finding имеет file/line, impact, reproduction и минимальное исправление. Общие фразы без доказательства не блокируют merge.

## 12. Handoff

Write-owner завершает передачу форматом:

`ID:
branch/worktree:
commit SHA:
changed files:
behavior before/after:
focused checks:
full checks:
manual/staging evidence:
migrations:
rollback:
known limitations:
external blockers:
recommended verifier attacks:
master status change proposed:`

Не допускаются формулировки «всё должно быть готово», «тесты, вероятно, пройдут» или «production-ready» без ссылок.

## 13. Evidence

Канонические evidence:

- CI URL на exact SHA;
- test/coverage artifact;
- Playwright trace/screenshot;
- staging deployment URL;
- migration/restore report;
- security reproduction;
- provider sandbox event ID без secret payload;
- release/rollback timestamp;
- legal approval ID/hash, но не сам чувствительный документ в public repo.

Локальные временные artifacts хранятся в ignored `artifacts/<ID>/`. Краткий воспроизводимый record может храниться в `docs/production/evidence/<ID>.md`.

Checkbox master закрывается вместе с evidence в том же commit.

## 14. Git и delivery

- Ветка задачи: `codex/<id>-<slug>` для Codex или согласованный project prefix.
- Commit атомарен: одна проверяемая причина изменения.
- Stage только перечисленные файлы.
- Pre-commit full suite не обходится и не прерывается.
- Merge только через green required checks.
- Push/deploy/production toggle являются отдельными действиями с соответствующим authority.
- High-risk activation выполняет founder по runbook после Luna PASS.

## 15. Как обновляется статус

Sol меняет master только после Luna PASS или честного `CODE_COMPLETE + BLOCKED_EXTERNAL`.

| Реальность                                       | Разрешённый статус                |
| ------------------------------------------------ | --------------------------------- |
| Код отсутствует                                  | NOT_STARTED                       |
| Diff есть, acceptance неполный                   | IN_PROGRESS                       |
| Tests/adapter готовы, внешний доступ отсутствует | CODE_COMPLETE + BLOCKED_EXTERNAL  |
| Staging/sandbox evidence зелёный                 | VERIFIED + OFF/READY              |
| Founder включил и smoke зелёный                  | VERIFIED + ON                     |
| Provider failure                                 | VERIFIED + DEGRADED/EMERGENCY_OFF |

## 16. Definition of done

- [ ] Scope не расширен молча.
- [ ] Один write-owner и независимый verifier указаны.
- [ ] Acceptance покрывает happy и negative paths.
- [ ] Relevant verification ladder пройден.
- [ ] Security/legal/design invariants сохранены.
- [ ] Rollback или kill-switch доказан.
- [ ] Evidence связан с exact SHA.
- [ ] Graphify обновлён после code change.
- [ ] Master и подчинённые specs синхронизированы.
- [ ] External blocker назван честно и не замаскирован зелёным checkbox.
