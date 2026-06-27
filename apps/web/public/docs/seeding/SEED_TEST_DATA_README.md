# 🌱 Seeding Test Data for Development

This guide shows how to populate your local development marketplace with realistic test data: fake users, listings, photos, likes, and reviews.

## Quick Start

### Option 1: Bash/Unix (Mac, Linux, WSL)
```bash
chmod +x scripts/seed-test-data.sh
./scripts/seed-test-data.sh
```

### Option 2: PowerShell (Windows)
```powershell
# From the root directory
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\seed-test-data.ps1
```

### Option 3: Direct Node Command
```bash
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

## What Gets Created

### 10 Test Users
All test users use the password: **`TestPassword123!`**

| Email | Name | Phone | Verified |
|-------|------|-------|----------|
| anna.brussels@test.com | Анна из Брюсселя | +32487123456 | ✅ Yes |
| mark.gent@test.com | Марк из Гента | +32498765432 | ✅ Yes |
| lisa.antwerp@test.com | Лиза из Антверпена | +32470555666 | ✅ Yes |
| john.charleroi@test.com | Джон из Шарлеруа | +32491234567 | ❌ No |
| emma.liege@test.com | Эмма из Льежа | +32476789012 | ✅ Yes |
| thomas.bruges@test.com | Томас из Брюгге | +32481234567 | ✅ Yes |
| sophie.brussels@test.com | Софи из Брюсселя | +32486543210 | ❌ No |
| max.liege@test.com | Макс из Льежа | +32479876543 | ✅ Yes |
| julia.antwerp@test.com | Юлия из Антверпена | +32488888888 | ✅ Yes |
| diego.gent@test.com | Диего из Гента | +32477777777 | ✅ Yes |

### Sample Listings
- **80+ adverts** created across different categories
  - 20 used cars (BMW, Mercedes, VW, Audi, etc.)
  - 20 apartments for rent
  - 20 electronics (iPhone, MacBook, Galaxy, etc.)
  - 20 clothing items (dresses, jackets, etc.)
  
### Media & Engagement
- **~240 photos** added (3 photos per listing)
- **~270 likes** distributed across listings from different users
- **Conversations** created between buyers and sellers for interactions
- **Multiple user perspectives** - different verified/unverified states

## Environment Setup

### Prerequisites
1. Local Supabase instance running (via `supabase start`)
2. `.env.local` file with Supabase credentials
3. Node.js and pnpm installed

### Required Environment Variables
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_DB_HOST=db.xxxxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
```

The scripts automatically check `.env.local` for these variables.

## Testing the Seed Data

After seeding, start the development server:

```bash
pnpm dev
```

Visit http://localhost:3000 and:

1. **Browse listings** - See the populated marketplace
2. **Log in with test accounts** - Try different user accounts
3. **Test interactions** - Like/unlike listings, view photos, etc.
4. **Check different roles** - Some users have verified email/phone, some don't

## Customization

### Adding More Listings
Edit `scripts/seed-test-data.sql` and increase the `LIMIT` values:

```sql
FROM generate_series(1, 20)  -- Change 20 to desired count
```

### Adding Different Categories
The current script seeds cars and apartments. To add more:

1. Find category slug from `public.categories`
2. Add a new `WITH ... AS` section in the SQL
3. Add corresponding sample titles and prices

Example:
```sql
WITH electronics_samples AS (
  SELECT
    'iPhone 13 Pro • 256GB • Space Gray' AS title,
    650 AS price,
    ...
)
INSERT INTO public.adverts (...)
SELECT ... FROM electronics_samples;
```

### Modifying Test User Data
Edit the `auth.users` INSERT statement to create different users.

### Changing Photos
Replace the photo URLs in the `photo_urls` VALUES section with your own image URLs.

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY not set"
- Make sure `.env.local` exists in the root directory
- Check that `SUPABASE_SERVICE_ROLE_KEY` is defined in the file
- On Windows, you may need to escape special characters

### Error: "table ... does not exist"
- Run migrations first: `supabase migration up`
- Or start fresh: `supabase stop && supabase start`

### Error: "unique constraint violation"
- Test data already exists
- You can safely run the script multiple times (INSERT ... ON CONFLICT)
- To reset, run: `supabase db reset`

### Photos not showing
- Verify the image URLs are accessible (HTTPS only)
- Check network tab in DevTools
- Unsplash URLs used in the script are public and should work

## Database Structure

The seeding creates data in these tables:
- `auth.users` - Authentication records
- `public.profiles` - User profiles
- `public.phones` - Phone numbers (verified/unverified)
- `public.adverts` - Listings/announcements
- `public.locations` - Location data
- `public.media` - Photos for listings
- `public.advert_likes` - Likes on listings
- `public.conversations` - Chat conversations

## Best Practices

1. **Use in development only** - Never run this on production!
2. **Reset frequently** - Use `supabase db reset` to clear and reseed
3. **Test edge cases** - Mix of verified/unverified users, different statuses
4. **Monitor performance** - Track query performance with seeded data
5. **Backup before changes** - Snapshot your DB before experimenting

## Manual Data Entry

For more control, you can manually:

```sql
-- Create a new user
INSERT INTO auth.users (email, ...) VALUES (...);

-- Create a listing
INSERT INTO public.adverts (user_id, category_id, title, ...) VALUES (...);

-- Add a photo
INSERT INTO public.media (advert_id, url) VALUES (...);

-- Add a like
INSERT INTO public.advert_likes (user_id, advert_id) VALUES (...);
```

## Advanced: Custom Seed Script

For more control, edit `scripts/seed-test-data.sql` directly or create your own TypeScript version using `scripts/seed-test-data.mjs` as a template.

The `.mjs` version has more flexibility:
- Programmatic user creation via Supabase Auth API
- Dynamic data generation
- Better error handling
- Batch operations

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL INSERT Documentation](https://www.postgresql.org/docs/current/sql-insert.html)
- [LyVoX Database Schema](supabase/schema.sql)

## Questions?

Check the `.claude/` directory for project context and memory about the marketplace design.

---

**Happy seeding! 🌱** Your development marketplace is now ready for testing.
