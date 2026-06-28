> ⚠ УСТАРЕЛО — этот файл больше не ведётся. Единый источник правды: [docs/MASTER_TODO.md](./MASTER_TODO.md). Сведено туда; можно удалить.

# LyVoX — UX Research Plan

_Authored 2026-06-25. Companion to the visual UI/UX review (see chat) and
`docs/UX_AUDIT_AND_ROADMAP.md`._

## Stage & constraint (read first)

**Solo developer, pre-launch, no external users yet** (the site isn't shown to
anyone). This is the decisive constraint:

- You **cannot** run interviews, moderated usability tests, or surveys right now —
  there is no one to recruit. Planning them as "do now" would be theater.
- What you **can** do solo, today, are the *evaluative* and *desk* methods that
  don't need participants. Those are below in Phase 0, and the heuristic
  evaluation is **already executed** in this doc.
- Everything that needs humans is packaged as ready-to-run kits (Phase 1+) so the
  day you open a private beta you start in minutes, not weeks.

You asked to cover all four goals (UX validation, trust/verification,
multilingual, concept desirability). They map cleanly onto the phases: you get
all four, just sequenced by what's possible at each stage.

---

## The staged plan

| Phase | When | Method | Answers which goal | Sample | Effort |
|---|---|---|---|---|---|
| **0 — Evaluate solo** | Now | Heuristic evaluation, cognitive walkthrough, competitive teardown, analytics instrumentation | UX validation (proxy), concept (desk) | n/a | days |
| **1 — Private beta** | First ~5–8 invited users | Moderated usability test of 5 core tasks + post-task interview | UX validation, trust/verification | 5–8 | 1–2 wks |
| **2 — Discovery interviews** | Alongside beta | Semi-structured interviews | Trust/verification, multilingual, concept | 5–8 | 2–4 wks |
| **3 — Quantify** | ≥100 sign-ups | In-product micro-surveys + funnel analytics + (later) A/B | Multilingual, prioritization | 100+ | ongoing |

Rule of thumb (Nielsen): **5 users find ~85% of usability problems** in a flow.
You do not need a big panel for Phase 1 — you need 5 real people who weren't you.

---

## Phase 0 — Heuristic evaluation (EXECUTED NOW)

Evaluated against Nielsen's 10 heuristics, grounded in the live app
(home, /search, /ad/[id], /login at desktop/tablet/mobile, locale=ru).
Severity: 🔴 critical · 🟡 serious · 🟢 minor.

| # | Heuristic | Finding | Sev |
|---|---|---|---|
| 1 | **Match system & real world** | UI renders hardcoded English while `locale=ru` / `<html lang=ru>` ("PRICE", "Posted", "Sign in to manage…", nav "More"). Language doesn't match the user's chosen one. | 🔴 |
| 2 | **Visibility of system status** | `/search` with no query shows a red *error* ("Ошибка загрузки результатов") instead of a clear empty/loading state — status is alarming and wrong. | 🔴 |
| 3 | **Consistency & standards** | Same action ("post a listing") appears twice in two languages/styles; two green primary CTAs compete in the header ("Подать объявление", "Join"). | 🟡 |
| 4 | **Aesthetic & minimalist design** | Giant "No Photo" billboard dominates listing cards and the detail gallery; three stacked horizontal scrollers on home; ~40% of desktop width is empty gutter. | 🟡 |
| 5 | **Error prevention / recovery** | The search error offers only "Повторить" — no guidance, no fallback content. | 🟡 |
| 6 | **Help users recognize/diagnose errors** | "Результат не найдено" (grammatically wrong) conflated with a load error — user can't tell "nothing matched" from "it broke". | 🟡 |
| 7 | **Flexibility & efficiency** | Login is strong: OAuth-first + password/magic-link toggle. (Positive.) | 🟢 |
| 8 | **Recognition over recall** | Trust signals are surfaced inline (verified badges, "Safer deal checklist") — good recognition support. (Positive.) | 🟢 |
| 9 | **Help & documentation** | "Safer deal checklist" gives just-in-time guidance on the listing — good; but it's English-only. | 🟢 |
| 10 | **Responsive / error states** | Header overflows at tablet width (~768–900px): "Join" clips off-screen between the mobile hamburger and full desktop header. | 🟡 |

**Cognitive walkthrough — core task "create my first listing" (could not fully
run: `/post` is auth-gated and there's no beta account).** Queue as the #1
usability-test task in Phase 1; the 8-step `PostForm` is the highest-risk flow
(longest, most abandonment-prone) and is untested.

**Competitive teardown (desk, do solo this week).** Pick 3 incumbents Belgian
users already use — **Vinted, 2dehands/Marktplaats, Facebook Marketplace** — and
for each capture: onboarding length, what verification (if any) they force, how
they present trust, and how language switching works. Output: a 1-page table of
"table stakes vs. where LyVoX's trust-first angle is genuinely differentiated."
This is the cheapest way to pressure-test the *concept* goal without users.

---

## Assumptions → hypotheses backlog (all four goals)

Turn beliefs into falsifiable hypotheses, ranked by **risk = impact × uncertainty**.
Test the riskiest first when users arrive.

| # | Hypothesis | Goal | Risk | How to validate | Success metric |
|---|---|---|---|---|---|
| H1 | Users will complete phone/itsme verification because the trust payoff feels worth it | Trust | **High** | Phase 1 usability test + interview | ≥60% finish verification unprompted |
| H2 | "Trust-first" is a real reason to switch from Vinted/2dehands (not just a nice-to-have) | Concept | **High** | Phase 2 interviews + competitive teardown | ≥4/8 name trust as a switch driver, unprompted |
| H3 | The EN/RU language mix measurably lowers perceived trust/quality | Multilingual | **High** | Phase 1 (observe reactions) + Phase 3 survey | Users mention/notice it; trust rating drops vs. clean locale |
| H4 | First-time users can create a listing end-to-end without help | UX | **High** | Phase 1 usability test (task 5) | ≥4/5 complete unaided; ≤X min |
| H5 | Belgian users expect NL/FR first; RU is diaspora-only | Multilingual | Med | Phase 2 interviews + analytics (locale chosen) | Distribution of locale selection |
| H6 | Buyers actually use in-platform messaging instead of moving to WhatsApp | Trust | Med | Phase 3 analytics | % conversations with ≥2 messages in-app |
| H7 | Low-inventory signals ("1 free listing") hurt rather than help | UX | Low | Phase 1 reaction + A/B later | Preference / trust rating |

---

## Phase 1+ ready-to-run kits

### A. Screener (recruit ~6–8 for beta usability)
Target: adults in Belgium who bought/sold second-hand online in the last 6 months.
Screen-in: used Vinted / 2dehands / Marktplaats / FB Marketplace recently; mix of
buyers and sellers; mix of NL / FR / (RU) primary language; at least 2 who have
NEVER done online ID/phone verification. Screen-out: works in UX/ecommerce.

### B. Interview guide (trust + language) — 50 min, per skill structure
- **Warm-up (5m):** Last thing you bought/sold second-hand online? Walk me through it.
- **Context (10m):** Which platforms, why those? What worries you about buying from a stranger? Tell me about a time a deal felt sketchy.
- **Deep dive — trust (20m):** What makes a *seller* feel trustworthy to you? [Show a LyVoX listing] React out loud. What do these "Verified" badges mean to you? Would you verify your own phone/ID to sell here — why / why not? What would make it worth it?
- **Deep dive — language (part of the 20m):** What language do you expect this in? [Navigate while they watch] — react to anything that feels off. (Watch whether they spontaneously flag the EN/RU mix — don't lead.)
- **Reaction (10m):** Compared to [their platform], why would you / wouldn't you use this?
- **Wrap (5m):** One thing that would make you trust this more? Anything I didn't ask?
- _Probes:_ "Tell me more." "What did you expect to happen?" "Why does that matter?" Never ask "would you use a trust feature" (everyone says yes) — ask about past behavior.

### C. Usability test script — 5 tasks, think-aloud, success criteria
1. **Find** a specific kind of item (e.g. "a used bike under €200 near you"). *Success:* reaches a relevant result set without help. *Watch:* the empty/error state on no-query search.
2. **Assess a seller** on a listing: "Would you message this person? Why?" *Watch:* whether trust badges are understood.
3. **Sign up** and reach a logged-in state. *Watch:* OAuth vs password choice, drop-off.
4. **Verify** phone (and itsme if available). *Watch:* where they hesitate/abandon — tests H1.
5. **Create a listing** end-to-end (the 8-step form). *Success:* published unaided. *Watch:* which step causes friction/abandonment — tests H4.
Capture per task: completion (y/n), time, errors, quotes. Rate severity after.

### D. In-product micro-survey (Phase 3, ≥100 users)
- Post-signup: "How easy was creating your account?" (1–5) + open "anything confusing?"
- Language prompt: "Is the site in the language you expected?" (Yes/No → which?).
- 1-item trust pulse on listing view: "How much would you trust buying from this seller?" (1–5).

---

## Instrument analytics NOW (so data accrues from user #1)

Define the funnel before the beta opens — events: `signup_start → signup_complete
→ verify_phone_start → verify_phone_complete → listing_create_start →
listing_publish → conversation_start → checkout_start → purchase`. Also log
**locale chosen** and **language-switch events**. Without this you'll have
opinions but no behavior in Phase 3 (validates H5, H6).

## Synthesis (when you have data)

- **Affinity map** observations → themes (per skill).
- **Severity-rank** usability issues (frequency × impact × persistence).
- **Jobs-to-be-done** framing for the concept goal: what are users "hiring" LyVoX
  to do that Vinted/2dehands don't?
- Feed confirmed issues back to `docs/UX_AUDIT_AND_ROADMAP.md` and the fix backlog.

## Bottom line for a solo pre-launch builder
Do **Phase 0 now** (the heuristic findings above are your starting backlog; add
the competitive teardown + analytics). Don't fake user research without users.
The moment you can put the product in front of **even 5** people who aren't you,
run the Phase 1 script — that single session set will teach you more than any
amount of solo speculation, and the kit above makes it turn-key.
