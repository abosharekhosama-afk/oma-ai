'use client';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

export function LogoutButton() {
  const t = useT();
  return (
    <button
      className="oma-btn-secondary"
      type="button"
      onClick={async () => {
        await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
        window.location.href = '/login';
      }}
    >
      {t('shell.logout')}
    </button>
  );
}
