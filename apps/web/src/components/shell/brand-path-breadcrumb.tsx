'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { setActiveBrandId } from '../../lib/active-brand';
import { api } from '../../lib/api';
import { brandPathTailLabel } from '../../lib/brand-workspace-nav';
import { useT } from '../../lib/use-locale';

export function BrandPathBreadcrumb({
  brandId,
  pathname,
}: {
  brandId: string;
  pathname: string;
}) {
  const t = useT();
  const [brandName, setBrandName] = useState<string | null>(null);

  useEffect(() => {
    setActiveBrandId(brandId);
    let live = true;
    api<{ data: { name: string } }>(`/api/v1/brands/${brandId}`)
      .then((res) => {
        if (live) setBrandName(res.data.name);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [brandId]);

  const tail = brandPathTailLabel(pathname, brandId, t);
  const brandHref = `/app/brands/${brandId}`;
  const onBrandHome = pathname === brandHref;

  return (
    <nav aria-label={t('shell.breadcrumb')} className="oma-context-trail">
      <ol className="oma-breadcrumb oma-breadcrumb--planable">
        <li>
          <Link href="/app/brands">{t('nav.intelligence')}</Link>
        </li>
        <li>
          <span className="oma-breadcrumb-sep" aria-hidden>
            /
          </span>
          {onBrandHome ? (
            <span aria-current="page">{brandName ?? t('shell.breadcrumbBrand')}</span>
          ) : (
            <Link href={brandHref}>{brandName ?? t('shell.breadcrumbBrand')}</Link>
          )}
        </li>
        {tail ? (
          <li>
            <span className="oma-breadcrumb-sep" aria-hidden>
              /
            </span>
            <span aria-current="page">{tail}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}