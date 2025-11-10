# Catalog System Deployment Guide

**Version**: 1.0  
**Date**: 2025-11-05  
**Status**: Production-Ready (Backend Complete)

---

## 📋 Overview

This guide walks through deploying the complete LyVoX catalog system from migrations to API endpoints. Frontend components are documented separately.

---

## 🔄 Prerequisites Checklist

Before deployment, ensure you have:

- ✅ Supabase project created
- ✅ Database connection details (host, credentials)
- ✅ `psql` CLI installed (for seeds)
- ✅ Node.js 18+ installed
- ✅ Project repository cloned
- ✅ Environment variables configured

---

## 📦 Step 1: Database Migrations

### Apply Migrations in Order

```bash
# Navigate to project root
cd /path/to/lyvox

# Option A: Via Supabase CLI (Recommended)
npx supabase db push

# Option B: Manual via psql
export PGHOST="db.xxxxx.supabase.co"
export PGPASSWORD="your-password"

psql -U postgres -d postgres -f supabase/migrations/20251105213527_catalog_dictionaries.sql
psql -U postgres -d postgres -f supabase/migrations/20251105214000_real_estate_catalog.sql
psql -U postgres -d postgres -f supabase/migrations/20251105214500_jobs_catalog.sql
psql -U postgres -d postgres -f supabase/migrations/20251105215000_electronics_extended.sql
psql -U postgres -d postgres -f supabase/migrations/20251105215500_belgium_validation_functions.sql
```

### Verify Migrations

```sql
-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC LIMIT 5;

-- Check catalog tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'property_types', 'epc_ratings', 'cp_codes', 
  'property_listings', 'job_listings', 'device_brands'
);

-- Verify RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%property%';
```

---

## 🌱 Step 2: Seed Dictionary Data

### Automated (Recommended)

```bash
cd seed/catalog
chmod +x seed-all.sh
./seed-all.sh
```

### Manual

```bash
cd seed/catalog

# Load each dictionary
psql -U postgres -d postgres -f device_brands.sql
psql -U postgres -d postgres -f property_types.sql
psql -U postgres -d postgres -f epc_ratings.sql
psql -U postgres -d postgres -f cp_codes.sql
psql -U postgres -d postgres -f job_contract_types.sql
psql -U postgres -d postgres -f job_categories.sql
```

### Verify Seed Data

```sql
-- Quick count check
SELECT 
  (SELECT COUNT(*) FROM device_brands) as brands,
  (SELECT COUNT(*) FROM property_types) as prop_types,
  (SELECT COUNT(*) FROM epc_ratings) as epc,
  (SELECT COUNT(*) FROM cp_codes) as cp_codes,
  (SELECT COUNT(*) FROM job_categories) as job_cats,
  (SELECT COUNT(*) FROM job_contract_types) as contract_types;

-- Expected:
-- brands: ~38
-- prop_types: ~24
-- epc: 9
-- cp_codes: ~30
-- job_cats: 25
-- contract_types: 11

-- Check translations (should have 5 languages)
SELECT slug, name_nl, name_fr, name_en, name_de, name_ru 
FROM property_types LIMIT 3;
```

---

## 🔧 Step 3: Generate TypeScript Types

```bash
# From project root
npx supabase gen types typescript --project-id <your-project-id> > supabase/types/database.types.ts

# Or if using local dev:
npx supabase gen types typescript --local > supabase/types/database.types.ts
```

Verify the generated file includes new tables:
- `property_listings`
- `job_listings`
- `device_brands`
- `device_models`
- etc.

---

## 🚀 Step 4: Deploy API Endpoints

### Verify API Files Exist

```bash
ls -la apps/web/src/app/api/catalog/
# Should see:
# - property-types/
# - epc-ratings/
# - device-brands/
# - device-models/
# - job-categories/
# - cp-codes/
# - contract-types/
# - fields/
```

### Test API Endpoints (Local Dev)

```bash
# Start development server
npm run dev

# Test endpoints (in another terminal)
curl http://localhost:3000/api/catalog/property-types?lang=en
curl http://localhost:3000/api/catalog/epc-ratings?lang=nl
curl http://localhost:3000/api/catalog/device-brands?device_type=phone
curl http://localhost:3000/api/catalog/fields?category=real-estate&lang=en
```

### Deploy to Production

```bash
# Vercel deployment
vercel --prod

# Or via CI/CD (GitHub Actions, etc.)
# Ensure environment variables are set:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

---

## 🧪 Step 5: Testing

### Database Function Tests

```sql
-- Test postcode validation
SELECT validate_belgian_postcode('1000');  -- Should return true
SELECT validate_belgian_postcode('999');   -- Should return false

-- Test region detection
SELECT get_region_from_postcode('1000');   -- Should return 'brussels'
SELECT get_region_from_postcode('9000');   -- Should return 'flanders'

-- Test EPC validation
SELECT validate_epc_consistency('B', 130); -- Should return true (B allows up to 150)
SELECT validate_epc_consistency('A', 200); -- Should return false (A max 100)

-- Test phone validation
SELECT validate_belgian_phone('+32 471 12 34 56');  -- Should return true
SELECT validate_belgian_phone('0471 12 34 56');     -- Should return true
SELECT validate_belgian_phone('123');               -- Should return false

-- Test VAT validation
SELECT validate_belgian_vat('BE 0123 456 749');     -- Format check
```

### API Endpoint Tests

Create `apps/web/src/app/api/catalog/__tests__/endpoints.test.ts`:

```typescript
import { GET } from '../property-types/route';

describe('Catalog API Endpoints', () => {
  it('should return property types', async () => {
    const request = new Request('http://localhost/api/catalog/property-types?lang=en');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('slug');
    expect(data[0]).toHaveProperty('name');
  });
  
  // Add more tests for each endpoint...
});
```

Run tests:
```bash
npm test -- apps/web/src/app/api/catalog/__tests__
```

---

## 📊 Step 6: Monitoring & Verification

### Database Metrics

```sql
-- Check table sizes
SELECT 
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%property%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname, tablename, indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN ('property_listings', 'job_listings')
ORDER BY idx_scan DESC;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('property_listings', 'job_listings')
ORDER BY tablename, policyname;
```

### API Performance

```bash
# Install Apache Bench (ab)
sudo apt-get install apache2-utils  # Linux
brew install ab                      # macOS

# Test API performance
ab -n 1000 -c 10 http://localhost:3000/api/catalog/property-types

# Expected results:
# - Requests per second: > 100
# - Mean time per request: < 100ms
# - Failed requests: 0
```

### Log Monitoring

```typescript
// Add to apps/web/src/lib/logger.ts
export function logCatalogAPICall(endpoint: string, duration: number, error?: Error) {
  const log = {
    timestamp: new Date().toISOString(),
    endpoint,
    duration,
    error: error?.message,
  };
  
  if (duration > 1000) {
    console.warn('Slow API call:', log);
  }
  
  if (error) {
    console.error('API error:', log);
  }
}
```

---

## 🔒 Step 7: Security Checklist

- ✅ RLS policies enabled on all catalog tables
- ✅ Service role key kept secret (server-side only)
- ✅ Anon key used in frontend (limited permissions)
- ✅ Rate limiting configured (see `lib/rateLimiter.ts`)
- ✅ Input validation via Zod schemas
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configured properly
- ✅ Sensitive fields hidden (IMEI, serial numbers, cadastral data)

### Test RLS Policies

```sql
-- Test as anonymous user
SET LOCAL ROLE anon;
SELECT * FROM property_listings;  -- Should return only approved

-- Test as authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "test-user-id"}';
SELECT * FROM property_listings WHERE user_id = 'test-user-id';  -- Should work

-- Reset
RESET ROLE;
```

---

## 📈 Step 8: Performance Optimization

### Enable Query Caching

```typescript
// apps/web/src/app/api/catalog/property-types/route.ts
export const revalidate = 3600; // Cache for 1 hour
export const dynamic = 'force-static'; // Pre-render at build time
```

### Database Connection Pooling

Verify in Supabase Dashboard → Database → Configuration:
- Connection pooling: Enabled
- Pool mode: Transaction
- Pool size: 15-20 (adjust based on load)

### CDN Configuration

For Vercel deployment:
```javascript
// vercel.json
{
  "headers": [
    {
      "source": "/api/catalog/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=3600, stale-while-revalidate=86400"
        }
      ]
    }
  ]
}
```

---

## 🚨 Troubleshooting

### Issue: "relation does not exist"
**Solution**: Migrations not applied. Run `npx supabase db push`.

### Issue: "permission denied for table"
**Solution**: Check RLS policies. Use service role for admin operations.

### Issue: "duplicate key value violates unique constraint"
**Solution**: Seed data already loaded. Use `ON CONFLICT DO NOTHING` or truncate first.

### Issue: API returns 500 error
**Solution**:
1. Check Supabase logs (Dashboard → Logs)
2. Verify environment variables
3. Test database connection
4. Check for typos in SQL queries

### Issue: Slow API responses
**Solution**:
1. Check indexes: `EXPLAIN ANALYZE SELECT ...`
2. Enable query caching
3. Use connection pooling
4. Consider adding Redis cache

---

## 📝 Post-Deployment Checklist

- ✅ All migrations applied successfully
- ✅ Dictionary data seeded
- ✅ API endpoints responding (200 status)
- ✅ TypeScript types regenerated
- ✅ RLS policies tested
- ✅ Rate limiting verified
- ✅ Monitoring configured
- ✅ Backup strategy in place
- ✅ Documentation updated
- ✅ Team notified

---

## 🔄 Rollback Plan

If issues arise:

```bash
# Rollback to previous migration
npx supabase db reset --version <previous-migration-version>

# Or manual rollback via SQL (see migration files for rollback scripts)
psql -U postgres -d postgres << 'EOF'
DROP TABLE IF EXISTS property_listings CASCADE;
DROP TABLE IF EXISTS job_listings CASCADE;
-- ... etc
EOF
```

---

## 📚 Next Steps

1. **Frontend Development**
   - Implement PostForm Step 4
   - Create category-specific field components
   - Add search filters

2. **Testing**
   - Write API tests
   - Component tests
   - E2E tests

3. **AI Integration**
   - Implement title generation
   - Fraud detection
   - Photo quality checks

4. **Monitoring**
   - Set up Sentry/error tracking
   - Configure Supabase alerts
   - Dashboard for metrics

---

## 🆘 Support

For issues or questions:
- **Documentation**: `docs/catalog/CATALOG_MASTER.md`
- **Implementation Details**: `docs/catalog/IMPLEMENTATION_SUMMARY.md`
- **Database Strategy**: `docs/catalog/DATABASE_STRATEGY.md`
- **GitHub Issues**: Create issue with `[catalog]` tag

---

**Deployed by**: ___________  
**Deployment Date**: ___________  
**Production URL**: ___________  
**Next Review**: ___________

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) • [CATALOG_MASTER.md](./CATALOG_MASTER.md)
