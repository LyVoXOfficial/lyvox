# TypeScript Types Regeneration Guide

After applying catalog migrations, TypeScript types must be regenerated to include new tables.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Migrations applied to your Supabase project
- Project ID or local instance running

## Method 1: From Cloud Project (Recommended for Production)

```bash
# Login to Supabase (one-time)
npx supabase login

# Generate types from your cloud project
npx supabase gen types typescript --project-id <your-project-id> > supabase/types/database.types.ts

# Or using project reference
npx supabase gen types typescript --project-ref <your-project-ref> > supabase/types/database.types.ts
```

## Method 2: From Local Development

```bash
# Start local Supabase (if not running)
npx supabase start

# Apply migrations locally
npx supabase db push

# Generate types from local instance
npx supabase gen types typescript --local > supabase/types/database.types.ts
```

## Verification

After regeneration, verify new types exist:

```typescript
import type { Database } from '@/supabase/types/database.types';

// Should include new tables:
type PropertyListings = Database['public']['Tables']['property_listings'];
type JobListings = Database['public']['Tables']['job_listings'];
type DeviceBrands = Database['public']['Tables']['device_brands'];
type PropertyTypes = Database['public']['Tables']['property_types'];
type EPCRatings = Database['public']['Tables']['epc_ratings'];
// ... etc
```

## Troubleshooting

### "Project not found"
- Check project ID: `npx supabase projects list`
- Ensure you're logged in: `npx supabase login`

### "Connection refused" (local)
- Start Supabase: `npx supabase start`
- Check status: `npx supabase status`

### Types incomplete
- Ensure all migrations applied: `npx supabase db push`
- Check migration history in Supabase Dashboard

## Next Steps

After types regeneration:
1. Restart TypeScript server in your IDE
2. Fix any type errors in existing code
3. Update imports to use new types
4. Continue with UI component implementation

---

**Note**: This is a manual step that must be run by a developer with access to Supabase credentials.

---

## 🔗 Related Docs

**Catalog:** [AI_ENRICHMENT.md](./AI_ENRICHMENT.md) • [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [CATALOG_MASTER.md](./CATALOG_MASTER.md) • [categories/real-estate.md](./categories/real-estate.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)




