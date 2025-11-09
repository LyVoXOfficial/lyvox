@echo off
cd /d "%~dp0"

REM Load environment variables
for /f "tokens=1,2 delims==" %%a in (apps\web\.env.local) do (
    if "%%a"=="GOOGLE_API_KEY" set GOOGLE_API_KEY=%%b
)

echo.
echo ============================================================
echo   Testing Real Prompt from Generation Script
echo ============================================================
echo.

node test-real-prompt.mjs

echo.
pause






