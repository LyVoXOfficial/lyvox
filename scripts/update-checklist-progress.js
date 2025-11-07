#!/usr/bin/env node
/**
 * Скрипт для автоматического обновления прогресса в MASTER_CHECKLIST.md
 * Запуск: node scripts/update-checklist-progress.js
 */

const fs = require('fs');
const path = require('path');

const checklistPath = path.join(__dirname, '../docs/development/MASTER_CHECKLIST.md');

function updateProgress() {
  const content = fs.readFileSync(checklistPath, 'utf-8');
  
  // Подсчет выполненных задач ([x])
  const completedMatches = content.match(/^\s*- \[x\]/gm);
  const completed = completedMatches ? completedMatches.length : 0;
  
  // Подсчет задач в процессе ([~])
  const inProgressMatches = content.match(/^\s*- \[~\]/gm);
  const inProgress = inProgressMatches ? inProgressMatches.length : 0;
  
  // Поиск первых невыполненных задач (ищем - [ ] **ID-***)
  const nextTasks = [];
  const taskPattern = /^\s*- \[ \]\s+\*\*([A-Z]+-\d+)\*\*:/gm;
  let match;
  let count = 0;
  
  while ((match = taskPattern.exec(content)) !== null && count < 5) {
    nextTasks.push(match[1]);
    count++;
  }
  
  // Обновление блока прогресса
  const progressBlock = `## 📈 Прогресс выполнения

> **Примечание:** Этот блок обновляется автоматически при изменении чекбоксов в файле.

✅ **Completed:** ${completed}/150

⏳ **In progress:** ${inProgress}

📌 **Next:** ${nextTasks.join(', ')}`;

  // Замена существующего блока прогресса
  const progressPattern = /## 📈 Прогресс выполнения[\s\S]*?(?=---|\n## |$)/;
  const updatedContent = content.replace(progressPattern, progressBlock + '\n\n---');
  
  fs.writeFileSync(checklistPath, updatedContent, 'utf-8');
  
  console.log(`✅ Progress updated: ${completed} completed, ${inProgress} in progress`);
  console.log(`📌 Next tasks: ${nextTasks.join(', ')}`);
}

updateProgress();






