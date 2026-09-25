'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph } from '@oma/demo';
import { Button, DatePicker, Input, OmaSelect, SelectField, TextArea } from '@oma/ui/controls';
import dayjs from 'dayjs';
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
          <Button
            type="primary"
            data-testid="demo-create-request"
            onClick={() => setCreateOpen(true)}
          >
            {t('demo.requests.new')}
          </Button>
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
              <Button
                type={filters.group === g ? 'primary' : 'default'}
                aria-pressed={filters.group === g}
                data-testid={`demo-request-group-${g}`}
                onClick={() => setFilters((f) => ({ ...f, group: g }))}
              >
                {t(`demo.requests.group.${g}`)}
              </Button>
            ))}
          </div>

          <div className="oma-stage4-toolbar" data-testid="demo-request-filters">
            <label className="oma-stage4-search">
              {t('demo.requests.search')}
              <Input
                value={filters.q}
                data-testid="demo-request-search"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </label>
            <label>
              {t('demo.requests.filter.status')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.priority')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.type')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.brand')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.campaign')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.requester')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.assignee')}
              <SelectField
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
              </SelectField>
            </label>
            <label>
              {t('demo.requests.filter.due')}
              <SelectField
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
              </SelectField>
            </label>
          </div>

          {filterCount > 0 ? (
            <div className="oma-filter-chips">
              <span className="oma-filter-chip">
                {filterCount} {t('demo.requests.activeFilters')}
              </span>
              <Button
                type="default"
                data-testid="demo-request-clear-filters"
                onClick={() => setFilters(EMPTY_REQUEST_FILTERS)}
              >
                {t('demo.requests.clearFilters')}
              </Button>
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
            <OmaSelect
              value={form.type}
              testId="demo-create-request-type"
              onChange={(type) => patchForm({ type })}
              options={['CONTENT', 'DESIGN', 'VIDEO', 'CAMPAIGN_SUPPORT', 'REVISION', 'OTHER'].map(
                (s) => ({ value: s, label: s }),
              )}
            />
          </label>
          <label>
            {t('demo.create.title')}
            <Input
              value={form.title}
              data-testid="demo-create-request-title-input"
              onChange={(e) => patchForm({ title: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.description')}
            <TextArea
              rows={3}
              value={form.description}
              data-testid="demo-create-request-description"
              onChange={(e) => patchForm({ description: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.brand')}
            <OmaSelect
              value={form.brandId}
              testId="demo-create-request-brand"
              onChange={(brandId) => patchForm({ brandId })}
              options={brands.map((b) => ({ value: b.id, label: pickCopy(b.name, locale) }))}
            />
          </label>
          <label>
            {t('demo.create.campaign')}
            <OmaSelect
              value={form.campaignId}
              testId="demo-create-request-campaign"
              onChange={(campaignId) => patchForm({ campaignId })}
              options={[
                { value: '', label: t('demo.optional') },
                ...campaigns.map((c) => ({ value: c.id, label: pickCopy(c.name, locale) })),
              ]}
            />
          </label>
          <label>
            {t('demo.requests.outcome')}
            <Input
              value={form.outcome}
              data-testid="demo-create-request-objective"
              onChange={(e) => patchForm({ outcome: e.target.value })}
            />
          </label>
          <label>
            {t('demo.create.channels')}
            <Input
              value={form.channels}
              data-testid="demo-create-request-channels"
              onChange={(e) => patchForm({ channels: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.formats')}
            <Input
              value={form.formats}
              data-testid="demo-create-request-formats"
              onChange={(e) => patchForm({ formats: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.priority')}
            <OmaSelect
              value={form.priority}
              testId="demo-create-request-priority"
              onChange={(priority) => patchForm({ priority })}
              options={['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({ value: s, label: s }))}
            />
          </label>
          <label>
            {t('demo.requests.col.due')}
            <DatePicker
              data-testid="demo-create-request-due"
              value={form.dueAt ? dayjs(form.dueAt) : null}
              onChange={(_, dateString) =>
                patchForm({
                  dueAt: Array.isArray(dateString) ? (dateString[0] ?? '') : dateString,
                })
              }
            />
          </label>
          <label>
            {t('demo.requests.filter.requester')}
            <Input
              value={form.requester}
              data-testid="demo-create-request-requester"
              onChange={(e) => patchForm({ requester: e.target.value })}
            />
          </label>
          <label>
            {t('demo.requests.filter.assignee')}
            <Input
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
            <Button disabled={creating} onClick={requestCloseCreate}>
              {t('demo.create.cancel')}
            </Button>
            <Button
              type="primary"
              loading={creating}
              data-testid="demo-create-request-submit"
              onClick={() => void submitCreate()}
            >
              {t('demo.create.confirm')}
            </Button>
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
          <Button type="default" onClick={() => setUnsavedOpen(false)}>
            {t('demo.create.cancel')}
          </Button>
          <Button type="primary" onClick={discardCreate}>
            OK
          </Button>
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
