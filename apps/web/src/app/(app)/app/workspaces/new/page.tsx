'use client';

import { Button, Field, Input } from '@oma/ui/controls';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '../../../../../components/ui/dialog';
import { useT } from '../../../../../lib/use-locale';
import { api } from '../../../../../lib/api';
import { setActiveBrandId } from '../../../../../lib/active-brand';

export default function NewWorkspacePage() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ tenant?: { id: string; name: string } }>('/api/v1/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName }),
      });
      const tenantId = response.tenant?.id;
      if (!tenantId)
        throw new Error(t('workspaceCreate.failed') || 'Workspace could not be created.');
      setActiveBrandId(null);
      window.location.assign('/app');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={t('workspaceCreate.title') || 'Create workspace'}
      onClose={() => router.push('/app/select-company')}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }} data-testid="new-workspace-form">
        <p>
          {t('workspaceCreate.description') ||
            'A Workspace is your company-level space for members, settings, and brands. Brands live inside a Workspace.'}
        </p>
        <Field
          label={t('workspaceCreate.nameLabel') || 'Workspace name'}
          htmlFor="new-workspace-name"
        >
          <Input
            id="new-workspace-name"
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="new-workspace-name"
          />
        </Field>
        {error ? (
          <p role="alert" className="oma-field-error">
            {error}
          </p>
        ) : null}
        <div className="oma-dialog-actions">
          <Button
            type="default"
            htmlType="button"
            onClick={() => router.push('/app/select-company')}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={!name.trim()}
            data-testid="new-workspace-submit"
          >
            {t('workspaceCreate.submit') || 'Create workspace'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
