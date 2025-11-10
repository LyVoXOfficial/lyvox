#!/usr/bin/env node

/**
 * i18n Hardcoded Strings Auditor
 * 
 * This script finds all hardcoded strings in TSX/TS files that should be translated.
 * It scans for string literals that are not using t() function.
 * 
 * Usage: node scripts/audit-i18n-strings.mjs [--fix]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../apps/web/src');
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /\.git/,
  /types\.ts$/,
  /\.d\.ts$/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
];

// Patterns to exclude (technical strings, imports, etc.)
const EXCLUDE_STRING_PATTERNS = [
  /^(import|export|from|const|let|var|function|class|interface|type|enum)/,
  /^(http|https|mailto|tel):/,
  /^[a-z]+:\/\//,
  /^[A-Z_][A-Z0-9_]*$/, // Constants like API_KEY
  /^[a-z]+-[a-z]+(-[a-z]+)*$/, // kebab-case (likely CSS classes or IDs)
  /^\d+$/, // Numbers
  /^['"]\s*$/, // Empty strings
  /^(true|false|null|undefined)$/,
  /^(className|id|href|src|alt|aria-|data-|role|type|name|value|key|ref)/,
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/,
  /^(console\.|process\.|window\.|document\.)/,
  /^(use client|use server)/,
  /^['"]\/[^'"]*['"]$/, // Paths like "/api/..."
  /^['"]#[^'"]*['"]$/, // Hash links
  /^['"]\w+:\/\/[^'"]*['"]$/, // URLs
  /^['"]\$\{[^}]+\}[^'"]*['"]$/, // Template literals with ${}
];

// Files that are known to have hardcoded strings (will be checked)
const KNOWN_FILES = [
  'apps/web/src/app/admin/reports/page.tsx',
];

/**
 * Check if a string should be excluded from audit
 */
function shouldExcludeString(str, context) {
  const trimmed = str.trim();
  
  // Too short or empty
  if (trimmed.length < 2) return true;
  
  // Check patterns
  for (const pattern of EXCLUDE_STRING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // Check if it's already using t() function
  if (context.includes('t(') || context.includes('useI18n')) return true;
  
  // Check if it's a comment
  if (context.trim().startsWith('//') || context.trim().startsWith('/*')) return true;
  
  // Check if it's in a console.log or similar
  if (/console\.(log|error|warn|info|debug)/.test(context)) return true;
  
  // Check if it's a regex pattern
  if (context.includes('/') && context.includes(str)) {
    const beforeStr = context.substring(0, context.indexOf(str));
    if (beforeStr.trim().endsWith('/')) return true;
  }
  
  return false;
}

/**
 * Find all string literals in a file
 */
function findHardcodedStrings(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  
  // Pattern to match string literals: "..." or '...'
  const stringPattern = /(['"])((?:(?!\1)[^\\]|\\.)*?)\1/g;
  
  lines.forEach((line, lineNum) => {
    let match;
    const lineIndex = lineNum + 1;
    
    // Reset regex
    stringPattern.lastIndex = 0;
    
    while ((match = stringPattern.exec(line)) !== null) {
      const fullMatch = match[0];
      const stringContent = match[2];
      
      // Get context (50 chars before and after)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(line.length, match.index + fullMatch.length + 50);
      const context = line.substring(start, end);
      
      if (!shouldExcludeString(stringContent, context)) {
        // Check if it looks like user-facing text
        const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(stringContent);
        const hasSpaces = /\s/.test(stringContent);
        const isLongEnough = stringContent.length > 3;
        
        if (hasLetters && (hasSpaces || isLongEnough)) {
          issues.push({
            file: filePath,
            line: lineIndex,
            column: match.index + 1,
            string: stringContent,
            fullLine: line.trim(),
            context: context.trim(),
          });
        }
      }
    }
  });
  
  return issues;
}

/**
 * Recursively find all TS/TSX files
 */
function findSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Check if directory should be excluded
      const shouldExclude = EXCLUDE_PATTERNS.some(pattern => 
        pattern.test(filePath)
      );
      
      if (!shouldExclude) {
        findSourceFiles(filePath, fileList);
      }
    } else if (stat.isFile()) {
      // Check if file should be excluded
      const shouldExclude = EXCLUDE_PATTERNS.some(pattern => 
        pattern.test(filePath)
      );
      
      if (!shouldExclude && /\.(tsx?|jsx?)$/.test(file)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Scanning for hardcoded strings...\n');
  
  const files = findSourceFiles(SRC_DIR);
  console.log(`📁 Found ${files.length} source files\n`);
  
  const allIssues = [];
  
  files.forEach(file => {
    try {
      const issues = findHardcodedStrings(file);
      if (issues.length > 0) {
        allIssues.push(...issues);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  // Group by file
  const issuesByFile = {};
  allIssues.forEach(issue => {
    const relPath = path.relative(process.cwd(), issue.file);
    if (!issuesByFile[relPath]) {
      issuesByFile[relPath] = [];
    }
    issuesByFile[relPath].push(issue);
  });
  
  // Print results
  console.log('━'.repeat(80));
  console.log(`📊 Found ${allIssues.length} potential hardcoded strings\n`);
  
  if (allIssues.length === 0) {
    console.log('✅ No hardcoded strings found! All strings are using i18n.\n');
    return;
  }
  
  // Print by file
  Object.entries(issuesByFile)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([file, issues]) => {
      console.log(`\n📄 ${file} (${issues.length} issues)`);
      console.log('─'.repeat(80));
      
      issues.slice(0, 20).forEach(issue => {
        console.log(`  Line ${issue.line}:${issue.column}`);
        console.log(`  ${issue.fullLine}`);
        console.log(`  String: "${issue.string}"`);
        console.log('');
      });
      
      if (issues.length > 20) {
        console.log(`  ... and ${issues.length - 20} more issues\n`);
      }
    });
  
  // Summary
  console.log('\n━'.repeat(80));
  console.log(`\n📈 Summary:`);
  console.log(`   Total files with issues: ${Object.keys(issuesByFile).length}`);
  console.log(`   Total hardcoded strings: ${allIssues.length}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review the strings above`);
  console.log(`   2. Add translations to apps/web/src/i18n/locales/*.json`);
  console.log(`   3. Replace hardcoded strings with t('key') calls`);
  console.log(`\n`);
  
  // Write report to file
  const reportPath = path.join(__dirname, '../i18n-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalIssues: allIssues.length,
    filesWithIssues: Object.keys(issuesByFile).length,
    issues: issuesByFile,
  }, null, 2));
  
  console.log(`📝 Full report saved to: ${reportPath}\n`);
}

main();

