'use client';

import { useState } from 'react';
import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { SESSION_OK_KEY } from '../../lib/session';
import { ConfirmActionDialog } from '../ui/confirm-action-dialog';

export function LogoutButton() {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doLogout() {
    setBusy(true);
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
  }

  return (
    <>
      <Button type="default" disabled={busy} onClick={() => setConfirmOpen(true)}>
        {t('shell.logout')}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        title={t('shell.logout_confirm_title') || t('shell.logout')}
        description={
          t('shell.logout_confirm_body') ||
          'Are you sure you want to log out of your OMA account on this device?'
        }
        confirmLabel={t('shell.logout')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        busy={busy}
        onConfirm={() => void doLogout()}
        onCancel={() => setConfirmOpen(false)}
        testId="confirm-logout-button-dialog"
      />
    </>
  );
}
