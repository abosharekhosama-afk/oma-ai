'use client';

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
      <label htmlFor="brand-name">{t('brand.create.nameLabel')}</label>
      <input
        id="brand-name"
        className="oma-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={120}
        autoFocus
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p role="alert" className="oma-field-error">
          {error}
        </p>
      ) : null}
      <div className="oma-dialog-actions">
        <button
          type="button"
          className="oma-btn oma-btn-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {t('common.cancel')}
        </button>
        <button className="oma-btn" type="submit" disabled={busy || !name.trim()}>
          {busy ? t('common.loading') : t('brand.create.submit')}
        </button>
      </div>
    </form>
  );
}
