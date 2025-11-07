#!/usr/bin/env node

/**
 * i18n Keys Consistency Checker
 * 
 * This script checks that all language files have the same keys
 * and warns about missing translations.
 * 
 * Usage: node scripts/check-i18n-keys.js
 */

const fs = require('fs');
const path = require('path');

// Supported locales
const LOCALES = ['en', 'nl', 'fr', 'ru', 'de'];
const LOCALES_DIR = path.join(__dirname, '../apps/web/src/i18n/locales');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Get all keys from a nested object (flattened with dot notation)
 * @param {Object} obj - Object to flatten
 * @param {String} prefix - Current key prefix
 * @returns {Array<String>} Array of flattened keys
 */
function getAllKeys(obj, prefix = '') {
  let keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively get keys from nested objects
      keys = keys.concat(getAllKeys(value, fullKey));
    } else {
      // Leaf node - add the key
      keys.push(fullKey);
    }
  }
  
  return keys;
}

/**
 * Load and parse a locale JSON file
 * @param {String} locale - Locale code (e.g., 'en')
 * @returns {Object|null} Parsed JSON or null if error
 */
function loadLocale(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(colorize(`❌ File not found: ${filePath}`, 'red'));
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(colorize(`❌ Failed to parse ${locale}.json:`, 'red'), error.message);
    return null;
  }
}

/**
 * Main function
 */
function main() {
  console.log(colorize('\n🔍 Checking i18n keys consistency...\n', 'cyan'));
  
  // Load all locale files
  const localeData = {};
  const localeKeys = {};
  
  for (const locale of LOCALES) {
    const data = loadLocale(locale);
    if (!data) {
      process.exit(1);
    }
    localeData[locale] = data;
    localeKeys[locale] = new Set(getAllKeys(data));
  }
  
  console.log(colorize('✅ All locale files loaded successfully\n', 'green'));
  
  // Use English as the reference locale
  const referenceLocale = 'en';
  const referenceKeys = localeKeys[referenceLocale];
  
  console.log(colorize(`📊 Statistics:`, 'blue'));
  for (const locale of LOCALES) {
    console.log(`   ${locale.toUpperCase()}: ${localeKeys[locale].size} keys`);
  }
  console.log();
  
  // Check for missing keys in each locale
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const locale of LOCALES) {
    if (locale === referenceLocale) continue;
    
    const currentKeys = localeKeys[locale];
    const missingKeys = [...referenceKeys].filter(key => !currentKeys.has(key));
    const extraKeys = [...currentKeys].filter(key => !referenceKeys.has(key));
    
    if (missingKeys.length > 0) {
      hasWarnings = true;
      console.log(colorize(`⚠️  Missing keys in ${locale.toUpperCase()}:`, 'yellow'));
      missingKeys.slice(0, 10).forEach(key => {
        console.log(`   - ${key}`);
      });
      if (missingKeys.length > 10) {
        console.log(colorize(`   ... and ${missingKeys.length - 10} more`, 'yellow'));
      }
      console.log();
    }
    
    if (extraKeys.length > 0) {
      hasWarnings = true;
      console.log(colorize(`⚠️  Extra keys in ${locale.toUpperCase()} (not in ${referenceLocale.toUpperCase()}):`, 'yellow'));
      extraKeys.slice(0, 10).forEach(key => {
        console.log(`   - ${key}`);
      });
      if (extraKeys.length > 10) {
        console.log(colorize(`   ... and ${extraKeys.length - 10} more`, 'yellow'));
      }
      console.log();
    }
  }
  
  // Check for duplicate keys (should not happen with valid JSON, but check anyway)
  for (const locale of LOCALES) {
    const keys = getAllKeys(localeData[locale]);
    const uniqueKeys = new Set(keys);
    
    if (keys.length !== uniqueKeys.size) {
      hasErrors = true;
      console.log(colorize(`❌ Duplicate keys found in ${locale.toUpperCase()}`, 'red'));
      console.log();
    }
  }
  
  // Final summary
  console.log(colorize('━'.repeat(60), 'cyan'));
  
  if (hasErrors) {
    console.log(colorize('❌ i18n check FAILED with errors', 'red'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(colorize('⚠️  i18n check completed with warnings', 'yellow'));
    console.log(colorize('   Consider adding missing translations', 'yellow'));
    // Don't fail CI on warnings, just inform
    process.exit(0);
  } else {
    console.log(colorize('✅ i18n check PASSED - all keys are consistent', 'green'));
    process.exit(0);
  }
}

// Run the script
main();






