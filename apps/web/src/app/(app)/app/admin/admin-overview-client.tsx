'use client';

import { useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../lib/use-platform-operator';
import {
  adminMetricsOverview,
  adminSystemSecrets,
  type AdminMetrics,
} from '../../../../lib/platform-admin-api';
import { useToast } from '../../../../components/ui/toast';

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBytes(raw: string | null) {
  if (!raw) return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default function AdminOverviewClient() {
  const isAr = useLocale() === 'ar';
  const { superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [secrets, setSecrets] = useState<
    Array<{ key: string; label: string; configured: boolean }>
  >([]);

  useEffect(() => {
    if (!superAdmin) return;
    void (async () => {
      try {
        const [m, s] = await Promise.all([adminMetricsOverview(), adminSystemSecrets()]);
        setMetrics(m.data);
        setSecrets(s.data);
      } catch (err) {
        toast.push(err instanceof Error ? err.message : 'Failed to load metrics', 'danger');
      }
    })();
  }, [superAdmin, toast]);

  if (!superAdmin) {
    return (
      <p>
        {isAr
          ? 'نظرة الإدارة العليا تتطلب دور Super Admin.'
          : 'Overview requires Super Admin role.'}
      </p>
    );
  }

  return (
    <div className="admin-hub__stack">
      <h1>{isAr ? 'لوحة الإدارة العليا' : 'Super Admin overview'}</h1>
      <div className="admin-hub__grid">
        <MetricCard
          title={isAr ? 'تقدير MRR' : 'MRR estimate'}
          value={metrics ? formatUsd(metrics.mrr_usd_cents_estimate) : '…'}
        />
        <MetricCard
          title={isAr ? 'اشتراكات نشطة' : 'Active subscriptions'}
          value={metrics ? String(metrics.active_subscriptions) : '…'}
        />
        <MetricCard
          title={isAr ? 'مستأجرون' : 'Tenants'}
          value={metrics ? String(metrics.tenants_total) : '…'}
        />
        <MetricCard
          title={isAr ? 'WorkDrive' : 'WorkDrive'}
          value={
            metrics
              ? metrics.workdrive.master_configured
                ? isAr
                  ? 'مُكوَّن'
                  : 'Configured'
                : isAr
                  ? 'غير مُكوَّن'
                  : 'Not configured'
              : '…'
          }
        />
      </div>
      {metrics?.workdrive.latest_reconcile_at ? (
        <section className="admin-hub__card">
          <h3>{isAr ? 'تخزين المنصة' : 'Platform storage'}</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {isAr ? 'داخلي: ' : 'Internal: '}
            {formatBytes(metrics.workdrive.oma_internal_bytes)}
            {' · '}
            {isAr ? 'مستخدم: ' : 'Used: '}
            {formatBytes(metrics.workdrive.platform_used_bytes)}
            {' · '}
            {isAr ? 'حد: ' : 'Limit: '}
            {formatBytes(metrics.workdrive.platform_limit_bytes)}
          </p>
        </section>
      ) : null}
      <section className="admin-hub__card">
        <h3>{isAr ? 'حالة الأسرار' : 'Integration secrets'}</h3>
        <table className="admin-hub__table">
          <thead>
            <tr>
              <th>{isAr ? 'التكامل' : 'Integration'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {secrets.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>
                  {s.configured
                    ? isAr
                      ? 'مُكوَّن'
                      : 'Configured'
                    : isAr
                      ? 'غير مُكوَّن'
                      : 'Missing'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Button type="button" onClick={() => window.location.reload()}>
        {isAr ? 'تحديث' : 'Refresh'}
      </Button>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="admin-hub__card">
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
