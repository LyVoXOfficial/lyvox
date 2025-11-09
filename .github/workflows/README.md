# CI/CD Workflows

This directory contains GitHub Actions workflows for automated checks and deployments.

## Workflows

### 🔍 CI (Continuous Integration)

**File:** `ci.yml`  
**Triggers:** Push to `main`/`develop`, Pull Requests

**Jobs:**

1. **Lint & Type Check**
   - Runs ESLint to catch code quality issues
   - Runs TypeScript compiler in check mode (`tsc --noEmit`)
   - Fails on any linting or type errors

2. **Build Check**
   - Builds the entire project using `pnpm run build`
   - Ensures no build-time errors
   - Uses Turbo for optimized builds

3. **i18n Keys Check**
   - Validates consistency of translation keys across all locales
   - Checks for missing translations (EN, NL, FR, RU, DE)
   - Warns on inconsistencies but doesn't fail (warnings only)

4. **Unit Tests**
   - Runs all unit tests with Vitest
   - Fails if any tests fail

5. **Checklist Progress Check**
   - Verifies `MASTER_CHECKLIST.md` progress stats are up-to-date
   - Fails if checklist needs update (reminder to run `pnpm run checklist:update`)

6. **CI Success**
   - Summary job that depends on all other jobs
   - Provides clear pass/fail status

## Required Secrets

For the CI workflow to work, configure these GitHub Secrets:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

**How to add secrets:**
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with its value

## Local Testing

Before pushing, run these commands locally to catch issues early:

```bash
# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Build
pnpm run build

# Run tests
pnpm run test

# Check i18n keys
node scripts/check-i18n-keys.js

# Update checklist progress
pnpm run checklist:update
```

## CI Status Badge

Add this to your README.md to show CI status:

```markdown
![CI](https://github.com/YOUR_USERNAME/lyvox/actions/workflows/ci.yml/badge.svg)
```

## Troubleshooting

### Build fails with "Module not found"

**Cause:** Missing dependencies or outdated lockfile

**Fix:**
```bash
pnpm install
pnpm run build
```

### Type check fails locally but passes in CI

**Cause:** Different TypeScript versions or cached types

**Fix:**
```bash
rm -rf node_modules apps/*/node_modules
pnpm install
pnpm run typecheck
```

### i18n check shows missing keys

**Cause:** Translation keys added to one locale but not others

**Fix:**
1. Add missing keys to other locale files
2. Or remove unused keys from reference locale (EN)

### Checklist check fails

**Cause:** `MASTER_CHECKLIST.md` statistics are out of date

**Fix:**
```bash
pnpm run checklist:update
git add docs/development/MASTER_CHECKLIST.md
git commit -m "chore: update checklist progress"
```

## Performance

The CI workflow uses several optimizations:

- **Concurrency:** Cancels in-progress runs for the same branch
- **Caching:** Node modules and pnpm store are cached
- **Parallel jobs:** All jobs run in parallel (except summary job)
- **Turbo:** Uses Turbo cache for builds

**Average run time:** 3-5 minutes

## Future Enhancements

- [ ] Add E2E tests with Playwright
- [ ] Add visual regression tests
- [ ] Add security scanning (Dependabot, Snyk)
- [ ] Add performance benchmarks
- [ ] Add deployment previews for PRs
- [ ] Add automatic changelog generation

## Related Files

- `scripts/check-i18n-keys.js` - i18n consistency checker
- `scripts/update-checklist-progress.js` - Checklist updater
- `package.json` - Script definitions
- `turbo.json` - Turbo build configuration







