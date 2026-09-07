'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useT } from '../../lib/use-locale';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
] as const;

export function LanguageSwitcher() {
  const t = useT();
  const router = useRouter();
  const current = useLocale();

  return (
    <label className="oma-field-inline">
      <span className="oma-field-inline-label">{t('shell.language')}</span>
      <select
        className="oma-select"
        aria-label={t('shell.language')}
        value={current}
        onChange={(e) => {
          // Locale drives both lang and dir in the root layout, so re-render on the server.
          document.cookie = `oma_locale=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
