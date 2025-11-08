@echo off
echo.
echo ============================================================
echo   TEST NEW GOOGLE API KEY
echo ============================================================
echo.
echo After you regenerate the key:
echo 1. Update apps\web\.env.local with NEW key
echo 2. Run this file to test
echo.
pause
echo.
echo Testing API key...
echo.

cd /d "%~dp0"
set DATABASE_URL=postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres

REM Load GOOGLE_API_KEY from .env.local
for /f "tokens=1,2 delims==" %%a in (apps\web\.env.local) do (
    if "%%a"=="GOOGLE_API_KEY" set GOOGLE_API_KEY=%%b
)

echo Your API key: %GOOGLE_API_KEY%
echo.

node -e "fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=' + process.env.GOOGLE_API_KEY, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contents: [{parts: [{text: 'Test'}]}]})}).then(r => {console.log('Status:', r.status); if(r.status === 200) {console.log('SUCCESS! API key works!');} else {console.log('FAILED! Status:', r.status);}}).catch(e => console.error('Error:', e.message));"

echo.
pause





