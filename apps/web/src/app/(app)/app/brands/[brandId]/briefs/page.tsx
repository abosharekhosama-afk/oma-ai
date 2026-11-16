'use client';

import { Button, Input, OmaSelect, Tag } from '@oma/ui/controls';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BrandPlxPageHead } from '../../../../../../components/brand/brand-plx-section';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { EmptyState, ErrorState } from '../../../../../../components/ui/empty-state';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { api } from '../../../../../../lib/api';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { formatBrandDateTime } from '../../../../../../lib/brand-format';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import {
  BRIEF_STATUS_TONE,
  createBrief,
  createBriefFromStrategy,
  listBriefs,
  type BriefStatus,
  type BriefSummary,
} from '../../../../../../lib/brief-api';
import type { StrategyListItem } from '../../../../../../lib/strategy-types';
import { useLocale, useT } from '../../../../../../lib/use-locale';

const FILTERS: Array<BriefStatus | ''> = [
  '',
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'CONVERTED',
];

export default function BriefsListPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { brandId } = useParams<{ brandId: string }>();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [rows, setRows] = useState<BriefSummary[]>([]);
  const [strategies, setStrategies] = useState<StrategyListItem[]>([]);
  const [filter, setFilter] = useState<BriefStatus | ''>('');
  const [title, setTitle] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const [brandRes, briefRes, strategyRes] = await Promise.all([
        api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
        listBriefs(brandId, filter || undefined),
        api<{ data: StrategyListItem[] }>(`/api/v1/brands/${brandId}/strategies`).catch(() => ({
          data: [] as StrategyListItem[],
        })),
      ]);
      setBrand(brandRes.data);
      setRows(briefRes.data);
      setStrategies(strategyRes.data.filter((s) => s.has_approved_version));
    } catch (err) {
      if (isTenantRequired(err)) setTenantRequired(true);
      else if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [brandId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await createBrief(brandId, { title: title.trim() });
      router.push(`/app/brands/${brandId}/briefs/${res.data.id}`);
    } catch (err) {
      setError(getApiError(err).message);
      setBusy(false);
    }
  }

  async function onFromStrategy() {
    if (!strategyId) return;
    setBusy(true);
    try {
      const versions = await api<{ data: Array<{ id: string; status: string }> }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions`,
      );
      const approved = versions.data.find((v) => v.status === 'APPROVED');
      if (!approved) throw new Error(t('briefs.fromStrategy.noApproved'));
      const res = await createBriefFromStrategy(brandId, { strategy_version_id: approved.id });
      router.push(`/app/brands/${brandId}/briefs/${res.data.id}`);
    } catch (err) {
      setError(getApiError(err).message);
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) return <DetailShimmer />;
  if (!brand) return <ErrorState title={t('common.error')} body={error ?? t('common.notFound')} />;

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      websiteUrl={brand.website?.normalized_url}
      brandLogoUrl={brand.logo_url}
      brandStatus={brand.status}
      latestScanId={brand.latest_scan?.id}
    >
      <BrandPlxPageHead title={t('briefs.title')} description={t('briefs.hint')} />

      <form className="oma-panel oma-plan-toolbar" onSubmit={onCreate} data-testid="brief-create">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('briefs.create.placeholder')}
          aria-label={t('briefs.create.title')}
          style={{ maxInlineSize: 360 }}
        />
        <Button type="primary" htmlType="submit" disabled={busy || !title.trim()}>
          {t('briefs.create.submit')}
        </Button>
        {strategies.length ? (
          <>
            <OmaSelect
              value={strategyId}
              onChange={setStrategyId}
              options={[
                { value: '', label: t('briefs.fromStrategy.pick') },
                ...strategies.map((s) => ({ value: s.id, label: s.name })),
              ]}
              testId="brief-from-strategy-select"
            />
            <Button onClick={() => void onFromStrategy()} disabled={busy || !strategyId}>
              {t('briefs.fromStrategy.submit')}
            </Button>
          </>
        ) : null}
      </form>

      <div className="oma-plan-toolbar" role="tablist" aria-label={t('briefs.filter')}>
        {FILTERS.map((f) => (
          <Button
            key={f || 'all'}
            type={filter === f ? 'primary' : 'default'}
            onClick={() => setFilter(f)}
            role="tab"
            aria-selected={filter === f}
          >
            {f ? t(`briefs.status.${f}`) : t('briefs.filterAll')}
          </Button>
        ))}
      </div>

      {error ? <ErrorState title={t('common.error')} body={error} /> : null}

      {rows.length === 0 ? (
        <EmptyState title={t('briefs.empty')} body={t('briefs.emptyHint')} />
      ) : (
        <div className="oma-plan-table-wrap">
          <table className="oma-plan-table" data-testid="brief-list">
            <thead>
              <tr>
                <th>{t('briefs.col.title')}</th>
                <th>{t('briefs.col.status')}</th>
                <th>{t('briefs.col.version')}</th>
                <th>{t('briefs.col.tasks')}</th>
                <th>{t('briefs.col.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link
                      href={`/app/brands/${brandId}/briefs/${b.id}`}
                      className="oma-text-link"
                      dir="auto"
                    >
                      {b.title}
                    </Link>
                  </td>
                  <td>
                    <Tag color={BRIEF_STATUS_TONE[b.status]}>{t(`briefs.status.${b.status}`)}</Tag>
                  </td>
                  <td>v{b.current_version_no}</td>
                  <td>{b.task_count}</td>
                  <td>
                    <time dateTime={b.updated_at} suppressHydrationWarning>
                      {formatBrandDateTime(b.updated_at, locale)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BrandWorkspaceShell>
  );
}
