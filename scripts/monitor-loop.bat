@echo off
REM Auto-monitor generation insights progress every 30 minutes
REM Run this script to start automatic monitoring

cd /d "%~dp0\.."

echo ============================================================
echo AUTOMATIC MONITORING STARTED
echo Will check progress every 30 minutes
echo Press Ctrl+C to stop
echo ============================================================
echo.

:LOOP
echo.
echo [%date% %time%] Running progress check...
node scripts/monitor-progress.mjs

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo SUCCESS! 100%% COMPLETE! Stopping monitoring.
    echo ============================================================
    goto END
)

echo.
echo Waiting 30 minutes for next check...
timeout /t 1800 /nobreak >nul
goto LOOP

:END
echo Monitoring complete.
pause

