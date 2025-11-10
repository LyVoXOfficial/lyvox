# Pages Audit Report - LyVoX

**Date:** November 2, 2025  
**Pages audited:** 23 total, 6 critical reviewed in detail

## Executive Summary

✅ **Strengths:**
- All pages use i18n system (getI18nProps, useI18n hooks)
- Translation keys properly defined for EN, NL, FR, RU, DE
- German language support recently added

❌ **Critical Issues:**
- **SEO metadata missing** on most pages (no title, description, alternates)
- **Inconsistent helper function usage** - old vs new import paths
- **German category names need validation** in database
- **No accessibility audit** has been performed yet

## Detailed Findings

### 1. Homepage (`apps/web/src/app/page.tsx`)

| Aspect | Status | Details |
|--------|--------|---------|
| i18n | ✅ Good | Uses `getI18nProps()`, proper `t()` function |
| SEO | ❌ Missing | No `generateMetadata()` export |
| Accessibility | ⚠️ Unknown | Not audited |
| Helper functions | ❌ Not used | Currency/date formatting not using new helpers |
| German support | ✅ Ready | Uses `t()` for all strings |

**Recommendations:**
```typescript
// Add SEO metadata
export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  
  return {
    title: messages.app.title,
    description: messages.app.description,
    alternates: {
      languages: {
        en: '/en',
        nl: '/nl',
        fr: '/fr',
        de: '/de',
        ru: '/ru',
      },
    },
  };
}
```

### 2. Search Page (`apps/web/src/app/search/page.tsx`)

| Aspect | Status | Details |
|--------|--------|---------|
| i18n | ✅ Good | Uses `useI18n()` hook properly |
| SEO | ❌ Missing | No metadata generation |
| Accessibility | ⚠️ Partial | Has aria-disabled but incomplete |
| Helper functions | ❌ Not used | Manual currency/date formatting |
| German support | ✅ Ready | All strings use `t()` |

**Recommendations:**
- Add dynamic metadata based on search query
- Use `formatCurrency()` from `@/lib/i18n` instead of manual formatting
- Add proper ARIA labels for filters and pagination
- Add language alternates in metadata

### 3. Ad View Page (`apps/web/src/app/ad/[id]/page.tsx`)

| Aspect | Status | Details |
|--------|--------|---------|
| i18n | ✅ Good | Comprehensive translations |
| SEO | ❌ Missing | No JSON-LD schema for Product |
| Accessibility | ⚠️ Partial | Images have empty alt="" |
| Helper functions | ⚠️ Mixed | Uses `formatCurrency` from old path `@/i18n/format` |
| German support | ✅ Ready | All strings translated |

**Critical Issue:**
```typescript
// OLD (line 9):
import { formatCurrency } from "@/i18n/format";

// SHOULD BE:
import { formatCurrency } from "@/lib/i18n";
```

**Recommendations:**
- Update import path for `formatCurrency`
- Add SEO metadata with Product schema (JSON-LD)
- Add proper `alt` attributes to images (use title or description)
- Use `formatDate()` helper instead of manual `Intl.DateTimeFormat`

### 4. Profile Pages (`apps/web/src/app/(protected)/profile/*.tsx`)

| Aspect | Status | Details |
|--------|--------|---------|
| i18n | ✅ Good | Uses `useI18n()` hook |
| SEO | ✅ Good | Not critical (protected pages) |
| Accessibility | ⚠️ Unknown | Not audited |
| Helper functions | ❌ Not used | Manual formatting throughout |
| German support | ✅ Ready | DE translations complete |

**Recommendations:**
- Use `formatCurrency()` and `formatDate()` helpers consistently
- Add ARIA labels for form inputs and buttons

### 5. Post/Edit Page (`apps/web/src/app/post/page.tsx`)

| Aspect | Status | Details |
|--------|--------|---------|
| i18n | ✅ Good | Comprehensive translation coverage |
| SEO | ✅ Good | Not critical (form page) |
| Accessibility | ⚠️ Partial | Form labels need review |
| Helper functions | ❌ Not used | Manual validation and formatting |
| German support | ✅ Ready | DE translations in place |

**Recommendations:**
- Add proper `<label>` elements linked to inputs
- Use helper functions for price validation
- Add ARIA-describedby for error messages

### 6. Category Pages (`apps/web/src/app/c/[...path]/page.tsx`)

**Status:** Not yet reviewed in detail

**Expected issues:**
- Need to use `getCategoryName()` helper for localized names
- SEO metadata critical for these pages (breadcrumbs, alternates)
- JSON-LD for BreadcrumbList schema

## Priority Action Items

### 🔴 Critical (Do Now)

1. **Fix import paths** (2-3 pages affected)
   - Update all `@/i18n/format` imports to `@/lib/i18n`
   - Remove old `@/i18n/format.ts` file if exists

2. **Add SEO metadata** to public pages:
   - Homepage: `generateMetadata()`
   - Search: Dynamic metadata with query
   - Ad view: Product JSON-LD schema
   - Category pages: BreadcrumbList + hreflang

3. **Validate German translations** in database:
   - Run query to check for missing `name_de` values
   - Ensure all category translations are complete

### 🟠 High Priority (This Week)

4. **Adopt new helper functions**:
   - Replace all manual `formatCurrency` with `@/lib/i18n/formatCurrency`
   - Replace `Intl.DateTimeFormat` with `formatDate()` helper
   - Use `getCategoryName()` in category components

5. **Accessibility audit**:
   - Add `alt` attributes to all images (use meaningful descriptions)
   - Ensure all form inputs have associated `<label>` elements
   - Add ARIA labels for icon-only buttons
   - Test keyboard navigation

### 🟡 Medium Priority (Next Sprint)

6. **Create helper for API responses**:
   - Standardize error message translations
   - Create `ApiError` class with i18n support

7. **Performance optimization**:
   - Use `formatCurrencyCompact()` for large lists
   - Implement lazy loading for images
   - Add `loading="lazy"` to img tags

8. **Testing**:
   - Create E2E tests for each language
   - Test all pages with screen readers
   - Validate JSON-LD schema

## Helper Functions Migration Guide

### Current Status
- ✅ Created: `getCategoryName`, `formatCurrency`, `formatDate` helpers
- ❌ Not adopted: Pages still use old/manual formatting
- ⚠️ Old path exists: `@/i18n/format` may conflict

### Migration Steps

1. **Find all usages:**
```bash
# In terminal
grep -r "formatCurrency" apps/web/src/app/
grep -r "Intl.DateTimeFormat" apps/web/src/app/
grep -r "@/i18n/format" apps/web/src/
```

2. **Update imports:**
```typescript
// Before
import { formatCurrency } from "@/i18n/format";

// After
import { formatCurrency, formatDate } from "@/lib/i18n";
```

3. **Update category name fetching:**
```typescript
// Before
const name = category[`name_${locale}`] || category.name_en;

// After
import { getCategoryName } from "@/lib/i18n";
const name = getCategoryName(category, locale);
```

## SEO Metadata Template

For all public pages, use this template:

```typescript
import type { Metadata } from "next";
import { getI18nProps } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lyvox.com";
  
  return {
    title: "Your Page Title",
    description: "Your page description",
    alternates: {
      canonical: `${baseUrl}/${locale}/your-path`,
      languages: {
        'en': `${baseUrl}/en/your-path`,
        'nl': `${baseUrl}/nl/your-path`,
        'fr': `${baseUrl}/fr/your-path`,
        'de': `${baseUrl}/de/your-path`,
        'ru': `${baseUrl}/ru/your-path`,
      },
    },
    openGraph: {
      title: "Your Page Title",
      description: "Your page description",
      url: `${baseUrl}/${locale}/your-path`,
      siteName: "LyVoX",
      locale: locale,
      type: "website",
    },
  };
}
```

## Accessibility Checklist

For each page, verify:

- [ ] All images have meaningful `alt` attributes
- [ ] Form inputs have associated `<label>` elements
- [ ] Icon-only buttons have `aria-label` attributes
- [ ] Error messages use `aria-describedby` or `aria-live`
- [ ] Focus indicators are visible
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Color contrast meets WCAG AA standards (4.5:1 for text)
- [ ] Headings use proper hierarchy (h1 → h2 → h3)
- [ ] Links have descriptive text (avoid "click here")
- [ ] Tables have `<th>` headers with `scope` attribute

## German Language Validation

### Database Check

Run this query to validate German translations:

```sql
-- Check for missing German translations
SELECT id, slug, name_en, name_de, name_nl, name_fr, name_ru
FROM public.categories
WHERE name_de IS NULL OR name_de = ''
ORDER BY level, sort;

-- Check for fallback values (where DE = EN)
SELECT id, slug, name_en, name_de
FROM public.categories
WHERE name_de = name_en
ORDER BY level, sort;
```

### UI Check

Test all pages with German locale:
- [ ] Homepage shows German category names
- [ ] Search filters display German labels
- [ ] Ad view shows German specs/options
- [ ] Profile pages use German translations
- [ ] Error messages appear in German
- [ ] Date/time formatting uses German conventions (DD.MM.YYYY)
- [ ] Currency formatting uses German format (1.500,00 €)

## Next Steps

1. **Immediate:** Fix import paths and add SEO metadata
2. **This week:** Complete accessibility audit
3. **Next sprint:** Migrate all pages to new helper functions
4. **Ongoing:** Add E2E tests for each language

## Related Documents

- `docs/development/categories.md` - Category localization guide
- `MASTER_CHECKLIST.md` - Development task tracker
- `apps/web/src/lib/i18n/` - New helper functions

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [README.md](./README.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md)




