#!/bin/bash
# Helper script to seed test data into the marketplace

set -e

echo "🌱 Seeding test data..."

# Run the SQL seed script
if [ ! -f "scripts/runSeed.mjs" ]; then
  echo "❌ Error: scripts/runSeed.mjs not found"
  exit 1
fi

if [ ! -f "scripts/seed-test-data.sql" ]; then
  echo "❌ Error: scripts/seed-test-data.sql not found"
  exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not set, trying to load from .env"
  if [ -f ".env.local" ]; then
    export $(grep SUPABASE_SERVICE_ROLE_KEY .env.local | xargs)
  fi
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY env variable not set"
  exit 1
fi

echo "📊 Running SQL seed script..."
node scripts/runSeed.mjs scripts/seed-test-data.sql

echo ""
echo "✨ Test data seeding complete!"
echo ""
echo "Test account credentials:"
echo "  Email: anna.brussels@test.com"
echo "  Email: mark.gent@test.com"
echo "  Email: lisa.antwerp@test.com"
echo "  Email: john.charleroi@test.com"
echo "  Email: emma.liege@test.com"
echo "  Email: thomas.bruges@test.com"
echo "  Email: sophie.brussels@test.com"
echo "  Email: max.liege@test.com"
echo "  Email: julia.antwerp@test.com"
echo "  Email: diego.gent@test.com"
echo ""
echo "  Password: TestPassword123!"
echo ""
echo "📊 Seeding statistics:"
echo "  ✅ 10 test users created"
echo "  ✅ ~80 adverts created (cars, apartments, electronics, clothing)"
echo "  ✅ ~240 photos added"
echo "  ✅ ~270 likes distributed"
echo ""
echo "Visit http://localhost:3000 to see the populated marketplace!"
