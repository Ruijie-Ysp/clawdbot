#!/usr/bin/env node

/**
 * Translation completeness checker for Clawdbot UI
 *
 * This script checks that all translation keys in the base language (English)
 * have corresponding translations in all other languages.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to i18n directory
const I18N_DIR = join(__dirname, "../src/ui/i18n");

// Base language (English)
const BASE_LANGUAGE = "en";

// Supported languages
const LANGUAGES = ["en", "zh-CN"];

/**
 * Deeply get all translation keys from an object
 */
function getAllKeys(obj, prefix = "") {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      keys.push(fullKey);
    } else if (typeof value === "object" && value !== null) {
      keys.push(...getAllKeys(value, fullKey));
    }
  }

  return keys;
}

/**
 * Get translation value by key path
 */
function getValueByPath(obj, path) {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Load a translation file
 */
function loadTranslation(language) {
  const filePath = join(I18N_DIR, `${language}.ts`);

  if (!existsSync(filePath)) {
    console.error(`❌ Translation file not found: ${filePath}`);
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8");

    // Extract the translation object from the TypeScript file
    // This is a simple parser for our specific format
    const exportMatch = content.match(/export const \w+:\s*Translations\s*=\s*({[\s\S]*?});/);

    if (!exportMatch) {
      console.error(`❌ Could not parse translation file: ${language}.ts`);
      return null;
    }

    // Evaluate the object (in a safe way)
    const objString = exportMatch[1]
      .replace(/(\w+):/g, '"$1":') // Convert keys to quoted strings
      .replace(/'/g, '"'); // Convert single quotes to double quotes

    try {
      return JSON.parse(objString);
    } catch (e) {
      console.error(`❌ Failed to parse JSON for ${language}:`, e.message);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error loading ${language}.ts:`, error.message);
    return null;
  }
}

/**
 * Check translation completeness
 */
function checkTranslations() {
  console.log("🔍 Checking translation completeness...\n");

  // Load base language
  const baseTranslations = loadTranslation(BASE_LANGUAGE);
  if (!baseTranslations) {
    process.exit(1);
  }

  // Get all keys from base language
  const baseKeys = getAllKeys(baseTranslations);
  console.log(`📊 Base language (${BASE_LANGUAGE}) has ${baseKeys.length} translation keys\n`);

  // Check each language
  const results = {};
  let hasErrors = false;

  for (const language of LANGUAGES) {
    if (language === BASE_LANGUAGE) {
      continue;
    }

    console.log(`📝 Checking ${language}...`);

    const translations = loadTranslation(language);
    if (!translations) {
      hasErrors = true;
      continue;
    }

    const missingKeys = [];
    const emptyTranslations = [];

    for (const key of baseKeys) {
      const value = getValueByPath(translations, key);

      if (value === undefined) {
        missingKeys.push(key);
      } else if (typeof value === "string" && value.trim() === "") {
        emptyTranslations.push(key);
      }
    }

    results[language] = {
      totalKeys: baseKeys.length,
      translatedKeys: baseKeys.length - missingKeys.length,
      missingKeys,
      emptyTranslations,
    };

    if (missingKeys.length > 0) {
      console.log(`  ❌ Missing ${missingKeys.length} translation(s):`);
      missingKeys.slice(0, 10).forEach((key) => console.log(`     - ${key}`));
      if (missingKeys.length > 10) {
        console.log(`     ... and ${missingKeys.length - 10} more`);
      }
      hasErrors = true;
    }

    if (emptyTranslations.length > 0) {
      console.log(`  ⚠️  ${emptyTranslations.length} empty translation(s):`);
      emptyTranslations.slice(0, 5).forEach((key) => console.log(`     - ${key}`));
      if (emptyTranslations.length > 5) {
        console.log(`     ... and ${emptyTranslations.length - 5} more`);
      }
    }

    if (missingKeys.length === 0 && emptyTranslations.length === 0) {
      console.log(`  ✅ All ${baseKeys.length} keys translated`);
    }

    console.log();
  }

  // Generate summary report
  console.log("📈 Translation Summary:");
  console.log("=".repeat(50));

  for (const [language, result] of Object.entries(results)) {
    const percentage = Math.round((result.translatedKeys / result.totalKeys) * 100);
    console.log(`${language}:`);
    console.log(`  Translated: ${result.translatedKeys}/${result.totalKeys} (${percentage}%)`);
    console.log(`  Missing: ${result.missingKeys.length}`);
    console.log(`  Empty: ${result.emptyTranslations.length}`);
    console.log();
  }

  // Generate JSON report
  const report = {
    generatedAt: new Date().toISOString(),
    baseLanguage: BASE_LANGUAGE,
    languages: LANGUAGES,
    results,
  };

  const reportPath = join(__dirname, "../translation-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);

  if (hasErrors) {
    console.log("\n❌ Translation check failed - some translations are missing");
    process.exit(1);
  } else {
    console.log("\n✅ All translations are complete!");
  }
}

// Run the check
checkTranslations();
