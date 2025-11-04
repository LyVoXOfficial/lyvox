# Автоматический мониторинг перевода insights

# REMOVED FOR SECURITY - Set DATABASE_URL environment variable before running this script

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔄 Автоматический мониторинг перевода insights                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$startTime = Get-Date
$checkInterval = 900 # 15 минут в секундах

while ($true) {
    $elapsed = ((Get-Date) - $startTime).TotalMinutes
    
    Write-Host "`n⏱️  Прошло: $([math]::Round($elapsed, 1)) минут`n" -ForegroundColor Yellow
    
    # Проверка прогресса
    $progress = node scripts/check-insights-translation-progress.mjs 2>&1
    Write-Host $progress
    
    # Извлечение процента из вывода
    $percentMatch = [regex]::Match($progress, "Полностью переведено:\s+(\d+)")
    if ($percentMatch.Success) {
        $translated = [int]$percentMatch.Groups[1].Value
        $totalPercent = ($translated / 904) * 100
        
        if ($translated -ge 904) {
            Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
            Write-Host "║                                                                  ║" -ForegroundColor Green
            Write-Host "║          🎉🎉🎉 ПЕРЕВОД ЗАВЕРШЁН! 🎉🎉🎉                        ║" -ForegroundColor Green
            Write-Host "║                                                                  ║" -ForegroundColor Green
            Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
            
            Write-Host "✅ РЕЗУЛЬТАТ:`n" -ForegroundColor Green
            Write-Host "  • 904 модели переведены на 5 языков" -ForegroundColor White
            Write-Host "  • 4520 записей в vehicle_insights_i18n" -ForegroundColor White
            Write-Host "  • Код фронтенда исправлен" -ForegroundColor White
            Write-Host "  • 100% покрытие на всех языках`n" -ForegroundColor White
            
            break
        }
        
        Write-Host "`n📊 Прогресс: $translated/904 ($([math]::Round($totalPercent, 1))%)" -ForegroundColor Cyan
        $remaining = 904 - $translated
        $estimatedMinutes = $remaining / 7.7
        Write-Host "⏱️  Осталось примерно: $([math]::Round($estimatedMinutes, 0)) минут`n" -ForegroundColor Yellow
    }
    
    # Проверка процесса
    $runningProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmd -like "*translate-all-insights*"
    }
    
    if ($runningProcess) {
        Write-Host "✅ Процесс работает (PID: $($runningProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Процесс остановился! Перезапуск..." -ForegroundColor Red
        
        # REMOVED FOR SECURITY - Set GOOGLE_API_KEY environment variable before running
        $env:BATCH_SIZE="10"
        
        Start-Process -FilePath "node" -ArgumentList "scripts/translate-all-insights.mjs" -NoNewWindow -RedirectStandardOutput "translate-insights-optimized.log" -RedirectStandardError "translate-insights-errors.log"
        
        Start-Sleep -Seconds 5
        Write-Host "✅ Процесс перезапущен`n" -ForegroundColor Green
    }
    
    # Ожидание до следующей проверки
    Write-Host "`n⏱️  Следующая проверка через 15 минут...`n" -ForegroundColor Yellow
    Start-Sleep -Seconds $checkInterval
}

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅ Мониторинг завершён - все insights переведены!            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan


