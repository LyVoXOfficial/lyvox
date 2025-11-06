@echo off
cd /d "%~dp0"
set DATABASE_URL=postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres
node scripts/check-db-structure.mjs



