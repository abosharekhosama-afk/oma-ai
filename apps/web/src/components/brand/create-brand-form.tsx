'use client';

import { Button, Field, Input } from '@oma/ui/controls';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiMutate, getApiError, isPermissionDenied, newIdempotencyKey } from '../../lib/brand-api';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

export function CreateBrandForm({
  onCancel,
  onDenied,
}: {
  onCancel: () => void;
  onDenied: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('brand.create.nameRequired') || 'Name is required');
      return;
    }
    setBusy(true);
    try {
      const res = await apiMutate<{ data: { id: string } }>('/api/v1/brands', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
        idempotencyKey: newIdempotencyKey('brand:create'),
      });
      const brandId = res.data.id;
      if (website.trim()) {
        const url = website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`;
        try {
          await api(`/api/v1/brands/${brandId}/website`, {
            method: 'POST',
            body: JSON.stringify({ url }),
          });
        } catch {
          /* optional */
        }
      }
      router.push(`/app/brands/${brandId}`);
    } catch (err) {
      if (isPermissionDenied(err)) onDenied();
      else setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="oma-create-brand-form" onSubmit={onSubmit} data-testid="create-workspace-form">
      <Field label={t('brand.create.nameLabel') || 'Workspace name'} htmlFor="brand-name" error={error ?? undefined}>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoFocus
          status={error ? 'error' : undefined}
          aria-invalid={error ? true : undefined}
          placeholder={t('brand.create.namePlaceholder') || 'e.g. Acme Marketing'}
        />
      </Field>
      <Field label={t('brand.create.websiteLabel') || 'Website (optional)'} htmlFor="brand-website">
        <Input
          id="brand-website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          maxLength={240}
          placeholder="https://example.com"
        />
      </Field>
      <div className="oma-dialog-actions">
        <Button type="default" htmlType="button" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button type="primary" htmlType="submit" loading={busy} disabled={!name.trim()} data-testid="create-workspace-submit">
          {t('brand.create.submit') || 'Create workspace'}
        </Button>
      </div>
    </form>
  );
}
