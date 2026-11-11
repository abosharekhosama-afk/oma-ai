'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../lib/use-platform-operator';
import {
  adminMetricsOverview,
  adminProbeAi,
  adminProbeRedis,
  adminProbeWebsiteScan,
  adminSystemIntegrations,
  adminSystemSecrets,
  type AdminIntegrationsStatus,
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

type ProbeState = 'idle' | 'running' | 'done' | 'error';

export default function AdminOverviewClient() {
  const isAr = useLocale() === 'ar';
  const { superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [integrations, setIntegrations] = useState<AdminIntegrationsStatus | null>(null);
  const [secrets, setSecrets] = useState<
    Array<{ key: string; label: string; configured: boolean }>
  >([]);
  const [probeUrl, setProbeUrl] = useState('');
  const [aiProbe, setAiProbe] = useState<ProbeState>('idle');
  const [aiProbeResult, setAiProbeResult] = useState<string | null>(null);
  const [scanProbe, setScanProbe] = useState<ProbeState>('idle');
  const [scanProbeResult, setScanProbeResult] = useState<string | null>(null);
  const [redisProbe, setRedisProbe] = useState<ProbeState>('idle');
  const [redisProbeResult, setRedisProbeResult] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const [m, s, i] = await Promise.all([
      adminMetricsOverview(),
      adminSystemSecrets(),
      adminSystemIntegrations(),
    ]);
    setMetrics(m.data);
    setSecrets(s.data);
    setIntegrations(i.data);
  }, []);

  useEffect(() => {
    if (!superAdmin) return;
    void loadOverview().catch((err) => {
      toast.push(err instanceof Error ? err.message : 'Failed to load metrics', 'danger');
    });
  }, [superAdmin, loadOverview, toast]);

  const runAiProbe = () => {
    setAiProbe('running');
    setAiProbeResult(null);
    void adminProbeAi()
      .then((res) => {
        setAiProbe('done');
        if (res.ok) {
          setAiProbeResult(
            isAr
              ? `نجح — ${res.model ?? ''} — ${res.latency_ms}ms${res.sample_text ? ` — «${res.sample_text.slice(0, 80)}…»` : ''}`
              : `OK — ${res.model ?? ''} — ${res.latency_ms}ms${res.sample_text ? ` — "${res.sample_text.slice(0, 80)}…"` : ''}`,
          );
        } else if (res.skipped) {
          setAiProbeResult(
            isAr
              ? `تخطي: ${res.reason ?? res.code ?? '—'}`
              : `Skipped: ${res.reason ?? res.code ?? '—'}`,
          );
        } else {
          setAiProbe('error');
          setAiProbeResult(res.code ?? res.reason ?? 'failed');
        }
      })
      .catch((err) => {
        setAiProbe('error');
        setAiProbeResult(err instanceof Error ? err.message : 'probe_failed');
      });
  };

  const runScanProbe = () => {
    setScanProbe('running');
    setScanProbeResult(null);
    void adminProbeWebsiteScan(probeUrl || undefined)
      .then((res) => {
        setScanProbe(res.ok ? 'done' : 'error');
        setScanProbeResult(
          res.ok
            ? isAr
              ? `نجح — ${res.url} — HTTP ${res.http_status ?? '—'} — ${res.latency_ms}ms`
              : `OK — ${res.url} — HTTP ${res.http_status ?? '—'} — ${res.latency_ms}ms`
            : `${res.code ?? 'failed'}: ${res.reason ?? res.url} (${res.latency_ms}ms)`,
        );
      })
      .catch((err) => {
        setScanProbe('error');
        setScanProbeResult(err instanceof Error ? err.message : 'probe_failed');
      });
  };

  const runRedisProbe = () => {
    setRedisProbe('running');
    setRedisProbeResult(null);
    void adminProbeRedis()
      .then((res) => {
        setRedisProbe(res.ok ? 'done' : 'error');
        setRedisProbeResult(
          res.ok
            ? isAr
              ? `نجح — ${res.latency_ms}ms`
              : `OK — ${res.latency_ms}ms`
            : res.error ?? 'redis_failed',
        );
      })
      .catch((err) => {
        setRedisProbe('error');
        setRedisProbeResult(err instanceof Error ? err.message : 'probe_failed');
      });
  };

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

      <section className="admin-hub__card" data-testid="admin-integrations-health">
        <h3>{isAr ? 'الذكاء الاصطناعي ومسح المواقع' : 'AI & website scan health'}</h3>
        {integrations ? (
          <div className="admin-hub__probe-grid">
            <div>
              <h4>{isAr ? 'الذكاء الاصطناعي' : 'AI'}</h4>
              <ul className="admin-hub__probe-meta">
                <li>
                  {isAr ? 'المزود: ' : 'Provider: '}
                  <strong>{integrations.ai.provider}</strong>
                </li>
                <li>
                  {isAr ? 'الوضع: ' : 'Mode: '}
                  <strong>{integrations.ai.mode}</strong> ({integrations.ai.availability})
                </li>
                <li>
                  {isAr ? 'النموذج: ' : 'Model: '}
                  <strong>{integrations.ai.default_model}</strong>
                </li>
              </ul>
              <Button
                htmlType="button"
                disabled={aiProbe === 'running'}
                onClick={runAiProbe}
                data-testid="admin-probe-ai"
              >
                {aiProbe === 'running'
                  ? isAr
                    ? 'جارٍ اختبار توليد فكرة…'
                    : 'Testing post idea generation…'
                  : isAr
                    ? 'اختبار توليد فكرة (Gemini)'
                    : 'Test post idea (live AI)'}
              </Button>
              {aiProbeResult ? <p className="admin-hub__probe-result">{aiProbeResult}</p> : null}
            </div>
            <div>
              <h4>{isAr ? 'مسح الموقع' : 'Website scan'}</h4>
              <ul className="admin-hub__probe-meta">
                <li>
                  {isAr ? 'الموصل: ' : 'Connector: '}
                  <strong>{integrations.website_scan.connector_mode}</strong>
                </li>
                <li>
                  {isAr ? 'تجاهل robots.txt: ' : 'Ignore robots.txt: '}
                  <strong>
                    {integrations.website_scan.ignore_robots_txt
                      ? isAr
                        ? 'نعم'
                        : 'Yes'
                      : isAr
                        ? 'لا'
                        : 'No'}
                  </strong>
                </li>
              </ul>
              <label className="admin-hub__probe-url">
                <span className="oma-muted">{isAr ? 'رابط اختياري' : 'Optional URL'}</span>
                <input
                  type="url"
                  value={probeUrl}
                  onChange={(e) => setProbeUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </label>
              <Button
                htmlType="button"
                disabled={scanProbe === 'running'}
                onClick={runScanProbe}
                data-testid="admin-probe-website"
              >
                {scanProbe === 'running'
                  ? isAr
                    ? 'جارٍ اختبار الجلب…'
                    : 'Testing fetch…'
                  : isAr
                    ? 'اختبار جلب الموقع'
                    : 'Test live fetch'}
              </Button>
              {scanProbeResult ? <p className="admin-hub__probe-result">{scanProbeResult}</p> : null}
            </div>
            <div>
              <h4>{isAr ? 'قائمة المهام (Redis)' : 'Job queue (Redis)'}</h4>
              <p className="oma-muted" style={{ fontSize: '0.85rem' }}>
                {integrations.worker_note}
              </p>
              <Button
                htmlType="button"
                disabled={redisProbe === 'running'}
                onClick={runRedisProbe}
                data-testid="admin-probe-redis"
              >
                {redisProbe === 'running'
                  ? isAr
                    ? 'جارٍ ping…'
                    : 'Pinging…'
                  : isAr
                    ? 'اختبار Redis'
                    : 'Test Redis'}
              </Button>
              {redisProbeResult ? (
                <p className="admin-hub__probe-result">{redisProbeResult}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p>…</p>
        )}
      </section>

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
      <Button
        htmlType="button"
        onClick={() => {
          void loadOverview().catch((err) =>
            toast.push(err instanceof Error ? err.message : 'Failed to refresh', 'danger'),
          );
        }}
      >
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
