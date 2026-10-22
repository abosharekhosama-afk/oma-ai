'use client';
import { OmaLinkButton } from '../../../../components/ui/oma-link-button';
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
  EMPTY_TEAM_FILTERS,
  capacityState,
  filterTeam,
  type TeamFilters,
  type TeamMember,
} from '../../../../lib/demo/stage6-team';
import { useLocale, useT } from '../../../../lib/use-locale';

export default function TeamPage() {
  const t = useT();
  const locale = useLocale();
  const [rows, setRows] = useState<TeamMember[]>([]);
  const [filters, setFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await demoApi<TeamMember[]>('/team');
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

  const filtered = useMemo(() => filterTeam(rows, filters, locale), [rows, filters, locale]);
  const selected = rows.find((m) => m.id === selectedId) ?? null;
  const roles = useMemo(() => [...new Set(rows.map((m) => m.role))], [rows]);

  return (
    <div className="plx-page" data-testid="demo-team" data-surface="team">
      <div className="plx-page__bar">
        <div className="plx-page__title-block">
          <h1 className="plx-page__title">{t('demo.team.title')}</h1>
          <p className="plx-page__sub">{t('demo.team.subtitle')}</p>
        </div>
      </div>
      <DemoDisclosure message={t('demo.team.sourceHonesty')} />
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
            <div className="plx-toolbar" data-testid="demo-team-filters">
              <div className="plx-toolbar__search">
                <Input
                  value={filters.q}
                  placeholder={t('demo.team.search')}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  data-testid="demo-team-search"
                />
              </div>
              <SelectField
                value={filters.role}
                aria-label={t('demo.team.filterRole')}
                onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="all">{t('demo.team.filterAllRoles')}</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={filters.capacity}
                aria-label={t('demo.team.filterCapacity')}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    capacity: e.target.value as typeof filters.capacity,
                  }))
                }
              >
                <option value="all">{t('demo.team.filterAllCapacity')}</option>
                <option value="available">{t('demo.team.capacity.available')}</option>
                <option value="balanced">{t('demo.team.capacity.balanced')}</option>
                <option value="at_risk">{t('demo.team.capacity.at_risk')}</option>
                <option value="over_capacity">{t('demo.team.capacity.over_capacity')}</option>
              </SelectField>
            </div>

            {filtered.length === 0 ? (
              <div className="plx-empty">
                <strong>{t('demo.empty')}</strong>
              </div>
            ) : (
              <div className="plx-list" data-testid="demo-team-list">
                <div className="plx-list__head">
                  <span>{t('demo.team.col.name')}</span>
                  <span>{t('demo.team.col.role')}</span>
                  <span>{t('demo.team.col.capacity')}</span>
                  <span>{t('demo.team.col.assignments')}</span>
                  <span />
                </div>
                {filtered.map((m) => {
                  const cap = capacityState(m.workload);
                  const name = pickCopy(m.name, locale);
                  const initial = (name || '?').trim().charAt(0).toUpperCase();
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="plx-list__row"
                      data-testid={`demo-team-row-${m.id}`}
                      onClick={() => setSelectedId(m.id)}
                    >
                      <div className="plx-person">
                        <span className="plx-person__av" aria-hidden>
                          {initial}
                        </span>
                        <span>
                          <span className="plx-person__name">{name}</span>
                          <span className="plx-person__sub">{pickCopy(m.functionLabel, locale)}</span>
                        </span>
                      </div>
                      <span className="plx-list__cell">{m.role}</span>
                      <span className="plx-list__cell">
                        <span className={`plx-pill ${cap === 'available' || cap === 'balanced' ? 'plx-pill--ok' : cap === 'over_capacity' ? 'plx-pill--warn' : 'plx-pill--info'}`}>
                          {t(`demo.team.capacity.${cap}`)} · {Math.round(m.workload * 100)}%
                        </span>
                      </span>
                      <span className="plx-list__cell oma-ltr">
                        {m.assignments}
                        {m.overdue ? ` · ${m.overdue} overdue` : ''}
                      </span>
                      <span className="plx-list__actions">
                        <span className="plx-btn plx-btn--soft" style={{ height: 32, padding: '0 10px', fontSize: 12 }}>
                          {t('demo.team.viewTasks')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        label={selected ? pickCopy(selected.name, locale) : t('demo.team.title')}
      >
        {selected ? (
          <div className="oma-stack" data-testid="demo-team-drawer">
            <div className="plx-person" style={{ marginBottom: 12 }}>
              <span className="plx-person__av" style={{ width: 48, height: 48, fontSize: 18 }}>
                {(pickCopy(selected.name, locale) || '?').charAt(0).toUpperCase()}
              </span>
              <span>
                <span className="plx-person__name" style={{ fontSize: 16 }}>
                  {pickCopy(selected.name, locale)}
                </span>
                <span className="plx-person__sub">{selected.role}</span>
              </span>
            </div>
            <p>{pickCopy(selected.functionLabel, locale)}</p>
            <p>
              <span className={`plx-pill ${capacityState(selected.workload) === 'over_capacity' || capacityState(selected.workload) === 'at_risk' ? 'plx-pill--warn' : 'plx-pill--ok'}`}>
                {t(`demo.team.capacity.${capacityState(selected.workload)}`)} ·{' '}
                {Math.round(selected.workload * 100)}%
              </span>
            </p>
            <p className="oma-muted">{t('demo.team.workloadHonesty')}</p>
            <div className="oma-chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Link
                href={`/app/tasks?assignee=${encodeURIComponent(selected.assigneeKey)}`}
                className="plx-btn plx-btn--ghost"
                data-testid="demo-team-tasks-link"
              >
                {t('demo.team.viewTasks')} ({selected.assignments})
              </Link>
              <Link
                href="/app/reviews"
                className="plx-btn plx-btn--ghost"
                data-testid="demo-team-reviews-link"
              >
                {t('demo.team.viewReviews')} ({selected.reviewQueue})
              </Link>
              <Link href="/app/company/members" className="plx-btn plx-btn--ghost">
                {t('demo.team.foundationMembers')}
              </Link>
            </div>
            {selected.restricted ? <p role="status">{t('demo.team.restrictedDetail')}</p> : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
