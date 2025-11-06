# Catalog Seed Data

This directory contains seed SQL scripts for populating catalog dictionaries and sample data.

## Prerequisites

1. ✅ All catalog migrations must be applied first
2. ✅ Database connection configured
3. ✅ Test user accounts created (for samples)

## Seed Files

### 1. Dictionary Data (Required)

These files populate reference tables with standardized values:

| File | Description | Depends On |
|------|-------------|------------|
| `device_brands.sql` | Electronics brands (Apple, Samsung, etc.) | `20251105215000_electronics_extended.sql` |
| `property_types.sql` | Real estate types (apartment, house, etc.) | `20251105213527_catalog_dictionaries.sql` |
| `epc_ratings.sql` | Belgium EPC energy ratings (A++ to G) | `20251105213527_catalog_dictionaries.sql` |
| `cp_codes.sql` | Belgium CP employment codes | `20251105213527_catalog_dictionaries.sql` |
| `job_contract_types.sql` | Job contract types (CDI, CDD, etc.) | `20251105213527_catalog_dictionaries.sql` |
| `job_categories.sql` | Job categories (IT, Healthcare, etc.) | `20251105213527_catalog_dictionaries.sql` |

### 2. Sample Data (Optional)

| File | Description | Depends On |
|------|-------------|------------|
| `samples.sql` | Realistic sample adverts for testing | All dictionary seeds + test users |

## Installation

### Option 1: Manual (Supabase Dashboard)

1. Go to Supabase Dashboard → SQL Editor
2. Copy-paste each file content
3. Run in order (dictionaries first, then samples)

### Option 2: psql Command Line

```bash
# Set your Supabase connection details
export PGHOST="db.xxxxx.supabase.co"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="postgres"
export PGPASSWORD="your-password"

# Navigate to seed/catalog directory
cd seed/catalog

# Run dictionary seeds (order doesn't matter within this group)
psql -f device_brands.sql
psql -f property_types.sql
psql -f epc_ratings.sql
psql -f cp_codes.sql
psql -f job_contract_types.sql
psql -f job_categories.sql

# Run samples (optional, requires test users)
psql -f samples.sql
```

### Option 3: Automated Script (Recommended)

```bash
# From project root
chmod +x seed/catalog/seed-all.sh
./seed/catalog/seed-all.sh
```

## Verification

After seeding, verify data:

```sql
-- Check device brands
SELECT COUNT(*) FROM public.device_brands; -- Should be ~38

-- Check property types
SELECT COUNT(*) FROM public.property_types; -- Should be ~24

-- Check EPC ratings
SELECT COUNT(*) FROM public.epc_ratings; -- Should be 9

-- Check CP codes
SELECT COUNT(*) FROM public.cp_codes; -- Should be ~30

-- Check job categories
SELECT COUNT(*) FROM public.job_categories; -- Should be 25

-- Check job contract types
SELECT COUNT(*) FROM public.job_contract_types; -- Should be 11

-- Check sample adverts (if loaded)
SELECT COUNT(*) FROM public.adverts WHERE title LIKE '%Sample%' OR title LIKE '%Modern 2BR%';
```

## Customization

### Adding New Brands

Edit `device_brands.sql`:

```sql
INSERT INTO public.device_brands (slug, name, device_types, sort_order) VALUES
  ('your-brand', 'Your Brand', ARRAY['phone', 'laptop'], 100);
```

### Adding New Property Types

Edit `property_types.sql`:

```sql
INSERT INTO public.property_types (slug, name_nl, name_fr, name_en, name_de, name_ru, category, sort_order) VALUES
  ('your-type', 'Nederlands', 'Français', 'English', 'Deutsch', 'Русский', 'residential', 100);
```

### Adding New CP Codes

Edit `cp_codes.sql`:

```sql
INSERT INTO public.cp_codes (code, name_nl, name_fr, name_en, sector) VALUES
  ('PC999', 'Sector NL', 'Secteur FR', 'Sector EN', 'industry');
```

## Production Considerations

⚠️ **IMPORTANT**: Sample data is for development/testing only!

For production:
1. ✅ Load dictionary seeds (required)
2. ❌ Skip sample adverts
3. ✅ Use real user-generated content
4. ✅ Implement proper data governance

## Cleanup

To remove all seed data:

```sql
-- Remove sample adverts (and cascading to property_listings, job_listings, etc.)
DELETE FROM public.adverts WHERE created_at > '2025-11-05' AND user_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

-- To remove dictionary data (CAREFUL - only if starting fresh):
-- TRUNCATE public.device_brands CASCADE;
-- TRUNCATE public.property_types CASCADE;
-- TRUNCATE public.epc_ratings CASCADE;
-- TRUNCATE public.cp_codes CASCADE;
-- TRUNCATE public.job_categories CASCADE;
-- TRUNCATE public.job_contract_types CASCADE;
```

## Troubleshooting

### "relation does not exist"
- Ensure migrations are applied first
- Check migration order (dictionaries before specialized tables)

### "duplicate key value violates unique constraint"
- Seeds already loaded
- Use `ON CONFLICT DO NOTHING` in INSERT statements

### "foreign key violation"
- Load dictionaries before samples
- Verify test user UUIDs exist

### "permission denied"
- Check RLS policies
- Ensure you're using service role key (for seeding) or have proper permissions

## Updates

When updating seed data:

1. Update the SQL file
2. Add migration number/date to comments
3. Test on dev environment first
4. Document breaking changes
5. Update this README

## Support

For issues:
- Check `docs/catalog/DATABASE_STRATEGY.md`
- Review migration files in `supabase/migrations/`
- See `docs/catalog/IMPLEMENTATION_SUMMARY.md`

---

**Last Updated**: 2025-11-05  
**Maintained By**: Development Team

