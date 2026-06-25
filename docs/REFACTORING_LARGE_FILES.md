# Refactoring plan — oversized files

_Authored 2026-06-25 as part of the audit (see docs/SECURITY_AUDIT.md N3)._

This is a **plan**, intentionally not yet executed. The targets are large,
behavior-critical, and currently have **no automated test coverage**, so a blind
structural refactor cannot be verified without a running app + manual QA.
Execute these in a dedicated session, test-first.

## Targets

| File | Lines | Shape |
| --- | --- | --- |
| `apps/web/src/app/post/PostForm.tsx` | ~2605 | One mega client component (8-step create/edit flow) |
| `apps/web/src/app/ad/[id]/page.tsx` | ~2005 | Server component + many data loaders + render helpers |
| `apps/web/src/components/SearchFilters.tsx` | ~1015 | Client component, filter UI + state |

## Why test-first is non-negotiable here

`PostForm.tsx` owns: multi-step navigation, 30s autosave (`AUTO_SAVE_INTERVAL_MS`),
draft create/patch via `/api/adverts`, media upload wiring (`UploadGallery`),
phone verification gating, catalog schema rendering, and publish validation. A
regression here silently breaks listing creation — the core funnel. There is no
existing test, so the first step is a **characterization test net**, not code
movement.

## PostForm.tsx — staged decomposition

**Stage 0 — Safety net (do first).**
- Add React Testing Library tests that drive the happy path (fill steps →
  publish) and the key error paths (publish with missing media/description/
  category → blocked; autosave fires; edit-mode hydrates `advertToEdit`). Mock
  `apiFetch`, `supabase`, and `UploadGallery`. Mirror the existing pattern in
  `apps/web/src/app/register/__tests__/RegisterForm.test.tsx`.
- Replace `advertToEdit?: any` (line 50) with a real type once the net exists —
  under `strict: true` this may surface latent issues; fix them with the net up.

**Stage 1 — Extract non-visual logic (lowest risk, verifiable by the net).**
- `usePostFormDraft()` — draft state + create/patch + dirty tracking.
- `useAutoSave(save, intervalMs)` — the interval effect (currently inline).
- `lib/post/validation.ts` — pure per-step validation predicates returning the
  same error codes the API expects (`DESCRIPTION_TOO_SHORT`, `MEDIA_REQUIRED`,
  `CATEGORY_REQUIRED`, `CONDITION_REQUIRED`).
- `PostForm.types.ts` — `PostFormProps` + step/draft types.

**Stage 2 — Extract step views.**
- `app/post/steps/Step{1..8}.tsx`, each receiving a typed props slice (no shared
  mutable state — pass values + callbacks). Keep `PostForm.tsx` as the
  orchestrator that owns state and composes steps + the stepper/footer.
- Lift the phone-verification block into `app/post/PhoneVerificationGate.tsx`.

**Target:** `PostForm.tsx` < ~400 lines (orchestration only); each step < ~250.

## ad/[id]/page.tsx — decomposition

Mostly server-side data loaders + render helpers, which are easier/safer than a
client refactor:
- Move data loaders (`loadAdvertData`, `loadSimilarAdverts`, seller/specifics
  builders) into `app/ad/[id]/data.ts` (server-only). These are testable as pure
  async functions with a mocked Supabase client.
- Move presentational helpers (`buildDetailItems`, `buildOptionLabels`,
  JSON-LD) into `app/ad/[id]/render.ts` / small components.
- Keep `page.tsx` as the thin composition layer.
- While here, keep the security note from the audit in mind: `loadSimilarAdverts`
  uses the service-role client filtered by `status = "active"` only — preserve
  that filter exactly.

## SearchFilters.tsx — decomposition

- Split each filter group (price, location/geo, category, verified-only, sort)
  into its own subcomponent under `components/search/filters/`.
- Centralize the query-param <-> state mapping in a `useSearchFilters()` hook so
  the URL contract has one owner.

## Guardrails for whoever executes this

- One stage per PR; run `pnpm test`, `pnpm typecheck`, `pnpm lint` after each.
- No behavior change in the same commit as a move. Extract verbatim, then change.
- Manually QA the create/edit funnel and the ad detail page before merging —
  these are not covered enough by unit tests alone.
