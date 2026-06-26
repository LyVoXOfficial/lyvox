# Stage 5 — Saved-Search Alert Delivery (Implementation Record)

**Date:** 2026-06-26 · **Branch:** `stage5-saved-search-alerts`
**Origin:** the Phase 4 boundary explicitly deferred alert *firing* to "Stage 5". This implements the
scheduled scan → in-app notification.

## Goal
A scheduled job scans saved searches with `alert_enabled = true`, finds active adverts matching each
that were created since the search's alert watermark, creates an in-app notification for the owner,
and advances the watermark.

## What shipped (code-complete)
- **Migration** `20260626150000_saved_search_alerts.sql` (applied to prod, verified): additive
  `saved_searches.last_alerted_at timestamptz default now()` (alert watermark, independent of
  `last_seen_at`), and extended `notifications_type_check` to allow the new `saved_search` type
  (strict superset → existing rows validate instantly).
- **Cron route** `app/api/cron/saved-search-alerts/route.ts` (GET): fail-closed on
  `Authorization: Bearer ${CRON_SECRET}` (401 if the secret is unset or mismatched — so it does
  nothing until configured). Uses the **service-role** client to read all alert-enabled searches and
  insert notifications past RLS. For each (bounded concurrency 5): `search_adverts(filters)` →
  adverts with `created_at > last_alerted_at` → if any, insert one summary notification
  (`type:'saved_search', channel:'in_app'`, localized title/body, payload `{saved_search_id, count, href}`),
  then advance `last_alerted_at = now()`. 4 unit tests (auth gate, fresh-match notify, no-match, watermark).
- **`apps/web/vercel.json`** — a daily cron (`0 8 * * *`, Hobby-plan-safe).
- **i18n** `saved.alert_title` / `saved.alert_body` in all 5 locales.

## ⚠️ Requires user action to actually fire (cannot be done autonomously)
1. **Set `CRON_SECRET`** in the Vercel project env (the route is fail-closed without it).
2. **Confirm the Vercel "Root Directory"** — `vercel.json` is at `apps/web/`; if the project's root is
   the repo root, move it there (otherwise the cron is silently not registered).
3. **Confirm the plan supports Cron Jobs** at the chosen schedule (Hobby = daily only; this uses daily).
4. `SUPABASE_SERVICE_ROLE_KEY` must be set in the env (already used elsewhere in prod).

## Known follow-ups (Stage 5+)
- Notification text uses the **default locale (`en`)** — no per-user locale is stored. Add a user
  locale (e.g. `profiles.locale`) and render alerts in it.
- Other channels (email/push) — only `in_app` is wired.
- `new_count` and this scan both call `search_adverts` per search; a batched/indexed count would
  scale better at large saved-search volumes.
