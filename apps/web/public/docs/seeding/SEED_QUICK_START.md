# 🚀 Quick Start: Populate Development Marketplace

## One-Command Setup

### On Windows (PowerShell)
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process; .\scripts\seed-test-data.ps1
```

### On Mac/Linux/WSL (Bash)
```bash
chmod +x scripts/seed-test-data.sh && ./scripts/seed-test-data.sh
```

### Or just run Node directly (all platforms)
```bash
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

## What You'll Get

✅ **10 test user accounts** with verified/unverified states
✅ **~80 realistic product listings** across 4 categories
✅ **~240 product photos** from Unsplash
✅ **~270 likes** from different users
✅ **Multiple locations** across Belgium

## Test Credentials

All accounts use password: **`TestPassword123!`**

```
anna.brussels@test.com
mark.gent@test.com
lisa.antwerp@test.com
john.charleroi@test.com
emma.liege@test.com
thomas.bruges@test.com
sophie.brussels@test.com
max.liege@test.com
julia.antwerp@test.com
diego.gent@test.com
```

## Start Development

```bash
# Terminal 1: Start database
supabase start

# Terminal 2: Start dev server
pnpm dev
```

Visit **http://localhost:3000** 🎉

## What to Test

1. **Browse marketplace** - See populated listings
2. **Log in** - Try different test accounts
3. **Like items** - Test interaction features
4. **View photos** - Check carousel and lazy loading
5. **Check user roles** - Mix of verified/unverified users

## Reset Data

To clear and re-seed:

```bash
supabase db reset
node scripts/runSeed.mjs scripts/seed-test-data.sql
```

---

## Troubleshooting

**Error: "SUPABASE_SERVICE_ROLE_KEY not set"**
- Make sure `.env.local` exists in root directory
- Contains `SUPABASE_SERVICE_ROLE_KEY=...`

**Error: "permission denied"**
- On Mac/Linux: `chmod +x scripts/seed-test-data.sh`
- On Windows PowerShell: Use the PowerShell script instead

**Data not showing?**
- Restart dev server: `pnpm dev`
- Check browser DevTools Network tab for errors
- Verify listings are in the correct category slug

---

For detailed options and customization, see **[SEED_TEST_DATA_README.md](SEED_TEST_DATA_README.md)**
