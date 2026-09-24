'use client';

import { Button, Field, Input } from '@oma/ui/controls';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiMutate, getApiError, isPermissionDenied, newIdempotencyKey } from '../../lib/brand-api';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiMutate<{ data: { id: string } }>('/api/v1/brands', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
        idempotencyKey: newIdempotencyKey('brand:create'),
      });
      router.push(`/app/brands/${res.data.id}`);
    } catch (err) {
      if (isPermissionDenied(err)) onDenied();
      else setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="oma-create-brand-form" onSubmit={onSubmit}>
      <Field label={t('brand.create.nameLabel')} htmlFor="brand-name" error={error ?? undefined}>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoFocus
          status={error ? 'error' : undefined}
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <div className="oma-dialog-actions">
        <Button type="default" htmlType="button" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button type="primary" htmlType="submit" loading={busy} disabled={!name.trim()}>
          {t('brand.create.submit')}
        </Button>
      </div>
    </form>
  );
}
