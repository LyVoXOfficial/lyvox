#!/bin/bash
# Monitor progress via Supabase CLI

echo "============================================================"
echo "📊 GENERATION INSIGHTS PROGRESS CHECK"
echo "⏰ Time: $(date)"
echo "============================================================"
echo ""

cd "$(dirname "$0")/.."

# Check total generations
echo "🔍 Checking total generations..."
echo "SELECT COUNT(*) as total FROM vehicle_generations WHERE code IS NOT NULL AND code != '';" | pnpm supabase db execute 2>&1

echo ""
echo "🔍 Checking created insights..."
echo "SELECT COUNT(*) as created FROM vehicle_generation_insights;" | pnpm supabase db execute 2>&1

echo ""
echo "🔍 Checking translations..."
echo "SELECT locale, COUNT(*) FROM vehicle_generation_insights_i18n GROUP BY locale ORDER BY locale;" | pnpm supabase db execute 2>&1

echo ""
echo "============================================================"

