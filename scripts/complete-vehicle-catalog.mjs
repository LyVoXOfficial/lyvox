#!/usr/bin/env node
/**
 * Master-скрипт для завершения каталога
 * Выполняет все шаги по порядку
 */
import { spawn } from 'child_process';
import fs from 'fs';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.env.DRY_RUN === 'true';
const SKIP_AUDIT = process.env.SKIP_AUDIT === 'true';
const SKIP_INSIGHTS = process.env.SKIP_INSIGHTS === 'true';
const SKIP_SCORES = process.env.SKIP_SCORES === 'true';
const SKIP_ARRAYS = process.env.SKIP_ARRAYS === 'true';
const SKIP_I18N = process.env.SKIP_I18N === 'true';
const SKIP_MERGE = process.env.SKIP_MERGE === 'true';
const SKIP_AGGREGATES = process.env.SKIP_AGGREGATES === 'true';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL required');
  process.exit(1);
}

if (!GOOGLE_API_KEY && !DRY_RUN && (!SKIP_INSIGHTS || !SKIP_SCORES || !SKIP_ARRAYS)) {
  console.error('❌ GOOGLE_API_KEY required for AI operations (or use DRY_RUN=true)');
  process.exit(1);
}

function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${description}`);
    console.log('═'.repeat(60) + '\n');
    
    const proc = spawn('node', [scriptPath], { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    proc.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'Завершение каталога транспорта' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY_RUN режим активен - изменения не будут применены\n');
  }

  const steps = [];

  // Шаг 1: Аудит
  if (!SKIP_AUDIT) {
    steps.push({
      script: 'scripts/audit-full-coverage.mjs',
      description: '📊 Шаг 1: Аудит покрытия данных',
      required: true
    });
  }

  // Шаг 2: Заполнение insights
  if (!SKIP_INSIGHTS) {
    steps.push({
      script: 'scripts/fill-missing-insights.mjs',
      description: '🤖 Шаг 2: Заполнение недостающих insights',
      required: false
    });
  }

  // Шаг 3: Заполнение оценок
  if (!SKIP_SCORES) {
    steps.push({
      script: 'scripts/fill-model-scores.mjs',
      description: '🎯 Шаг 3: Заполнение reliability/popularity scores',
      required: false
    });
  }

  // Шаг 4: Заполнение пустых массивов
  if (!SKIP_ARRAYS) {
    steps.push({
      script: 'scripts/backfill-insight-arrays.mjs',
      description: '📝 Шаг 4: Заполнение пустых массивов в insights',
      required: false
    });
  }

  // Шаг 5: Обновление переводов
  if (!SKIP_I18N) {
    steps.push({
      script: 'scripts/update-i18n.mjs',
      description: '🌍 Шаг 5: Обновление переводов',
      required: false
    });
  }

  // Шаг 6: Слияние дубликатов
  if (!SKIP_MERGE) {
    steps.push({
      script: 'scripts/merge-duplicate-models.mjs',
      description: '🔗 Шаг 6: Слияние дубликатов',
      required: false
    });
  }

  // Шаг 7: Обновление агрегатов
  if (!SKIP_AGGREGATES) {
    steps.push({
      script: 'scripts/update-model-aggregates.mjs',
      description: '🔄 Шаг 7: Обновление агрегатных полей',
      required: false
    });
  }

  // Шаг 8: Финальный аудит
  if (!SKIP_AUDIT) {
    steps.push({
      script: 'scripts/audit-full-coverage.mjs',
      description: '📊 Шаг 8: Финальный аудит',
      required: true
    });
  }

  console.log(`📋 Запланировано шагов: ${steps.length}\n`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      await runScript(step.script, step.description);
      console.log(`\n✅ Шаг ${i + 1}/${steps.length} завершён`);
    } catch (err) {
      console.error(`\n❌ Шаг ${i + 1}/${steps.length} завершился с ошибкой:`, err.message);
      if (step.required) {
        console.error('⚠️  Это критический шаг, останавливаем процесс.');
        process.exit(1);
      } else {
        console.log('⚠️  Продолжаем выполнение...');
      }
    }
  }

  // Генерация финального отчёта
  console.log('\n' + '═'.repeat(60));
  console.log('  📄 Генерация финального отчёта');
  console.log('═'.repeat(60) + '\n');

  if (fs.existsSync('audit-report.json')) {
    const report = JSON.parse(fs.readFileSync('audit-report.json', 'utf8'));
    
    let markdown = `# Финальный отчёт: Завершение каталога транспорта\n\n`;
    markdown += `Дата: ${new Date().toISOString()}\n\n`;
    markdown += `## Сводка\n\n`;
    markdown += `- Марок: ${report.summary.makes_count}\n`;
    markdown += `- Моделей: ${report.summary.models_count}\n`;
    markdown += `- Поколений: ${report.summary.generations_count}\n`;
    markdown += `- Инсайтов: ${report.summary.insights_count}\n\n`;
    
    markdown += `## Проблемы\n\n`;
    markdown += `### Модели без insights\n\n`;
    markdown += `Количество: ${report.issues.models_without_insights.length}\n\n`;
    
    if (report.issues.models_without_insights.length > 0) {
      markdown += `<details>\n<summary>Список (первые 50)</summary>\n\n`;
      report.issues.models_without_insights.slice(0, 50).forEach(m => {
        markdown += `- ${m.make_slug} / ${m.slug} (${m.name_en})\n`;
      });
      markdown += `\n</details>\n\n`;
    }
    
    markdown += `### Модели без оценок\n\n`;
    markdown += `Количество: ${report.issues.missing_scores.length}\n\n`;
    
    markdown += `### Пустые массивы\n\n`;
    for (const [column, rows] of Object.entries(report.issues.empty_arrays || {})) {
      markdown += `- ${column}: ${rows.length} моделей\n`;
    }
    markdown += `\n`;
    
    markdown += `### Дубликаты\n\n`;
    markdown += `Групп дубликатов: ${report.issues.duplicates.length}\n\n`;
    
    markdown += `### Переводы\n\n`;
    const i18n = report.issues.missing_translations;
    markdown += `Модели без переводов: ${i18n.models_without_any_translation.length}\n\n`;
    markdown += `#### По языкам\n\n`;
    markdown += `Марки:\n`;
    for (const [locale, count] of Object.entries(i18n.summary.makes)) {
      markdown += `- ${locale}: ${count}\n`;
    }
    markdown += `\nМодели:\n`;
    for (const [locale, count] of Object.entries(i18n.summary.models)) {
      markdown += `- ${locale}: ${count}\n`;
    }
    markdown += `\nПоколения:\n`;
    for (const [locale, count] of Object.entries(i18n.summary.generations)) {
      markdown += `- ${locale}: ${count}\n`;
    }
    
    const reportPath = 'docs/development/VEHICLE_SYNC_FINAL_REPORT.md';
    const dir = 'docs/development';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(reportPath, markdown, 'utf8');
    console.log(`✅ Отчёт сохранён: ${reportPath}`);
  }

  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(17) + '✅ Процесс завершён!' + ' '.repeat(18) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');
}

main().catch(err => {
  console.error('\n❌ Критическая ошибка:', err);
  process.exit(1);
});

