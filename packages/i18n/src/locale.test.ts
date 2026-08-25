import { describe, expect, it } from 'vitest';
import { resolveDir, resolveLocale, t } from './index';

describe('locale', () => {
  it('resolves ar and rtl', () => {
    expect(resolveLocale('ar-SA')).toBe('ar');
    expect(resolveDir('ar')).toBe('rtl');
    expect(t('ar', 'auth.login')).toContain('تسجيل');
  });
  it('defaults to en ltr', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveDir('en')).toBe('ltr');
  });
});
