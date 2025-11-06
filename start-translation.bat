@echo off
cd /d "%~dp0"
set GOOGLE_API_KEY=AIzaSyBCohDBDATpf3b5RwHYuq9LtLo56EiowjA
set DATABASE_URL=postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres
title Translations
echo.
echo ============================================================
echo   TRANSLATIONS - Running
echo ============================================================
echo.
node scripts/translate-generation-insights.mjs

