# Code Splitting & Lazy Loading Guide (PERF-003)

This document describes the code splitting and lazy loading strategy for LyVoX marketplace.

## Overview

Code splitting reduces initial bundle size by loading code only when needed. Next.js 16 automatically splits code by route, but we can optimize further with dynamic imports for heavy components.

## Strategy

### 1. Route-Based Code Splitting (Automatic)

Next.js automatically splits code by route. Each page in `app/` directory becomes a separate chunk.

**✅ Already working:**
- `/` → `page.js` chunk
- `/post` → `post/page.js` chunk
- `/profile` → `profile/page.js` chunk
- etc.

### 2. Component-Level Code Splitting (Manual)

Use dynamic imports for heavy components that are not immediately visible or conditionally rendered.

## Implementation Patterns

### Pattern 1: Dynamic Import with Loading State

```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false, // Disable SSR if component is client-only
});
```

### Pattern 2: Dynamic Import with Named Export

```tsx
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent').then(mod => mod.HeavyComponent),
  { loading: () => <Skeleton /> }
);
```

### Pattern 3: Conditional Dynamic Import

```tsx
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  { ssr: false }
);

// Use conditionally
{showHeavyComponent && <HeavyComponent />}
```

## Components to Optimize

### ✅ High Priority (Large Components)

1. **PostForm** (`apps/web/src/app/post/PostForm.tsx`)
   - Contains multiple catalog field components
   - Should be lazy loaded since it's only on `/post` route
   - Already route-split, but can optimize sub-components

2. **UploadGallery** (`apps/web/src/components/upload-gallery.tsx`)
   - Heavy component with drag-and-drop
   - Only needed when posting/editing adverts
   - Good candidate for dynamic import

3. **ChatWindow** (`apps/web/src/components/chat/ChatWindow.tsx`)
   - Only needed on chat pages
   - Can be lazy loaded

4. **SearchFilters** (`apps/web/src/components/SearchFilters.tsx`)
   - Complex filtering UI
   - Can be lazy loaded on search page

### ✅ Medium Priority (Carousels)

5. **CategoriesCarousel** (`apps/web/src/components/categories-carousel.tsx`)
   - Can be lazy loaded below the fold

6. **InfoCarousel** (`apps/web/src/components/info-carousel.tsx`)
   - Can be lazy loaded below the fold

## Examples

### Example 1: Lazy Load PostForm Sub-Components

```tsx
// apps/web/src/app/post/PostForm.tsx
import dynamic from 'next/dynamic';

const ElectronicsFields = dynamic(
  () => import('@/components/catalog/ElectronicsFields'),
  { ssr: false }
);

const RealEstateFields = dynamic(
  () => import('@/components/catalog/RealEstateFields'),
  { ssr: false }
);

// Use conditionally based on category
{categoryType === 'electronics' && <ElectronicsFields />}
```

### Example 2: Lazy Load UploadGallery

```tsx
// apps/web/src/app/post/page.tsx
import dynamic from 'next/dynamic';

const UploadGallery = dynamic(
  () => import('@/components/upload-gallery'),
  {
    loading: () => <div className="animate-pulse">Loading upload...</div>,
    ssr: false,
  }
);
```

### Example 3: Lazy Load Chat Components

```tsx
// apps/web/src/app/(protected)/chat/[conversationId]/page.tsx
import dynamic from 'next/dynamic';

const ChatWindow = dynamic(
  () => import('@/components/chat/ChatWindow'),
  {
    loading: () => <ChatSkeleton />,
    ssr: false,
  }
);
```

### Example 4: Lazy Load Below-the-Fold Components

```tsx
// apps/web/src/app/page.tsx
import dynamic from 'next/dynamic';

const CategoriesCarousel = dynamic(
  () => import('@/components/categories-carousel'),
  { ssr: true } // Keep SSR for SEO
);

const InfoCarousel = dynamic(
  () => import('@/components/info-carousel'),
  { ssr: true }
);
```

## Bundle Size Optimization

### Check Bundle Size

```bash
pnpm build
# Check .next/analyze/ for bundle analysis
```

### Analyze Bundle

Next.js provides built-in bundle analysis:

```bash
ANALYZE=true pnpm build
```

### Common Optimizations

1. **Remove unused imports**
2. **Use tree-shaking friendly imports**
   ```tsx
   // ❌ Bad
   import * as Icons from 'lucide-react';
   
   // ✅ Good
   import { Check, X } from 'lucide-react';
   ```

3. **Avoid large libraries in client components**
   - Move heavy processing to server
   - Use server actions for data processing

4. **Optimize third-party libraries**
   - Use lighter alternatives
   - Import only needed parts

## Performance Monitoring

- Check Vercel Analytics for bundle sizes
- Monitor Core Web Vitals (FCP, LCP)
- Use Lighthouse to audit bundle optimization
- Check Network tab for chunk sizes

## Best Practices

1. **Lazy load components below the fold**
2. **Lazy load conditionally rendered components**
3. **Keep SSR for SEO-critical components**
4. **Use loading states for better UX**
5. **Monitor bundle size regularly**

## Related Documentation

- [Next.js Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Next.js Bundle Analyzer](https://nextjs.org/docs/app/api-reference/next-config-js/bundleAnalyzer)

