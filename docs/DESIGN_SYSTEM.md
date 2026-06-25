# LyVoX Design System — "Trust, in colour"

_Authored 2026-06-25. Concept mockup: `design-preview.html` (open in a browser)._

## Why
The Belgian incumbents (2dehands/Marktplaats) look like 2010-era classifieds —
cluttered, cold, generic. Avito/Xianyu are dense. Wallapop/Vinted are clean but
forgettable. LyVoX's edge is **trust + premium + Belgian**, so the design language
must *look* trustworthy and modern: calm, confident, colour used with intent, and
"safety" expressed as a visible, ownable brand signature — not a slogan.

## Direction
- **Signature palette:** a confident **teal** primary with a **mint** accent, joined
  by the `teal→mint` "trust gradient" used on everything trust-related (verified
  chip, logo mark, CTA). A warm **amber** is the energy accent (boost/deals only).
- **Premium surfaces:** larger corner radius (`--radius: 0.95rem`), soft layered
  shadows (`--shadow-soft / -card / -hi`), generous whitespace.
- **Brand-themed dark mode** (teal-slate), not the old flat gray.
- **Trust as a visual signature:** the verified badge is a gradient chip — the one
  element users should recognise instantly.

## Tokens (apps/web/src/app/globals.css)
| Token | Light | Role |
|---|---|---|
| `--primary` | `oklch(0.56 0.13 178)` | brand teal — CTAs, links, focus |
| `--accent` | `oklch(0.9 0.1 168)` | mint — verified, soft highlights |
| `--background` | `oklch(0.985 0.008 196)` | faint-teal off-white |
| `--foreground` | `oklch(0.22 0.03 200)` | deep slate-teal ink |
| `--muted-foreground` | `oklch(0.5 0.03 198)` | secondary text |
| `--border` | `oklch(0.91 0.012 198)` | hairline borders |
| `--radius` | `0.95rem` | base corner radius |
| `--shadow-soft / -card / -hi` | layered | elevation scale |

Dark mode mirrors these in a teal-slate key (`--background: oklch(0.19 0.022 205)`,
`--primary: oklch(0.72 0.13 176)`, …).

## Signature utilities (globals.css)
- `.lyvox-trust-gradient` — teal→mint gradient + soft glow (verified chip, logo mark).
- `.lyvox-cta-gradient` — primary CTA gradient + shadow.
- `.lyvox-image-placeholder` — branded gradient for empty images (replaces the old
  "No Photo" billboard).
- `.lyvox-hero-mesh` — soft radial mesh background for hero sections.

## Components updated this pass
- `components/VerificationBadge.tsx` — the signature gradient "verified/itsme" chip.
- `components/ad-card.tsx` — `rounded-xl`, card/hi shadows, stronger hover lift +
  image zoom, bigger bolder price, **branded placeholder** (shield mark on the
  trust gradient) instead of `/placeholder.svg`.
- `app/page.tsx` (home hero) — mesh background, uppercase eyebrow, larger
  `font-extrabold` headline, pill quick-actions, premium glass stat cards, gradient
  "post a listing" CTA.

## Verification & a note on local preview
`pnpm typecheck` ✅ (0) and `pnpm build` ✅ (exit 0) compile the full redesign.

⚠️ The local dev sandbox used during development would **not** reflect
`globals.css` changes (Turbopack/dev-server CSS caching — confirmed: even a clean
`apps/web/.next` wipe kept serving the old stylesheet). The production build
compiles the new CSS correctly, so this is a dev-tooling artifact, not a code
issue. To see it locally: stop all `node` processes, `rm -rf apps/web/.next` and
`node_modules/.cache`, then `pnpm dev` fresh — or just trust the production build.

## Components updated (rollout pass 2)
- `components/ui/button.tsx` — premium default (soft shadow + `active:scale`),
  outline → primary hover, larger sizes. Global impact.
- `components/categories-carousel.tsx` — `rounded-xl` cards, hover lift, icon tile
  fills with primary on hover; removed the hardcoded "Browse" label.
- `components/info-carousel.tsx` — `rounded-xl`, larger accent icon tile, hover
  lift + arrow nudge.
- `components/section-title.tsx` — `font-extrabold`, larger.
- `app/search/page.tsx` — premium results header card + bolder heading.

## Next (not yet done — same system, more surfaces)
- ad-detail page (the conversion screen — also still has "PRICE"/"Posted" in
  English and the old empty-image treatment), login/register (restyle + finish
  i18n), header/topbar polish, chat, SearchFilters sidebar.
- A primary gradient `Button` variant for hero-level CTAs.
- Add a real condition chip + boost badge to `ad-card` (needs the data wired).
- Logo mark refresh to match the gradient mark in the mockup.
