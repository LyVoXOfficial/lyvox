# LyVoX

LyVoX is a Belgium-focused trust-first marketplace: C2C/B2C listings with verification, structured categories, moderation, chat, billing, and compliance-oriented seller flows.

The single source of truth for Production scope, priorities, status, and release gates is [`docs/MASTER_PRODUCTION_TZ.md`](docs/MASTER_PRODUCTION_TZ.md). Product vision and feature PRDs are subordinate references and do not carry current status.

## Structure

- `apps/web`: Main Next.js web application.
- `supabase`: Database migrations, edge functions, generated types, and seed data.
- `docs`: Requirements, roadmap, audit notes, and product/technical planning.
- `scripts`: Local maintenance and helper scripts.
- `tests`: End-to-end tests and shared test assets.

## Development

1. `pnpm install`
2. `pnpm dev`
3. `pnpm typecheck`
4. `pnpm test`
