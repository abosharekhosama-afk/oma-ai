'use client';
import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

export function LogoutButton() {
  const t = useT();
  return (
    <Button
      type="default"
      onClick={async () => {
        await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
        window.location.href = '/login';
      }}
    >
      {t('shell.logout')}
    </Button>
  );
}
