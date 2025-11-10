# Image Optimization Guide (PERF-002)

This document describes the image optimization strategy for LyVoX marketplace.

## Overview

LyVoX uses Next.js Image Optimization API with automatic WebP/AVIF conversion and CDN caching through Vercel.

## Configuration

### Next.js Image Config (`apps/web/next.config.ts`)

- **Formats**: AVIF (preferred) and WebP fallback
- **Device Sizes**: Responsive breakpoints for different screen sizes
- **Image Sizes**: Thumbnail sizes for different use cases
- **Cache TTL**: 7 days minimum cache time
- **Remote Patterns**: Supabase Storage URLs are allowed

### CDN Caching Headers

- **Static assets** (`/_next/static/**`): 1 year cache, immutable
- **Images** (`/images/**`): 1 year cache, immutable
- **Pages**: 1 hour cache with stale-while-revalidate (24 hours)

## Best Practices

### 1. Use Next.js Image Component

**✅ Good:**
```tsx
import Image from 'next/image';

<Image
  src={imageUrl}
  alt={title}
  width={400}
  height={300}
  loading="lazy"
  placeholder="blur" // if you have blur data
/>
```

**❌ Avoid:**
```tsx
<img src={imageUrl} alt={title} />
```

### 2. Provide Width and Height

Always provide explicit width and height to prevent layout shift:

```tsx
<Image
  src={imageUrl}
  alt={title}
  width={400}
  height={300}
/>
```

### 3. Use `fill` for Responsive Containers

For responsive images that fill a container:

```tsx
<div className="relative aspect-square w-full">
  <Image
    src={imageUrl}
    alt={title}
    fill
    className="object-cover"
  />
</div>
```

### 4. Lazy Loading

Use `loading="lazy"` for images below the fold:

```tsx
<Image
  src={imageUrl}
  alt={title}
  width={400}
  height={300}
  loading="lazy"
/>
```

### 5. Placeholder Images

Use placeholder images for missing or loading states:

```tsx
<Image
  src={imageUrl || '/placeholder.svg'}
  alt={title}
  width={400}
  height={300}
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    target.src = '/placeholder.svg';
  }}
/>
```

## Migration Checklist

- [ ] Replace `<img>` tags with `<Image>` component in:
  - [x] `apps/web/src/app/(protected)/profile/adverts/page.tsx` (already done)
  - [ ] `apps/web/src/components/AdvertGallery.tsx`
  - [ ] `apps/web/src/components/ad-card.tsx`
  - [ ] `apps/web/src/components/home/TopAdvertCard.tsx`
  - [ ] Other components using images

## Performance Benefits

1. **Automatic Format Conversion**: AVIF/WebP reduces file size by 30-50%
2. **Responsive Images**: Serves appropriate size for device
3. **Lazy Loading**: Reduces initial page load
4. **CDN Caching**: Vercel CDN caches optimized images globally
5. **Layout Stability**: Prevents Cumulative Layout Shift (CLS)

## Monitoring

- Check Vercel Analytics for image performance metrics
- Monitor Core Web Vitals (LCP, CLS)
- Use Lighthouse to audit image optimization

## Related Documentation

- [Next.js Image Optimization](https://nextjs.org/docs/app/api-reference/components/image)
- [Vercel Image Optimization](https://vercel.com/docs/image-optimization)

