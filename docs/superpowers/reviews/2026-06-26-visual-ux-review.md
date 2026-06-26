# Visual UI/UX Review — LyVoX (www.lyvox.be)

**Date:** 2026-06-26
**Method:** Headless-Chrome capture of the live production site at desktop (1440px) and
mobile (390px) widths, plus a 1440×900 realistic-viewport recapture to calibrate whitespace.
Findings verified against source (`apps/web/src`). Locale `ru` is the review locale.
**Scope:** public funnel — home `/`, search `/search`, ad detail `/ad/[id]`, login `/login`,
register `/register`, create-listing gate `/post`, categories `/c`.
**Not covered (could not self-authenticate — account creation / password entry is prohibited):**
live visual review of authenticated flows — chat, profile, the verified-seller ad view, and the
`TrustGate` modal that opens on click. These were reviewed **from source instead**; the trust
modal components are properly localized (see §1 note).

Screenshots: `.uxreview/shots/` (`*-desktop.png`, `*-mobile.png`, `*-cal.png`).

---

## Overall impression
The product has a clear, consistent identity: a teal/green trust-forward marketplace with strong
"verified seller / safer local deals" messaging woven through every surface. The login/register
pages and the ad-detail page (rich characteristics table + AI pros/cons/advice insights) are
genuinely well built. The biggest opportunity is **not visual taste — it's a verified,
cross-page localization defect**: the newest/secondary components ship English text that renders
on every non-English locale. That undercuts the trust positioning more than any layout nit.

---

## §1 — CRITICAL: English text leaks onto non-English pages (verified, shippable)

> **Update (full static scan, 2026-06-26):** the visual pass below covers the *public tip*.
> A full-codebase scan of every `t/tr/tf/translate("dotted.key", …)` call vs the loaded locale
> messages revealed the leak is far larger than the 20 visible strings:
> - **~200 `catalog.*` keys** (listing-form fields: real-estate/electronics/fashion/jobs) are
>   referenced but the `catalog-*.json` files that contain their translations (all 5 languages,
>   already written) **were never wired into the loader** — see `CATALOG_I18N_README.md`, status
>   "Ready for integration." `server.ts`/`index.tsx` don't import them. → unwired latent defect,
>   fixed by merging the catalog files into the main locale files (translations already exist).
> - **91 keys genuinely missing** from the loaded messages, needing new translations:
>   `admin.moderation.*` ×24, `advert.*` ×14, `billing.*` ×15, `chat.*` ×21, `search.*` ×5,
>   `comparison.*` ×3, `profile.*` ×5, `post.*` ×2, `common.*` ×2.
> - **Mixed failure modes:** surfaces with a local `translate(key, fallback)` wrapper (chat,
>   billing, ad-card, ad-detail trust block, post) show the **English fallback**; surfaces using
>   the bare `t(key)` from `useI18n()` (admin moderation queue, catalog listing-form fields) show
>   the **raw dotted key** (e.g. literal `admin.moderation.title`).
> - **Most of this is auth-gated** (chat, billing, admin, listing form) — invisible to the public
>   visual pass, which is why only the `advert.*`/`category`/`post` surfaces appear in the table
>   below. The earlier "TrustGate clean" note still holds: the recent gate components are fine;
>   these leaks are in adjacent older code.
>
> Remediation tracked in `docs/superpowers/plans/2026-06-26-i18n-completeness.md`.

The visible public-page surfaces (verified against source **and** live HTML). Two root causes:

- **Missing i18n keys** — `translate("key", "English fallback")` is called, but the key does not
  exist in *any* locale file (`en/ru/nl/fr/de`), so the English fallback renders everywhere.
- **Hardcoded literals** — English string written directly in JSX with no `tr()` wrapper.

Confirmed: `advert.trust.*`, `advert.seller_checks_pending`, and `profile.login` are absent from
**all 5** locale files (`apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`).

### Leak inventory

| # | Surface (file:line) | Leaked English | Type | Fix |
|---|---|---|---|---|
| 1 | `app/ad/[id]/page.tsx:583` | "Email check" | missing key `advert.trust.email.title` | add key, all locales |
| 2 | `app/ad/[id]/page.tsx:585` | "Seller email has been verified." | missing key `advert.trust.email.verified` | add key |
| 3 | `app/ad/[id]/page.tsx:586` | "Seller email is not verified yet." | missing key `advert.trust.email.pending` | add key |
| 4 | `app/ad/[id]/page.tsx:590` | "Phone check" | missing key `advert.trust.phone.title` | add key |
| 5 | `app/ad/[id]/page.tsx:592` | "Seller phone has been verified." | missing key `advert.trust.phone.verified` | add key |
| 6 | `app/ad/[id]/page.tsx:593` | "Seller phone is not verified yet." | missing key `advert.trust.phone.pending` | add key |
| 7 | `app/ad/[id]/page.tsx:597` | "In-platform messaging" | missing key `advert.trust.messaging.title` | add key |
| 8 | `app/ad/[id]/page.tsx:599` | "Use LyVoX chat so there is a record…" | missing key `advert.trust.messaging.body` | add key |
| 9 | `app/ad/[id]/page.tsx:605` | "Inspect before payment" | missing key `advert.trust.inspect.title` | add key |
| 10 | `app/ad/[id]/page.tsx:607` | "Check item condition, documents…" | missing key `advert.trust.inspect.body` | add key |
| 11 | `app/ad/[id]/page.tsx:629` | "Seller checks pending" | missing key `advert.seller_checks_pending` | add key (unverified-seller only) |
| 12 | `app/post/page.tsx:95` | "Sign in before creating a listing so drafts…" | **hardcoded** | wrap in `tf("post.signin_intro", …)` |
| 13 | `app/post/page.tsx:100` | "Sign in" (button) | missing key `profile.login` | add key (RU: "Войти") |
| 14 | `app/post/page.tsx:128` | "Verify your account before publishing" | **hardcoded** | wrap `tf("post.verify_title", …)` |
| 15 | `app/post/page.tsx:131` | "Listings require confirmed contact details…" | **hardcoded** | wrap `tf("post.verify_body", …)` |
| 16 | `app/post/page.tsx:139` | "Email confirmation is missing" | **hardcoded** | wrap `tf("post.email_missing", …)` |
| 17 | `app/post/page.tsx:145` | "Phone verification is missing" | **hardcoded** | wrap `tf("post.phone_missing", …)` |
| 18 | `app/post/page.tsx:151` | "Go to verification" | **hardcoded** | wrap `tf("post.goto_verify", …)` |
| 19 | `app/post/page.tsx:156` | "Review profile" | **hardcoded** | wrap `tf("post.review_profile", …)` |
| 20 | `components/category-list.tsx:44` | "Browse listings" (card subtitle, ×12 in `/c` + category menu) | **hardcoded** | wrap in `tr("category.browse", …)` |

**Note (clean):** the `components/trust/*` gate components shipped in the recent verification work
(`TrustGateLogin`, `TrustGatePhone`, `TrustGateProvider`, `SellerIdentityGate`, `seller_gate.*`)
are **correctly localized** — the leaks above are all in adjacent older code, not the new gate.

### Suggested RU translations (nl/fr/de need native review)
```
advert.trust.email.title       Проверка email
advert.trust.email.verified    Email продавца подтверждён.
advert.trust.email.pending     Email продавца ещё не подтверждён.
advert.trust.phone.title       Проверка телефона
advert.trust.phone.verified    Телефон продавца подтверждён.
advert.trust.phone.pending     Телефон продавца ещё не подтверждён.
advert.trust.messaging.title   Общение на платформе
advert.trust.messaging.body    Используйте чат LyVoX — останется запись на случай проверки сделки поддержкой.
advert.trust.inspect.title     Проверьте перед оплатой
advert.trust.inspect.body      Проверьте состояние товара, документы, серийные номера и личность продавца перед отправкой денег.
advert.seller_checks_pending   Проверки продавца не завершены
profile.login                  Войти
post.signin_intro              Войдите перед созданием объявления, чтобы черновики, сообщения покупателей и верификация остались привязаны к одному аккаунту.
post.verify_title              Подтвердите аккаунт перед публикацией
post.verify_body               Объявления требуют подтверждённых контактов — это снижает мошенничество и делает переписку с покупателями подотчётной.
post.email_missing             Email не подтверждён
post.phone_missing             Телефон не подтверждён
post.goto_verify               Перейти к проверке
post.review_profile            Открыть профиль
category.browse                Смотреть объявления
```

**Systemic fix to prevent recurrence:** add a CI/lint check (or a unit test over the locale JSONs)
that fails when a `tr()/translate()` key used in source is absent from all locale files, and a lint
rule flagging bare English string literals in JSX. Cheap, and it would have caught all 20.

---

## §2 — Design & taste recommendations (prioritized)

| Finding | Severity | Where | Recommendation |
|---|---|---|---|
| **Header is overcrowded** — 8 competing elements; a decorative "Доверие прежде всего" trust-slogan pill sits *among* real action buttons (Подать объявление / Войти / Регистрация) | 🟡 Moderate | global header | Remove/relocate the "Доверие прежде всего" pill from the action bar (its message already lives in the top utility strip). Consider merging Войти+Регистрация into one account control. Let one primary CTA (Подать объявление) dominate. |
| **Language label truncated** — selector reads "RU Russi…" (word "Russian" clipped) on every page | 🟢 Minor | global header | Widen the control or show only the flag/"RU" code; the truncated word looks broken. |
| **Gate / empty-state cards float in a wide empty band** — `/post` uses `min-h-[60vh] items-center`; a small card sits alone in a large void (confirmed real at 1440×900, not just a capture artifact) | 🟡 Moderate | `/post` gate, similar empty states | Make the gate a more substantial, branded panel, or use the two-column value-prop layout the login page already uses (benefit chips beside the action) so the page feels intentional, not unfinished. |
| **Thin-catalog search layout** — with few results the results column is one short row beside a taller filter rail, leaving a large gap before the footer | 🟢 Minor (partly data-driven) | `/search` | Give the results grid a min-height or a "no more results / suggested categories" filler so sparse result sets don't read as a broken page. Re-evaluate once the catalog grows. |
| **Mobile hero is cramped** — hero headline sits tight against the top utility bar with little breathing room | 🟢 Minor | home, mobile | Add top padding / vertical rhythm to the hero on small viewports. |
| **Redundant auth buttons on auth pages** — login page still shows Войти/Регистрация in the header while you're on it | 🟢 Minor | `/login`, `/register` | Contextually de-emphasize the header auth buttons on the auth pages themselves. |

**Calibration note:** an earlier capture appeared to show the `/c` page rendered twice top-to-bottom.
Verified against live HTML (exactly one `<header>` and one `<footer>`) → **capture artifact, not a
bug.** Not reported as a defect.

**Excluded as data, not design:** "No Photo Available" placeholders and `asd asd` test descriptions
are seed-data quality, not UX defects (the placeholder card styling itself is fine).

---

## What works well
- **Consistent trust identity** — verified-seller framing, safety messaging, and the new
  verify-to-contact / verify-to-see-seller gates are coherent across the funnel.
- **Login/Register** — polished two-column layout (value prop + OAuth + password/magic-link), fully
  localized, clear hierarchy.
- **Ad detail** — rich and useful: characteristics table, generation/model info, and AI-generated
  pros/cons/advice insights add real value over a plain listing.
- **Mobile** — sensible single-column reflow with a persistent bottom tab bar and a 2-column card grid.

---

## Priority recommendations
1. **Ship the §1 i18n fixes** — highest impact, low risk, directly reinforces the trust positioning.
   Add the 20 keys/wraps + RU strings; commission nl/fr/de translations; add the CI guard.
2. **Declutter the header** — drop the "Доверие прежде всего" pill from the action bar; fix the
   truncated language label.
3. **Make gate/empty states feel intentional** — apply the login page's two-column treatment to `/post`.
4. **Manual pass on authenticated flows** — chat, profile, and the live TrustGate modal need a human
   visual check (couldn't be automated without sign-in).
