'use client';
import { SelectField } from '@oma/ui/controls';

import { useRouter } from 'next/navigation';
import { useLocale, useT } from '../../lib/use-locale';
import { setLocaleCookie, updateProfile } from '../../lib/account-api';

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
      <SelectField
        aria-label={t('shell.language')}
        value={current}
        onChange={(e) => {
          // Locale drives both lang and dir in the root layout, so re-render on the server.
          const next = e.target.value === 'ar' ? 'ar' : 'en';
          setLocaleCookie(next);
          // Persist on the account (server-side) so it follows the user across devices.
          void updateProfile({ preferredLocale: next }).catch(() => undefined);
          router.refresh();
        }}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </SelectField>
    </label>
  );
}
