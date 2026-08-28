import type { TestInfo } from '@playwright/test';
import { t, type Locale } from '@oma/i18n';

/** Playwright project names encode the locale the browser will send. */
export function projectLocale(testInfo: TestInfo): Locale {
  return testInfo.project.name.startsWith('ar') ? 'ar' : 'en';
}

/** Assert against the shipped translation rather than a hardcoded English copy. */
export function msg(testInfo: TestInfo, key: string): string {
  return t(projectLocale(testInfo), key);
}
