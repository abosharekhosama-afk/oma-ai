'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';
import type { BrandListItem, Paginated } from '../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../lib/brand-api';

type Me = { user: { name: string }; active_tenant_id: string | null };

export default function AppHomePage() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brandCount, setBrandCount] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Me>('/api/v1/auth/me')
      .then(async (next) => {
        if (cancelled) return;
        setMe(next);
        if (!next.active_tenant_id) return;
        try {
          const brands = await api<Paginated<BrandListItem>>('/api/v1/brands');
          if (!cancelled) setBrandCount(brands.data.length);
        } catch (err) {
          if (cancelled) return;
          if (isPermissionDenied(err)) setDenied(true);
          else setError(getApiError(err).message);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="oma-stack">
      <header className="oma-page-header">
        <div>
          <h1>{t('home.title')}</h1>
          <p className="oma-muted">{t('home.subtitle')}</p>
        </div>
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!me ? (
        error ? null : (
          <p role="status">{t('common.loading')}</p>
        )
      ) : !me.active_tenant_id ? (
        <div className="oma-card" role="status">
          <h2>{t('home.noTenantTitle')}</h2>
          <p className="oma-muted">{t('home.noTenantBody')}</p>
        </div>
      ) : (
        <div className="oma-action-grid">
          <div className="oma-card">
            <h2>{t('home.brandCardTitle')}</h2>
            <p className="oma-muted">{t('home.brandCardBody')}</p>
            {denied ? (
              <p className="oma-muted">{t('errors.permission')}</p>
            ) : (
              <>
                {brandCount !== null ? (
                  <p className="oma-metric">
                    <span className="oma-metric-value">{brandCount}</span>
                    <span className="oma-metric-label">{t('brand.list.title')}</span>
                  </p>
                ) : null}
                <Link href="/app/brands" className="oma-btn">
                  {t('home.brandCardCta')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
