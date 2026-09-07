'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiMutate,
  getApiError,
  isPermissionDenied,
  newIdempotencyKey,
} from '../../../../../lib/brand-api';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { useT } from '../../../../../lib/use-locale';

export default function NewBrandPage() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
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
      if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>{t('brand.create.title')}</h1>
      <p className="oma-muted">
        <Link href="/app/brands">{t('brand.create.back')}</Link>
      </p>
      <form className="oma-card" onSubmit={onSubmit}>
        <label htmlFor="brand-name">{t('brand.create.nameLabel')}</label>
        <input
          id="brand-name"
          className="oma-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoFocus
        />
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <button className="oma-btn" type="submit" disabled={busy || !name.trim()}>
          {t('brand.create.submit')}
        </button>
      </form>
    </div>
  );
}
