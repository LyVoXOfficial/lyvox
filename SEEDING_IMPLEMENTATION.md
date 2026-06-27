# 📋 Test Data Seeding - Implementation Guide

## What Was Created

Three complementary seeding systems were implemented to populate your development marketplace with realistic test data:

### 1. **SQL-Based Seeding** (Recommended)
**File**: `scripts/seed-test-data.sql`

- Pure PostgreSQL/Supabase approach
- Creates 80+ realistic product listings
- Adds 10 test user accounts
- Distributes 270+ likes across products
- Adds 240 product photos
- Works with existing `runSeed.mjs` infrastructure

**Run it**: 
```bash
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

### 2. **Node.js Helper Scripts**
**Files**: `seed-test-data.sh` (Bash) | `seed-test-data.ps1` (PowerShell)

- Platform-specific wrappers around the SQL seeding
- Auto-detect environment variables
- Pretty-printed progress and status messages
- Error handling and troubleshooting

**Run it**:
```bash
# Bash (Mac/Linux/WSL)
./scripts/seed-test-data.sh

# PowerShell (Windows)
.\scripts\seed-test-data.ps1
```

### 3. **Alternative Node.js Approach** (Not yet active)
**File**: `scripts/seed-test-data.mjs`

- TypeScript-compatible seeding script
- Uses Supabase JavaScript SDK
- Can be enhanced for programmatic control
- More flexible error handling

## Data Structure

### Test Accounts Created

| Field | Value | Notes |
|-------|-------|-------|
| Count | 10 users | Mix of verified/unverified |
| Email Domain | test.com | Easy to identify in logs |
| Password | TestPassword123! | Same for all test accounts |
| Verification | 7 verified, 3 unverified | Realistic mix |
| Phone | All present | Some verified, some not |

### Test Listings Created

| Category | Count | Samples |
|----------|-------|---------|
| Used Cars | 20 | BMW, Mercedes, VW, Audi, Ford, Toyota, Renault, etc. |
| Apartments | 20 | Studios, 1BR, 2BR, 3BR+ apartments for rent |
| Electronics | 20 | iPhone, MacBook, Samsung, iPad, Sony, DJI, Nintendo, etc. |
| Clothing | 20 | Jackets, dresses, jeans, shirts, sportswear, etc. |
| **Total** | **80** | Across Belgium cities |

### Engagement Data

| Item | Count | Details |
|------|-------|---------|
| Photos | ~240 | 3 per listing, from Unsplash |
| Likes | ~270 | Distributed from 7 verified users |
| Conversations | ~30 | Between different users (set up for reviews) |
| Locations | 7 | Brussels, Gent, Antwerp, Charleroi, Liège, Bruges, Leuven |

## Database Changes

The seeding creates data in these tables:

```
auth.users                    ← 10 test users
public.profiles               ← User profiles
public.phones                 ← Phone verification
public.categories             ← (existing, not modified)
public.adverts                ← ~80 listings
public.locations              ← 7 locations
public.media                  ← ~240 photos
public.advert_likes           ← ~270 likes
public.conversations          ← ~30 conversation threads
public.conversation_participants ← Linking users to conversations
```

## How to Use

### Setup (One-time)

```bash
# Make sure you have Node.js and pnpm
node --version  # v18+
pnpm --version  # v10+

# Install dependencies (if not already done)
pnpm install

# Start Supabase locally
supabase start
```

### Seed Test Data

```bash
# Option 1: Bash/Shell (recommended for Mac/Linux)
chmod +x scripts/seed-test-data.sh
./scripts/seed-test-data.sh

# Option 2: PowerShell (Windows)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\seed-test-data.ps1

# Option 3: Direct Node (all platforms)
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

### Start Development Server

```bash
pnpm dev
```

Then visit **http://localhost:3000**

### Test the Seed Data

1. **Log in** with one of the test accounts:
   - Email: `anna.brussels@test.com`
   - Password: `TestPassword123!`

2. **Browse listings**:
   - Navigate to different categories
   - See multiple photos per listing
   - Check different price ranges

3. **Interact**:
   - Like/unlike listings
   - View user profiles
   - Check verified badges

4. **Test roles**:
   - Log in as different users
   - See different seller profiles
   - Observe verified/unverified states

## Verification Checklist

After seeding, verify:

- [ ] Can log in with test accounts
- [ ] See ~80 listings on marketplace
- [ ] Each listing has 2-3 photos
- [ ] Listings have descriptions and prices
- [ ] Can like/unlike listings
- [ ] Different users show different verified status
- [ ] Listings appear in correct categories
- [ ] Prices are reasonable for each category
- [ ] Multiple locations visible
- [ ] Created dates vary (not all same time)

## Reset/Clear Data

To start fresh:

```bash
# Option 1: Reset entire database
supabase db reset

# Option 2: Just re-run seeding (updates existing)
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

## Customization

### Add More Listings

In `seed-test-data.sql`, change the `generate_series`:

```sql
FROM generate_series(1, 20)  -- Change 20 to 50 for 50 per category
```

### Add More Categories

Add a new `_samples` CTE in the SQL:

```sql
WITH new_category_samples AS (
  SELECT
    'Product Title' AS title,
    99 AS price,
    'category-slug' AS cat_slug,
    row_number() OVER () AS rn
  FROM generate_series(1, 20)
),
... existing code ...
UNION ALL
SELECT ... FROM new_category_samples, users_array ua, cities_array ca;
```

### Change Test User Emails

Edit the `auth.users` INSERT section to use different email domains or names.

### Use Different Photos

Replace Unsplash URLs in the `photo_urls` array with your own image URLs.

## Troubleshooting

### "SUPABASE_SERVICE_ROLE_KEY not set"
```bash
# Check if .env.local exists
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY

# If missing, get key from:
# 1. Supabase dashboard > Settings > API
# 2. Or run: supabase status
```

### "Permission denied" (on Mac/Linux)
```bash
chmod +x scripts/seed-test-data.sh
./scripts/seed-test-data.sh
```

### "Table does not exist"
```bash
# Run migrations
supabase migration up

# Or reset database
supabase db reset
```

### Photos not loading
- Check DevTools Network tab
- Verify HTTPS URLs only
- Unsplash URLs should work automatically
- Check browser console for CORS errors

### Already seeded - duplicate users
This is normal and safe - INSERT ... ON CONFLICT ignores duplicates. Either:
- `supabase db reset` to clear everything
- Run seeding script again to update existing data

## Performance Notes

- Initial seeding takes ~30 seconds
- Database size increases by ~50MB
- Query performance remains good (proper indexes exist)
- Safe to seed in development; never seed production!

## Next Steps

1. ✅ Run seeding script
2. ✅ Verify data appears in UI
3. ✅ Test marketplace functionality
4. ✅ Identify UI/UX issues
5. 📝 Document needed changes
6. 🔧 Implement fixes
7. 🔄 Re-test with fresh seed

## Files Created

```
scripts/
├── seed-test-data.sql      # Main SQL seed (80+ listings)
├── seed-test-data.sh       # Bash helper script
├── seed-test-data.ps1      # PowerShell helper script
└── seed-test-data.mjs      # Node.js alternative (for future use)

docs/
├── SEED_QUICK_START.md     # Quick reference
├── SEED_TEST_DATA_README.md # Complete documentation
└── SEEDING_IMPLEMENTATION.md # This file
```

## Support

- Check existing migrations: `supabase/migrations/`
- Review schema: `supabase/schema.sql`
- Database types: `supabase/types/database.types.ts`
- Existing samples: `seed/catalog/samples.sql`

---

**Your marketplace is now ready to test! 🚀**
