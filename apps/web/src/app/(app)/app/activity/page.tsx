'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { Drawer } from '../../../../components/ui/drawer';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader } from '../../../../components/ui/page-header';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  EMPTY_ACTIVITY_FILTERS,
  filterActivity,
  groupActivityByDay,
  type ActivityFilters,
  type ActivityRow,
} from '../../../../lib/demo/stage6-team';
import { useLocale, useT } from '../../../../lib/use-locale';

export default function ActivityPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_ACTIVITY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demoApi<ActivityRow[]>('/activity');
      setRows(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterActivity(rows, filters, locale), [rows, filters, locale]);
  const grouped = useMemo(() => groupActivityByDay(filtered), [filtered]);
  const selected = rows.find((a) => a.id === selectedId) ?? null;
  const actors = useMemo(() => [...new Set(rows.map((a) => a.actor))], [rows]);
  const objectTypes = useMemo(() => [...new Set(rows.map((a) => a.objectType))], [rows]);

  return (
    <div className="oma-stack" data-testid="demo-activity">
      <PageHeader title={t('demo.activity.title')} description={t('demo.activity.subtitle')} />
      <DemoDisclosure message={t('demo.activity.sourceHonesty')} />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-stage6-toolbar" data-testid="demo-activity-filters">
            <label className="oma-stage6-search">
              {t('demo.activity.search')}
              <input
                className="oma-input"
                value={filters.q}
                data-testid="demo-activity-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.activity.filter.source')}
              <select
                className="oma-select"
                value={filters.source}
                data-testid="demo-activity-filter-source"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    source: e.target.value as ActivityFilters['source'],
                  }))
                }
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="DEMO">{t('demo.activity.source.demo')}</option>
                <option value="FOUNDATION">{t('demo.activity.source.foundation')}</option>
              </select>
            </label>
            <label>
              {t('demo.activity.filter.object')}
              <select
                className="oma-select"
                value={filters.objectType}
                onChange={(e) => setFilters((f) => ({ ...f, objectType: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {objectTypes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.activity.filter.actor')}
              <select
                className="oma-select"
                value={filters.actor}
                onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.activity.emptyHint')} />
          ) : (
            <div className="oma-activity-groups" data-testid="demo-activity-stream">
              {[...grouped.entries()].map(([day, items]) => (
                <section key={day} style={{ padding: '12px' }}>
                  <h3>{day}</h3>
                  <ol className="oma-activity-timeline">
                    {items.map((a) => (
                      <li key={a.id} className="oma-card" data-testid={`demo-activity-row-${a.id}`}>
                        <div className="oma-chip-row">
                          <span className="oma-source-badge" data-source={a.source}>
                            {a.source === 'FOUNDATION'
                              ? t('demo.activity.audited')
                              : t('demo.activity.demoEvent')}
                          </span>
                          <time dateTime={a.at}>{a.at}</time>
                        </div>
                        <p>
                          <strong>{a.actor}</strong> — {pickCopy(a.summary, locale)}
                        </p>
                        <div className="oma-chip-row">
                          <button
                            type="button"
                            className="oma-btn oma-btn-secondary"
                            data-testid={`demo-activity-open-${a.id}`}
                            onClick={() => setSelectedId(a.id)}
                          >
                            {t('demo.activity.details')}
                          </button>
                          <Link
                            href={a.href}
                            className="oma-text-link"
                            data-testid={`demo-activity-link-${a.id}`}
                          >
                            {t('home.action.open')}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        label={t('demo.activity.details')}
      >
        {selected ? (
          <div className="oma-stack" data-testid="demo-activity-detail">
            <span className="oma-source-badge" data-source={selected.source}>
              {selected.source === 'FOUNDATION'
                ? t('demo.activity.audited')
                : t('demo.activity.demoEvent')}
            </span>
            <p>
              <strong>{selected.actor}</strong>
            </p>
            <p>{pickCopy(selected.summary, locale)}</p>
            <p className="oma-muted">
              {selected.objectType} · {selected.action}
            </p>
            <p className="oma-muted">{selected.at}</p>
            {selected.priorState || selected.newState ? (
              <p>
                {selected.priorState ?? '—'} → {selected.newState ?? '—'}
              </p>
            ) : null}
            {selected.campaignId ? (
              <Link href={`/app/campaigns/${selected.campaignId}`} className="oma-text-link">
                {selected.campaignId}
              </Link>
            ) : null}
            <Link
              href={selected.href}
              className="oma-text-link"
              data-testid="demo-activity-detail-link"
            >
              {selected.href}
            </Link>
            <p className="oma-honesty-inline">{t('demo.activity.noSecrets')}</p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
