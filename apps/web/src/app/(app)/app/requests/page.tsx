'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { Dialog } from '../../../../components/ui/dialog';
import { EmptyState } from '../../../../components/ui/empty-state';
import { PageHeader, Panel } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import {
  EMPTY_REQUEST_FILTERS,
  activeRequestFilterCount,
  filterRequests,
  requestCompleteness,
  requestIsOverdue,
  requestMissingFields,
  requestNextAction,
  type RequestFilters,
  type RequestGroup,
  type RequestRow,
} from '../../../../lib/demo/stage4-requests';
import { useLocale, useT } from '../../../../lib/use-locale';

type Brand = DemoGraph['brands'][number];
type Campaign = DemoGraph['campaigns'][number];
type Brief = DemoGraph['briefs'][number];

const GROUPS: RequestGroup[] = [
  'all',
  'untriaged',
  'assigned',
  'in_progress',
  'waiting',
  'completed',
];

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export default function RequestsPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_REQUEST_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'DESIGN',
    brandId: '',
    campaignId: '',
    contentId: '',
    priority: 'MEDIUM',
    dueAt: '2026-09-20',
    requester: 'Client — Horizon Marketing',
    assignee: '',
    channels: 'Instagram',
    formats: 'Static',
    outcome: '',
  });

  function patchForm(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
    setCreateDirty(true);
  }

  function requestCloseCreate() {
    if (creating) return;
    if (createDirty && (form.title.trim() || form.description.trim() || form.outcome.trim())) {
      setUnsavedOpen(true);
      return;
    }
    setCreateOpen(false);
    setCreateDirty(false);
  }

  function discardCreate() {
    setUnsavedOpen(false);
    setCreateOpen(false);
    setCreateDirty(false);
    setCreateError(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const graph = await demoApi<DemoGraph>('/graph');
      setRows(graph.requests);
      setBriefs(graph.briefs);
      setBrands(graph.brands);
      setCampaigns(graph.campaigns);
      setError(null);
      setUnavailable(false);
      setForm((f) => ({
        ...f,
        brandId: f.brandId || graph.brands[0]?.id || '',
      }));
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

  const briefByRequest = useMemo(() => {
    const map = new Map<string, Brief>();
    for (const b of briefs) map.set(b.requestId, b);
    return map;
  }, [briefs]);

  const brandName = useCallback(
    (id: string) => {
      const b = brands.find((x) => x.id === id);
      return b ? pickCopy(b.name, locale) : id;
    },
    [brands, locale],
  );

  const campaignName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      const c = campaigns.find((x) => x.id === id);
      return c ? pickCopy(c.name, locale) : id;
    },
    [campaigns, locale],
  );

  const filtered = useMemo(() => filterRequests(rows, filters, locale), [rows, filters, locale]);
  const filterCount = activeRequestFilterCount(filters);
  const requesters = useMemo(() => [...new Set(rows.map((r) => r.requester))], [rows]);
  const assignees = useMemo(
    () => [...new Set(rows.map((r) => r.assignee).filter(Boolean) as string[])],
    [rows],
  );

  async function submitCreate() {
    setCreateError(null);
    if (!form.title.trim() || !form.brandId || !form.dueAt || !form.requester.trim()) {
      setCreateError(t('demo.create.validation'));
      return;
    }
    setCreating(true);
    try {
      const created = await demoApi<RequestRow>('/requests', {
        method: 'POST',
        body: JSON.stringify({
          title: { en: form.title.trim(), ar: form.title.trim() },
          description: {
            en: form.description.trim(),
            ar: form.description.trim(),
          },
          type: form.type,
          brandId: form.brandId,
          campaignId: form.campaignId || null,
          contentId: form.contentId || null,
          priority: form.priority,
          dueAt: form.dueAt,
          requester: form.requester.trim(),
          assignee: form.assignee.trim() || null,
          channels: form.channels
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          formats: form.formats
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          outcome: form.outcome.trim()
            ? { en: form.outcome.trim(), ar: form.outcome.trim() }
            : undefined,
        }),
      });
      toast.push(t('demo.create.successRequest'), 'success');
      setCreateOpen(false);
      setCreateDirty(false);
      setForm((f) => ({ ...f, title: '', description: '', outcome: '' }));
      await load();
      router.push(`/app/requests/${created.id}`);
    } catch (err) {
      setCreateError(demoErrorMessage(err, t('demo.create.validation')));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="oma-stack" data-testid="demo-requests">
      <PageHeader
        title={t('demo.requests.title')}
        description={t('demo.requests.subtitle')}
        actions={
          <button
            type="button"
            className="oma-btn oma-btn-primary"
            data-testid="demo-create-request"
            onClick={() => setCreateOpen(true)}
          >
            {t('demo.requests.new')}
          </button>
        }
      />
      <DemoDisclosure />

      {loading ? (
        <p className="oma-muted" data-testid="demo-requests-loading">
          {t('demo.loading')}
        </p>
      ) : null}
      {unavailable ? (
        <p className="oma-muted" data-testid="demo-requests-denied">
          {t('demo.unavailable')}
        </p>
      ) : null}
      {error ? (
        <div className="oma-card" role="alert" data-testid="demo-requests-error">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {!loading && !unavailable && !error ? (
        <>
          <div className="oma-req-groups" role="tablist" data-testid="demo-request-groups">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                className="oma-btn oma-btn-secondary"
                aria-pressed={filters.group === g}
                data-testid={`demo-request-group-${g}`}
                onClick={() => setFilters((f) => ({ ...f, group: g }))}
              >
                {t(`demo.requests.group.${g}`)}
              </button>
            ))}
          </div>

          <div className="oma-stage4-toolbar" data-testid="demo-request-filters">
            <label className="oma-stage4-search">
              {t('demo.requests.search')}
              <input
                className="oma-input"
                value={filters.q}
                data-testid="demo-request-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.requests.filter.status')}
              <select
                className="oma-select"
                value={filters.status}
                data-testid="demo-request-filter-status"
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {[
                  'OPEN',
                  'ASSIGNED',
                  'IN_BRIEF',
                  'WAITING_INFO',
                  'READY_FOR_PRODUCTION',
                  'IN_PRODUCTION',
                  'DONE',
                  'CLOSED',
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.priority')}
              <select
                className="oma-select"
                value={filters.priority}
                data-testid="demo-request-filter-priority"
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.type')}
              <select
                className="oma-select"
                value={filters.type}
                data-testid="demo-request-filter-type"
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {['CONTENT', 'DESIGN', 'VIDEO', 'CAMPAIGN_SUPPORT', 'REVISION', 'OTHER'].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.brand')}
              <select
                className="oma-select"
                value={filters.brandId}
                data-testid="demo-request-filter-brand"
                onChange={(e) => setFilters((f) => ({ ...f, brandId: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {pickCopy(b.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.campaign')}
              <select
                className="oma-select"
                value={filters.campaignId}
                data-testid="demo-request-filter-campaign"
                onChange={(e) => setFilters((f) => ({ ...f, campaignId: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pickCopy(c.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.requester')}
              <select
                className="oma-select"
                value={filters.requester}
                data-testid="demo-request-filter-requester"
                onChange={(e) => setFilters((f) => ({ ...f, requester: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                {requesters.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.assignee')}
              <select
                className="oma-select"
                value={filters.assignee}
                data-testid="demo-request-filter-assignee"
                onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="unassigned">{t('demo.requests.unassigned')}</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('demo.requests.filter.due')}
              <select
                className="oma-select"
                value={filters.due}
                data-testid="demo-request-filter-due"
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    due: e.target.value as RequestFilters['due'],
                  }))
                }
              >
                <option value="all">{t('demo.filter.all')}</option>
                <option value="overdue">{t('demo.requests.overdue')}</option>
                <option value="soon">{t('demo.requests.dueSoon')}</option>
                <option value="later">{t('demo.requests.dueLater')}</option>
              </select>
            </label>
          </div>

          {filterCount > 0 ? (
            <div className="oma-filter-chips">
              <span className="oma-filter-chip">
                {filterCount} {t('demo.requests.activeFilters')}
              </span>
              <button
                type="button"
                className="oma-btn oma-btn-secondary"
                data-testid="demo-request-clear-filters"
                onClick={() => setFilters(EMPTY_REQUEST_FILTERS)}
              >
                {t('demo.requests.clearFilters')}
              </button>
            </div>
          ) : null}

          <p className="oma-muted" data-testid="demo-request-result-count">
            {filtered.length} / {rows.length}
          </p>

          {filtered.length === 0 ? (
            <EmptyState title={t('demo.empty')} body={t('demo.requests.emptyHint')} />
          ) : (
            <>
              <div className="oma-req-table-wrap oma-req-desktop" data-testid="demo-request-table">
                <table className="oma-req-table">
                  <thead>
                    <tr>
                      <th>{t('demo.requests.col.request')}</th>
                      <th>{t('demo.requests.col.type')}</th>
                      <th>{t('demo.requests.col.requester')}</th>
                      <th>{t('demo.requests.col.brandCampaign')}</th>
                      <th>{t('demo.requests.col.priority')}</th>
                      <th>{t('demo.requests.col.assignee')}</th>
                      <th>{t('demo.requests.col.submitted')}</th>
                      <th>{t('demo.requests.col.due')}</th>
                      <th>{t('demo.requests.col.status')}</th>
                      <th>{t('demo.requests.col.next')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const brief = briefByRequest.get(r.id) ?? null;
                      const missing = requestMissingFields(r);
                      const overdue = requestIsOverdue(r);
                      const next = requestNextAction(r, brief);
                      return (
                        <tr
                          key={r.id}
                          data-overdue={overdue ? 'true' : 'false'}
                          data-missing={missing.length ? 'true' : 'false'}
                          data-testid={`demo-request-row-${r.id}`}
                        >
                          <td>
                            <div className="oma-req-title-cell">
                              <span className="oma-req-avatar" aria-hidden>
                                {initials(r.requester)}
                              </span>
                              <div>
                                <Link href={`/app/requests/${r.id}`} className="oma-text-link">
                                  {pickCopy(r.title, locale)}
                                </Link>
                                <div className="oma-muted" style={{ fontSize: 12 }}>
                                  {r.id.replace('demo-request-', '#')} ·{' '}
                                  {requestCompleteness(r, brief)}%
                                  {missing.length ? ` · ${missing.join(', ')}` : ''}
                                  {` · ${r.updatedAt ?? r.submittedAt}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="oma-sr-only">{t('demo.requests.col.type')}: </span>
                            {r.type}
                          </td>
                          <td>{r.requester}</td>
                          <td>
                            {brandName(r.brandId)}
                            <div className="oma-muted" style={{ fontSize: 12 }}>
                              {campaignName(r.campaignId)}
                            </div>
                          </td>
                          <td>
                            <StatusChip
                              status={r.priority}
                              tone={
                                r.priority === 'URGENT' || r.priority === 'HIGH'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            />
                          </td>
                          <td>
                            <div className="oma-req-title-cell">
                              <span className="oma-req-avatar" aria-hidden>
                                {initials(r.assignee ?? t('demo.requests.unassigned'))}
                              </span>
                              <span>{r.assignee ?? t('demo.requests.unassigned')}</span>
                            </div>
                          </td>
                          <td>{r.submittedAt}</td>
                          <td>{r.dueAt}</td>
                          <td>
                            <StatusChip status={r.status} />
                          </td>
                          <td>{pickCopy(next, locale)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="oma-req-mobile" aria-label={t('demo.requests.title')}>
                {filtered.map((r) => {
                  const brief = briefByRequest.get(r.id) ?? null;
                  const next = requestNextAction(r, brief);
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/app/requests/${r.id}`}
                        className="oma-req-mobile-card"
                        data-testid={`demo-request-mobile-${r.id}`}
                      >
                        <strong>{pickCopy(r.title, locale)}</strong>
                        <div className="oma-chip-row">
                          <StatusChip status={r.status} />
                          <StatusChip status={r.priority} />
                        </div>
                        <span className="oma-muted">
                          {r.assignee ?? t('demo.requests.unassigned')} · {r.dueAt}
                        </span>
                        <span>{pickCopy(next, locale)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      ) : null}

      <Dialog
        open={createOpen}
        onClose={requestCloseCreate}
        title={t('demo.create.requestTitle')}
        labelledBy="demo-create-request-title"
      >
        <div data-testid="demo-create-request-dialog" className="oma-stack">
          <h2 id="demo-create-request-title" className="oma-dialog-title">
            {t('demo.create.requestTitle')}
          </h2>
          {createError ? (
            <p role="alert" style={{ color: 'var(--status-danger)' }}>
              {createError}
            </p>
          ) : null}
          <label>
            {t('demo.requests.filter.type')}
            <select
              className="oma-select"
              value={form.type}
              data-testid="demo-create-request-type"
              onChange={(e) => patchForm({ type: e.target.value })}
            >
              {['CONTENT', 'DESIGN', 'VIDEO', 'CAMPAIGN_SUPPORT', 'REVISION', 'OTHER'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.create.title')}
            <input
              className="oma-input"
              value={form.title}
              data-testid="demo-create-request-title-input"
              onChange={(e) => patchForm({ title: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.description')}
            <textarea
              className="oma-input"
              rows={3}
              value={form.description}
              data-testid="demo-create-request-description"
              onChange={(e) => patchForm({ description: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.brand')}
            <select
              className="oma-select"
              value={form.brandId}
              data-testid="demo-create-request-brand"
              onChange={(e) => patchForm({ brandId: e.target.value })}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {pickCopy(b.name, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.create.campaign')}
            <select
              className="oma-select"
              value={form.campaignId}
              data-testid="demo-create-request-campaign"
              onChange={(e) => patchForm({ campaignId: e.target.value })}
            >
              <option value="">{t('demo.optional')}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickCopy(c.name, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.requests.outcome')}
            <input
              className="oma-input"
              value={form.outcome}
              data-testid="demo-create-request-objective"
              onChange={(e) => patchForm({ outcome: e.target.value })}
            />
          </label>
          <label>
            {t('demo.create.channels')}
            <input
              className="oma-input"
              value={form.channels}
              data-testid="demo-create-request-channels"
              onChange={(e) => patchForm({ channels: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.formats')}
            <input
              className="oma-input"
              value={form.formats}
              data-testid="demo-create-request-formats"
              onChange={(e) => patchForm({ formats: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.priority')}
            <select
              className="oma-select"
              value={form.priority}
              data-testid="demo-create-request-priority"
              onChange={(e) => patchForm({ priority: e.target.value })}
            >
              {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('demo.requests.col.due')}
            <input
              className="oma-input"
              type="date"
              value={form.dueAt}
              data-testid="demo-create-request-due"
              onChange={(e) => patchForm({ dueAt: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.requester')}
            <input
              className="oma-input"
              value={form.requester}
              data-testid="demo-create-request-requester"
              onChange={(e) => patchForm({ requester: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.assignee')}
            <input
              className="oma-input"
              value={form.assignee}
              data-testid="demo-create-request-assignee"
              onChange={(e) => patchForm({ assignee: e.target.value })}
              placeholder={t('demo.optional')}
            />
          </label>
          <p className="oma-muted" data-testid="demo-create-request-refs">
            {t('demo.optional')}: content / reference placeholders (Demo)
          </p>
          <div className="oma-chip-row">
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              disabled={creating}
              onClick={requestCloseCreate}
            >
              {t('demo.create.cancel')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-primary"
              disabled={creating}
              data-testid="demo-create-request-submit"
              onClick={() => void submitCreate()}
            >
              {creating ? t('demo.create.creating') : t('demo.create.confirm')}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={unsavedOpen}
        title={t('demo.create.cancel')}
        onClose={() => setUnsavedOpen(false)}
      >
        <p data-testid="demo-create-request-unsaved">{t('demo.content.unsaved')}</p>
        <div className="oma-chip-row">
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => setUnsavedOpen(false)}
          >
            {t('demo.create.cancel')}
          </button>
          <button type="button" className="oma-btn oma-btn-primary" onClick={discardCreate}>
            OK
          </button>
        </div>
      </Dialog>

      <Panel title={t('demo.honesty.ai')}>
        <p className="oma-muted" style={{ margin: 0 }}>
          {t('demo.honesty.ai')}
        </p>
      </Panel>
    </div>
  );
}
