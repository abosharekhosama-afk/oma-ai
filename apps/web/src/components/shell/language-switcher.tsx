'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from '../../lib/use-locale';
import { setLocaleCookie, updateProfile } from '../../lib/account-api';

export function LanguageSwitcher() {
  const t = useT();
  const router = useRouter();
  const current = useLocale();

  const switchLocale = (next: 'en' | 'ar') => {
    if (next === current) return;
    // Locale drives both lang and dir in the root layout, so re-render on the server.
    setLocaleCookie(next);
    // Persist on the account (server-side) so it follows the user across devices.
    void updateProfile({ preferredLocale: next }).catch(() => undefined);
    router.refresh();
  };

  return (
    <div className="oma-language-card" role="group" aria-label={t('shell.language')}>
      <button
        type="button"
        aria-pressed={current === 'en'}
        className={current === 'en' ? 'is-active' : ''}
        onClick={() => switchLocale('en')}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={current === 'ar'}
        className={current === 'ar' ? 'is-active' : ''}
        onClick={() => switchLocale('ar')}
      >
        عربي
      </button>
    </div>
  );
}
