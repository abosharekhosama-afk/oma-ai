'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

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
import { PageSkeleton } from '../../../../components/ui/empty-state';

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
    <div className="plx-page" data-testid="demo-activity" data-surface="activity">
      <div className="plx-page__bar">
        <div className="plx-page__title-block">
          <h1 className="plx-page__title">{t('demo.activity.title')}</h1>
          <p className="plx-page__sub">{t('demo.activity.subtitle')}</p>
        </div>
      </div>
      <DemoDisclosure message={t('demo.activity.sourceHonesty')} />
      <div className="plx-page__body">
        {loading ? <div className="oma-skeleton" role="status" /> : null}
        {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
        {error ? (
          <div className="plx-empty" role="alert">
            <strong>{error}</strong>
          </div>
        ) : null}

        {!loading && !unavailable && !error ? (
          <>
            <div className="plx-toolbar" data-testid="demo-activity-filters">
              <div className="plx-toolbar__search">
                <Input
                  value={filters.q}
                  placeholder={t('demo.activity.search')}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  data-testid="demo-activity-search"
                />
              </div>
              <SelectField
                value={filters.actor}
                aria-label={t('demo.activity.filterActor')}
                onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              >
                <option value="all">{t('demo.activity.allActors')}</option>
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={filters.objectType}
                aria-label={t('demo.activity.filterType')}
                onChange={(e) => setFilters((f) => ({ ...f, objectType: e.target.value }))}
              >
                <option value="all">{t('demo.activity.allTypes')}</option>
                {objectTypes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </SelectField>
            </div>

            {filtered.length === 0 ? (
              <div className="plx-empty">
                <strong>{t('demo.empty')}</strong>
              </div>
            ) : (
              <div className="plx-timeline" data-testid="demo-activity-list">
                {[...grouped.entries()].map(([day, items]) => (
                  <div key={day}>
                    <p className="plx-timeline__day">{day}</p>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="plx-timeline__item"
                        data-selected={selectedId === item.id ? 'true' : 'false'}
                        data-testid={`demo-activity-row-${item.id}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="plx-person__av" aria-hidden>
                          {(item.actor || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="plx-timeline__body">
                          <strong>{item.actor}</strong>
                          <span>
                            {pickCopy(item.summary, locale) || item.action || item.objectType}
                          </span>
                        </span>
                        <span className="plx-timeline__time oma-ltr">
                          {String(item.at || '').slice(11, 16) || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {selected ? (
              <div className="plx-settings__panel" style={{ marginTop: 16 }} data-testid="demo-activity-detail">
                <h2 style={{ marginTop: 0 }}>{selected.actor}</h2>
                <p>{pickCopy(selected.summary, locale)}</p>
                <p className="oma-muted oma-ltr">{String(selected.at || '')}</p>
                <p className="oma-muted">
                  {selected.objectType} · {selected.action}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
