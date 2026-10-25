'use client';
import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { SESSION_OK_KEY } from '../../lib/session';

export function LogoutButton() {
  const t = useT();
  return (
    <Button
      type="default"
      onClick={async () => {
        try {
          await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
        } catch {
          /* already signed out / offline: still leave */
        }
        try {
          window.sessionStorage.removeItem(SESSION_OK_KEY);
        } catch {
          /* ignore */
        }
        window.location.href = '/login';
      }}
    >
      {t('shell.logout')}
    </Button>
  );
}
