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
    <div className="oma-stack plx-org" data-testid="demo-team" data-surface="team">
      <PageHeader
        title={t('demo.team.title')}
        description={t('demo.team.subtitle')}
        actions={
          <OmaLinkButton
            href="/app/company/members"
            type="default"
            data-testid="demo-team-members-link"
          >
            {t('demo.teamInviteLink')}
          </OmaLinkButton>
        }
      />
      <DemoDisclosure message={t('demo.team.workloadHonesty')} />

      {loading ? <PageSkeleton rows={5} /> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <div className="oma-card" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-stage6-toolbar" data-testid="demo-team-filters">
            <label className="oma-stage6-search">
              {t('demo.team.search')}
              <Input
                value={filters.q}
                data-testid="demo-team-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.team.filter.role')}
              <SelectField
                value={filters.role}
                data-testid="demo-team-filter-role"
                onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              {t('demo.team.filter.workload')}
              <SelectField
                value={filters.capacity}
                data-testid="demo-team-filter-capacity"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    capacity: e.target.value as TeamFilters['capacity'],
                  }))
                }
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="available">{t('demo.team.capacity.available')}</option>
                <option value="balanced">{t('demo.team.capacity.balanced')}</option>
                <option value="at_risk">{t('demo.team.capacity.at_risk')}</option>
                <option value="over_capacity">{t('demo.team.capacity.over_capacity')}</option>
              </SelectField>
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.team.emptyHint')} />
          ) : (
            <>
              <div className="oma-team-table-wrap" data-testid="demo-team-table">
                <table className="oma-table">
                  <thead>
                    <tr>
                      <th>{t('demo.team.col.member')}</th>
                      <th>{t('demo.team.filter.role')}</th>
                      <th>{t('demo.team.col.workload')}</th>
                      <th>{t('demo.team.col.assignments')}</th>
                      <th>{t('demo.team.col.reviews')}</th>
                      <th>{t('demo.team.col.due')}</th>
                      <th>{t('demo.team.col.overdue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => {
                      const cap = capacityState(m.workload);
                      return (
                        <tr
                          key={m.id}
                          className="oma-team-row"
                          data-testid={`demo-team-row-${m.id}`}
                          onClick={() => setSelectedId(m.id)}
                        >
                          <td>
                            <Button
                              type="default"
                              data-testid={`demo-team-open-${m.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(m.id);
                              }}
                              className="oma-text-link"
                            >
                              {pickCopy(m.name, locale)}
                            </Button>
                            {m.restricted ? (
                              <span className="oma-badge">{t('demo.teamRestricted')}</span>
                            ) : null}
                          </td>
                          <td>{m.role}</td>
                          <td>
                            <div
                              className="oma-workload-bar"
                              data-risk={
                                cap === 'at_risk' || cap === 'over_capacity' ? 'true' : 'false'
                              }
                              aria-hidden="true"
                            >
                              <span
                                style={{ width: `${Math.min(100, Math.round(m.workload * 100))}%` }}
                              />
                            </div>
                            <span className="oma-capacity" data-state={cap}>
                              {t(`demo.team.capacity.${cap}`)} ({Math.round(m.workload * 100)}%)
                            </span>
                          </td>
                          <td className="oma-ltr">{m.assignments}</td>
                          <td className="oma-ltr">{m.reviewQueue}</td>
                          <td className="oma-ltr">{m.dueSoon}</td>
                          <td className="oma-ltr">{m.overdue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="oma-team-mobile-list" data-testid="demo-team-mobile">
                {filtered.map((m) => {
                  const cap = capacityState(m.workload);
                  return (
                    <article
                      key={m.id}
                      className="oma-team-mobile-card"
                      data-testid={`demo-team-mobile-${m.id}`}
                    >
                      <Button
                        type="default"
                        onClick={() => setSelectedId(m.id)}
                        className="oma-text-link"
                      >
                        {pickCopy(m.name, locale)}
                      </Button>
                      <p className="oma-muted">{m.role}</p>
                      <p className="oma-capacity" data-state={cap}>
                        {t(`demo.team.capacity.${cap}`)} · {Math.round(m.workload * 100)}%
                      </p>
                      <p className="oma-muted oma-ltr">
                        {t('demo.team.col.assignments')}: {m.assignments} ·{' '}
                        {t('demo.team.col.overdue')}: {m.overdue}
                      </p>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : null}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        label={selected ? pickCopy(selected.name, locale) : t('demo.team.title')}
      >
        {selected ? (
          <div className="oma-stack" data-testid="demo-team-drawer">
            <p className="oma-muted">{selected.role}</p>
            <p>{pickCopy(selected.functionLabel, locale)}</p>
            <p>
              <span className="oma-capacity" data-state={capacityState(selected.workload)}>
                {t(`demo.team.capacity.${capacityState(selected.workload)}`)}
              </span>
              {' · '}
              {Math.round(selected.workload * 100)}%
            </p>
            <p className="oma-muted">{t('demo.team.workloadHonesty')}</p>
            <div className="oma-chip-row">
              <Link
                href={`/app/tasks?assignee=${encodeURIComponent(selected.assigneeKey)}`}
                className="oma-text-link"
                data-testid="demo-team-tasks-link"
              >
                {t('demo.team.viewTasks')} ({selected.assignments})
              </Link>
              <Link
                href="/app/reviews"
                className="oma-text-link"
                data-testid="demo-team-reviews-link"
              >
                {t('demo.team.viewReviews')} ({selected.reviewQueue})
              </Link>
              <Link href="/app/company/members" className="oma-text-link">
                {t('demo.team.foundationMembers')}
              </Link>
            </div>
            {selected.restricted ? <p role="status">{t('demo.team.restrictedDetail')}</p> : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
