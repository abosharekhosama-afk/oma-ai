'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../../components/shell/select-company';
import { useT } from '../../../../../../../lib/use-locale';

export default function NewStrategyPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => setBrand(res.data))
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      });
  }, [brandId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ data: { id: string } }>(`/api/v1/brands/${brandId}/strategies`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      router.push(`/app/brands/${brandId}/strategies/${res.data.id}`);
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
      setSaving(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (!brand) return <p role="status">{t('common.loading')}</p>;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <header className="oma-page-header">
        <h2>{t('strategy.new.title')}</h2>
        <Link href={`/app/brands/${brandId}/strategies`}>{t('brand.create.back')}</Link>
      </header>
      <p className="oma-muted" role="note">
        {t('strategy.warning.missingProfile')}
      </p>
      <form className="oma-card" onSubmit={onSubmit} data-testid="strategy-create-form">
        <label>
          {t('strategy.new.name')}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={160}
            data-testid="strategy-name"
          />
        </label>
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <button type="submit" className="oma-btn" disabled={saving}>
          {t('strategy.new.submit')}
        </button>
      </form>
    </BrandWorkspaceShell>
  );
}
