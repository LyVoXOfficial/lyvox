@echo off
cd /d "%~dp0"

REM Load GOOGLE_API_KEY from .env.local
for /f "tokens=1,2 delims==" %%a in (apps\web\.env.local) do (
    if "%%a"=="GOOGLE_API_KEY" set GOOGLE_API_KEY=%%b
)

echo.
echo ============================================================
echo   Checking Google AI API Quota and Error Details
echo ============================================================
echo.
echo API Key: %GOOGLE_API_KEY%
echo.

node -e "const key = process.env.GOOGLE_API_KEY; const models = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']; async function test() { for (const model of models) { console.log(`\nTesting: ${model}`); const r = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contents: [{parts: [{text: 'Test'}]}], generationConfig: {temperature: 0.7, maxOutputTokens: 50}})}); const data = await r.json(); console.log(`Status: ${r.status}`); if (r.status !== 200) { console.log('Error:', JSON.stringify(data, null, 2)); } else { console.log('SUCCESS!'); } await new Promise(resolve => setTimeout(resolve, 1000)); } } test();"

echo.
pause








