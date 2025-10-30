# LyVoX

Welcome to the LyVoX monorepo.

## Structure

- `apps/web`: The main Next.js web application.
- `packages/ui`: Shared UI components.
- `packages/config`: Shared configuration (ESLint, TypeScript).
- `packages/db`: Database schema and migrations.

## Development

1.  `pnpm install`
2.  `pnpm dev`

### Next-Gen Profile

The new user profile page is implemented in `apps/web/src/app/(protected)/profile/page.tsx`.

It uses a modular architecture with reusable components located in `apps/web/src/components/profile/`.

- `ProfileAdvertsList.tsx`: Displays a user's listings.
- `ProfileReviewsList.tsx`: Displays reviews for a user.

Data is fetched server-side using a consolidated Supabase query for security and performance.

## Known Issues

- ESLint configuration is currently facing a circular dependency issue and is partially disabled.
- Pre-commit hooks are failing due to a test failure in `RegisterForm.test.tsx`.
