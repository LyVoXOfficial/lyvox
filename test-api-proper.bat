@echo off
cd /d "%~dp0"
set DATABASE_URL=postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres

REM Load GOOGLE_API_KEY from .env.local
for /f "tokens=1,2 delims==" %%a in (apps\web\.env.local) do (
    if "%%a"=="GOOGLE_API_KEY" set GOOGLE_API_KEY=%%b
)

echo.
echo Testing Google API with key: %GOOGLE_API_KEY%
echo.

node -e "const key = process.env.GOOGLE_API_KEY; fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=' + key, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contents: [{parts: [{text: 'Say hello'}]}], generationConfig: {temperature: 0.7, maxOutputTokens: 100}})}).then(async r => {console.log('Status:', r.status); const data = await r.json(); if(r.status === 200) {console.log('SUCCESS! API key works!'); console.log('Response:', data.candidates[0].content.parts[0].text);} else {console.log('FAILED!'); console.log(JSON.stringify(data, null, 2));}}).catch(e => console.error('Error:', e.message));"

echo.
pause





