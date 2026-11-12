'use client';

import { useReloadOnBrandChange } from '../../../../lib/active-brand';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlxHeaderFilter } from '../../../../components/ui/plx-header-filter';
import type { DemoGraph } from '@oma/demo';
import { Button, DatePicker, Input, OmaSelect, TextArea } from '@oma/ui/controls';
import { ChannelChoiceCards } from '../../../../components/content/channel-choice-cards';
import { listWorkspaceMembers, type WorkspaceMember } from '../../../../lib/team-api';
import { api } from '../../../../lib/api';
import dayjs from 'dayjs';
import { Dialog } from '../../../../components/ui/dialog';
import { EmptyState } from '../../../../components/ui/empty-state';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import { pickCopy } from '../../../../lib/demo/use-demo-api';
import { daysFromToday } from '../../../../lib/calendar-today';
import {
  loadRequestsWorkspace,
  listRequests,
  createRequest,
  toRequestRow,
  opsError,
} from '../../../../lib/ops-api';
import {
  EMPTY_REQUEST_FILTERS,
  activeRequestFilterCount,
  filterRequests,
  requestIsOverdue,
  requestMissingFields,
  requestNextAction,
  type RequestFilters,
  type RequestGroup,
  type RequestRow,
} from '../../../../lib/demo/stage4-requests';
import { useLocale, useT } from '../../../../lib/use-locale';
import { RequestsShimmer } from '../../../../components/ui/screen-shimmer';
import {
  SearchOutlined,
  CheckCircleOutlined,
  FlagOutlined,
  AppstoreOutlined,
  TagOutlined,
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  UpOutlined,
} from '../../../../components/ui/lucide-icons';

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

type RequestBrief = {
  objective?: { en?: string; ar?: string };
  audience?: { en?: string; ar?: string };
  key_message?: { en?: string; ar?: string };
  ready?: boolean;
};

function hasCopy(value?: { en?: string; ar?: string } | null): boolean {
  return Boolean(value?.en?.trim() || value?.ar?.trim());
}

function formatRequestWhen(value: string | undefined, locale: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function requestRowMeta(
  row: RequestRow & { apiBrief?: RequestBrief | null },
  locale: string,
  t: (key: string) => string,
): string {
  const brief = row.apiBrief ?? null;
  const checks = [
    hasCopy(row.title),
    hasCopy(row.description),
    Boolean(row.assignee),
    Boolean(row.campaignId),
    Boolean(row.channels?.length),
    Boolean(row.formats?.length),
    hasCopy(brief?.objective),
    hasCopy(brief?.audience),
    hasCopy(brief?.key_message),
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missing: string[] = [];
  if (!row.assignee) missing.push(t('demo.requests.col.assignee'));
  if (!row.campaignId) missing.push(t('demo.requests.col.brandCampaign'));
  if (!row.channels?.length) missing.push(t('demo.brief.channels'));
  if (!row.formats?.length) missing.push(t('demo.brief.formats') || 'Formats');
  if (!hasCopy(brief?.objective)) missing.push(t('demo.brief.objective'));
  if (!hasCopy(brief?.audience)) missing.push(t('demo.brief.audience'));
  if (!hasCopy(brief?.key_message)) missing.push(t('demo.brief.message'));
  const state = brief?.ready
    ? t('demo.brief.ready')
    : missing.length
      ? `${t('demo.requests.missing')}: ${missing.join(', ')}`
      : t('demo.brief.notReady');
  const when = formatRequestWhen(row.updatedAt || row.submittedAt, locale);
  return [state, `${pct}%`, when].filter(Boolean).join(' · ');
}

export default function RequestsPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategyVersionFromUrl = searchParams.get('strategy_version');
  const brandFromUrl = searchParams.get('brand');
  const toast = useToast();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_REQUEST_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [filterSection, setFilterSection] = useState<string | null>('status');
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
    dueAt: daysFromToday(14),
    requester: '',
    assignee: '',
    channels: '',
    formats: 'Static',
    outcome: '',
  });

  function patchForm(patch: Partial<typeof form>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.brandId && patch.brandId !== f.brandId) {
        const belongs = campaigns.some(
          (c) => c.id === next.campaignId && c.brandId === patch.brandId,
        );
        if (!belongs) next.campaignId = '';
      }
      return next;
    });
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
      const ws = await loadRequestsWorkspace();
      let requestRows = ws.requests;
      if (brandFromUrl && strategyVersionFromUrl) {
        const scoped = await listRequests(brandFromUrl, {
          strategy_version_id: strategyVersionFromUrl,
        });
        requestRows = scoped.map(toRequestRow);
        setFilters((f) => ({ ...f, brandId: brandFromUrl }));
      }
      setRows(requestRows);
      setBriefs([]);
      setBrands(ws.brands as Brand[]);
      setCampaigns(ws.campaigns as Campaign[]);
      void listWorkspaceMembers()
        .then(setMembers)
        .catch(() => setMembers([]));
      setError(null);
      setUnavailable(false);
      setForm((f) => ({
        ...f,
        brandId: f.brandId || ws.brands[0]?.id || '',
        requester: f.requester,
      }));
    } catch (err) {
      setError(
        opsError(
          err,
          locale.toLowerCase().startsWith('ar') ? 'تعذّر تحميل الطلبات' : 'Failed to load requests',
        ),
      );
      setRows([]);
      setBrands([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [locale, brandFromUrl, strategyVersionFromUrl]);

  useEffect(() => {
    setHeaderSlot(document.getElementById('oma-workspace-top-actions'));
  }, []);

  // Refresh when the active brand changes in the header switcher.
  useReloadOnBrandChange(load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<{ user?: { name?: string | null; email?: string | null } }>('/api/v1/auth/me')
      .then((me) => {
        const name = me.user?.name || me.user?.email || '';
        if (name) setForm((f) => ({ ...f, requester: f.requester || name }));
      })
      .catch(() => undefined);
  }, []);

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

  const brandCampaigns = useMemo(
    () => campaigns.filter((c) => !form.brandId || c.brandId === form.brandId),
    [campaigns, form.brandId],
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
    if (!form.title.trim() || !form.brandId || !form.dueAt) {
      setCreateError(t('demo.create.validation'));
      return;
    }
    const campaignOk = campaigns.some(
      (c) => c.id === form.campaignId && c.brandId === form.brandId,
    );
    const objective = form.outcome.trim();
    setCreating(true);
    try {
      const createdApi = await createRequest(form.brandId, {
        title: { en: form.title.trim(), ar: form.title.trim() },
        description: {
          en: form.description.trim(),
          ar: form.description.trim(),
        },
        type: form.type,
        campaignId: campaignOk ? form.campaignId : null,
        contentId: form.contentId || null,
        priority: form.priority,
        dueAt: form.dueAt ? `${form.dueAt}T12:00:00.000Z` : null,
        assigneeUserId: form.assignee || null,
        channels: form.channels
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        formats: form.formats
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        brief: objective ? { objective: { en: objective, ar: objective } } : undefined,
      });
      const created = toRequestRow(createdApi);
      toast.push(t('demo.create.successRequest'), 'success');
      setCreateOpen(false);
      setCreateDirty(false);
      setForm((f) => ({ ...f, title: '', description: '', outcome: '' }));
      await load();
      router.push(`/app/requests/${created.id}`);
    } catch (err) {
      setCreateError(opsError(err, t('demo.create.validation')));
    } finally {
      setCreating(false);
    }
  }

  const filterLabel = locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter';
  const filterPanelTitle = locale.toLowerCase().startsWith('ar') ? 'تصفية وترتيب' : 'Filter & sort';

  return (
    <div
      className="oma-plx-listening oma-plx-requests"
      data-testid="demo-requests"
      data-filter-open={filterSheet ? 'true' : 'false'}
    >
      <PlxHeaderFilter
        headerSlot={headerSlot}
        open={filterSheet}
        onOpenChange={setFilterSheet}
        filterTestId="demo-request-open-filters"
        filterLabel={filterLabel}
        filterCount={filterCount}
        panelTitle={filterPanelTitle}
        panelTestId="demo-request-filters"
        createTestId="demo-create-request"
        createLabel={t('demo.requests.new')}
        onCreateClick={() => setCreateOpen(true)}
        footer={
          filterCount > 0 ? (
            <Button
              type="default"
              data-testid="demo-request-clear-filters"
              onClick={() => setFilters(EMPTY_REQUEST_FILTERS)}
            >
              {t('demo.requests.clearFilters')}
            </Button>
          ) : null
        }
      >
        <div className="oma-filter-accordion-list oma-plx-deliv-filter-accordion-list">
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'search' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <SearchOutlined />
              </span>
              <span>{t('demo.requests.search')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'search' ? (
              <div className="oma-filter-accordion__body">
                <Input
                  value={filters.q}
                  data-testid="demo-request-search"
                  placeholder={t('demo.requests.search')}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                />
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'status' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'status' ? null : 'status'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <CheckCircleOutlined />
              </span>
              <span>{t('demo.requests.filter.status')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'status' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'status' ? (
              <div className="oma-filter-accordion__body">
                {[
                  'all',
                  'OPEN',
                  'ASSIGNED',
                  'IN_BRIEF',
                  'WAITING_INFO',
                  'READY_FOR_PRODUCTION',
                  'IN_PRODUCTION',
                  'DONE',
                  'CLOSED',
                ].map((s) => (
                  <label key={s} className="oma-filter-check">
                    <input
                      type="checkbox"
                      data-testid={s === 'all' ? 'demo-request-filter-status' : undefined}
                      checked={(filters.status || 'all') === s}
                      onChange={() => setFilters((f) => ({ ...f, status: s }))}
                    />
                    <span>{s === 'all' ? t('demo.filter.all') : s}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'priority' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'priority' ? null : 'priority'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FlagOutlined />
              </span>
              <span>{t('demo.requests.filter.priority')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'priority' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'priority' ? (
              <div className="oma-filter-accordion__body">
                {['all', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                  <label key={s} className="oma-filter-check">
                    <input
                      type="checkbox"
                      data-testid={s === 'all' ? 'demo-request-filter-priority' : undefined}
                      checked={(filters.priority || 'all') === s}
                      onChange={() => setFilters((f) => ({ ...f, priority: s }))}
                    />
                    <span>{s === 'all' ? t('demo.filter.all') : s}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'type' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'type' ? null : 'type'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <AppstoreOutlined />
              </span>
              <span>{t('demo.requests.filter.type')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'type' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'type' ? (
              <div className="oma-filter-accordion__body">
                {['all', 'CONTENT', 'DESIGN', 'VIDEO', 'CAMPAIGN_SUPPORT', 'REVISION', 'OTHER'].map(
                  (s) => (
                    <label key={s} className="oma-filter-check">
                      <input
                        type="checkbox"
                        data-testid={s === 'all' ? 'demo-request-filter-type' : undefined}
                        checked={(filters.type || 'all') === s}
                        onChange={() => setFilters((f) => ({ ...f, type: s }))}
                      />
                      <span>{s === 'all' ? t('demo.filter.all') : s}</span>
                    </label>
                  ),
                )}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'brand' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'brand' ? null : 'brand'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <TagOutlined />
              </span>
              <span>{t('demo.requests.filter.brand')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'brand' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'brand' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="checkbox"
                    data-testid="demo-request-filter-brand"
                    checked={(filters.brandId || 'all') === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, brandId: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {brands.map((b) => (
                  <label key={b.id} className="oma-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.brandId === b.id}
                      onChange={() => setFilters((f) => ({ ...f, brandId: b.id }))}
                    />
                    <span>{pickCopy(b.name, locale)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'campaign' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'campaign' ? null : 'campaign'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <FlagOutlined />
              </span>
              <span>{t('demo.requests.filter.campaign')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'campaign' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'campaign' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="checkbox"
                    data-testid="demo-request-filter-campaign"
                    checked={(filters.campaignId || 'all') === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, campaignId: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {campaigns.map((c) => (
                  <label key={c.id} className="oma-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.campaignId === c.id}
                      onChange={() => setFilters((f) => ({ ...f, campaignId: c.id }))}
                    />
                    <span>{pickCopy(c.name, locale)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'requester' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'requester' ? null : 'requester'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <UserOutlined />
              </span>
              <span>{t('demo.requests.filter.requester')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'requester' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'requester' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="checkbox"
                    data-testid="demo-request-filter-requester"
                    checked={(filters.requester || 'all') === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, requester: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {requesters.map((r) => (
                  <label key={r} className="oma-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.requester === r}
                      onChange={() => setFilters((f) => ({ ...f, requester: r }))}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'assignee' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'assignee' ? null : 'assignee'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <TeamOutlined />
              </span>
              <span>{t('demo.requests.filter.assignee')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'assignee' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'assignee' ? (
              <div className="oma-filter-accordion__body">
                <label className="oma-filter-check">
                  <input
                    type="checkbox"
                    data-testid="demo-request-filter-assignee"
                    checked={(filters.assignee || 'all') === 'all'}
                    onChange={() => setFilters((f) => ({ ...f, assignee: 'all' }))}
                  />
                  <span>{t('demo.filter.all')}</span>
                </label>
                {assignees.map((a) => (
                  <label key={a} className="oma-filter-check">
                    <input
                      type="checkbox"
                      checked={filters.assignee === a}
                      onChange={() => setFilters((f) => ({ ...f, assignee: a }))}
                    />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'due' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'due' ? null : 'due'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                <CalendarOutlined />
              </span>
              <span>{t('demo.requests.filter.due')}</span>
              <span className="oma-filter-accordion__caret">
                {filterSection === 'due' ? <UpOutlined /> : <DownOutlined />}
              </span>
            </button>
            {filterSection === 'due' ? (
              <div className="oma-filter-accordion__body">
                {(
                  [
                    { value: 'all', label: t('demo.filter.all') },
                    { value: 'overdue', label: t('demo.requests.overdue') },
                    { value: 'soon', label: t('demo.requests.dueSoon') },
                    { value: 'later', label: t('demo.requests.dueLater') },
                  ] as const
                ).map((opt) => (
                  <label key={opt.value} className="oma-filter-check">
                    <input
                      type="checkbox"
                      data-testid={opt.value === 'all' ? 'demo-request-filter-due' : undefined}
                      checked={(filters.due || 'all') === opt.value}
                      onChange={() =>
                        setFilters((f) => ({
                          ...f,
                          due: opt.value as RequestFilters['due'],
                        }))
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </PlxHeaderFilter>

      <div className="oma-plx-workspace-surface">
        <div className="oma-plx-listening__intro oma-plx-deliv__intro">
          <div>
            <h1 className="oma-plx-listening__title">{t('demo.requests.title')}</h1>
            <p className="oma-plx-deliv__subtitle">{t('demo.requests.subtitle')}</p>
          </div>
          {!loading && !unavailable && !error ? (
            <p className="oma-plx-listening__next-check" data-testid="demo-request-result-count">
              {filtered.length} / {rows.length}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div data-testid="demo-requests-loading">
            <RequestsShimmer part="body" />
          </div>
        ) : null}
        {unavailable ? (
          <p className="oma-muted" data-testid="demo-requests-denied">
            {t('demo.unavailable')}
          </p>
        ) : null}
        {error ? (
          <div className="oma-inbox-error" role="alert" data-testid="demo-requests-error">
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        ) : null}

        {!loading && !unavailable && !error ? (
          <section className="oma-plx-listening-panel oma-plx-requests-panel">
            <header className="oma-plx-deliv-panel__head">
              <div
                className="oma-plx-deliv-groups oma-plx-requests-tabs"
                role="tablist"
                data-testid="demo-request-groups"
              >
                {GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={filters.group === g}
                    className={`oma-plx-deliv-groups__btn${filters.group === g ? ' is-active' : ''}`}
                    data-active={filters.group === g ? 'true' : 'false'}
                    data-testid={`demo-request-group-${g}`}
                    onClick={() => setFilters((f) => ({ ...f, group: g }))}
                  >
                    {t(`demo.requests.group.${g}`)}
                  </button>
                ))}
              </div>
            </header>
            <div className="oma-plx-deliv-panel__body oma-plx-requests-panel__body">
              {filtered.length === 0 ? (
                <EmptyState title={t('demo.empty')} body={t('demo.requests.emptyHint')} />
              ) : (
                <>
                  <div
                    className="oma-plx-deliv-table-wrap oma-plx-requests-table oma-req-table-wrap"
                    data-testid="demo-request-table"
                  >
                    <table className="oma-plx-deliv-table oma-req-table">
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
                                      {requestRowMeta(r, locale, t)}
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

                  <ul
                    className="oma-plx-request-feed oma-plx-requests-cards"
                    aria-label={t('demo.requests.title')}
                  >
                    {filtered.map((r) => {
                      const brief = briefByRequest.get(r.id) ?? null;
                      const next = requestNextAction(r, brief);
                      const missing = requestMissingFields(r);
                      const overdue = requestIsOverdue(r);
                      return (
                        <li key={r.id}>
                          <Link
                            href={`/app/requests/${r.id}`}
                            className="oma-plx-listening-card oma-plx-request-card"
                            data-testid={`demo-request-mobile-${r.id}`}
                            data-overdue={overdue ? 'true' : 'false'}
                          >
                            <div className="oma-plx-listening-card__top oma-plx-request-card__top">
                              <div className="oma-plx-listening-card__author">
                                <span className="oma-plx-request-card__avatar" aria-hidden>
                                  {initials(r.requester)}
                                </span>
                                <div className="oma-plx-listening-card__author-text">
                                  <div className="oma-plx-listening-card__name-row">
                                    <strong>{pickCopy(r.title, locale)}</strong>
                                  </div>
                                  <span className="oma-plx-request-card__meta">
                                    {r.requester} · {r.dueAt}
                                  </span>
                                </div>
                              </div>
                              <StatusChip status={r.status} />
                            </div>
                            <div className="oma-plx-listening-card__foot oma-plx-request-card__foot">
                              <StatusChip status={r.priority} />
                              <span>{pickCopy(next, locale)}</span>
                              {missing.length ? (
                                <span className="oma-plx-request-card__warn">
                                  {t('demo.requests.missing')}
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>

      <Dialog
        open={createOpen}
        onClose={requestCloseCreate}
        title={t('demo.create.requestTitle')}
        labelledBy="demo-create-request-title"
        size="lg"
        className="oma-compose-dialog oma-plx-compose-dialog"
        footer={
          <div className="oma-plx-compose-dialog__foot">
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
        }
      >
        <div data-testid="demo-create-request-dialog" className="oma-compose oma-plx-compose">
          {createError ? (
            <p className="oma-compose__alert" role="alert">
              {createError}
            </p>
          ) : null}
          <section className="oma-plx-listening-panel oma-plx-compose-panel">
            <div className="oma-compose__grid oma-plx-compose__grid">
              <label className="oma-compose__wide">
                {t('demo.create.title')}
                <Input
                  value={form.title}
                  data-testid="demo-create-request-title-input"
                  onChange={(e) => patchForm({ title: e.target.value })}
                />
              </label>
              <label>
                {t('demo.requests.filter.type')}
                <OmaSelect
                  value={form.type}
                  testId="demo-create-request-type"
                  onChange={(type) => patchForm({ type })}
                  options={[
                    'CONTENT',
                    'DESIGN',
                    'VIDEO',
                    'CAMPAIGN_SUPPORT',
                    'REVISION',
                    'OTHER',
                  ].map((s) => ({ value: s, label: s.replaceAll('_', ' ') }))}
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
                    ...brandCampaigns.map((c) => ({
                      value: c.id,
                      label: pickCopy(c.name, locale),
                    })),
                  ]}
                />
              </label>
              <label className="oma-compose__wide">
                {t('demo.requests.description')}
                <TextArea
                  rows={3}
                  value={form.description}
                  data-testid="demo-create-request-description"
                  onChange={(e) => patchForm({ description: e.target.value })}
                />
              </label>
              <label className="oma-compose__wide">
                {t('demo.requests.outcome')}
                <Input
                  value={form.outcome}
                  data-testid="demo-create-request-objective"
                  onChange={(e) => patchForm({ outcome: e.target.value })}
                />
              </label>
              <div className="oma-compose__wide">
                <span className="oma-compose__label">{t('demo.create.channels')}</span>
                <ChannelChoiceCards
                  brandId={form.brandId}
                  value={form.channels}
                  locale={locale}
                  multiple
                  testId="demo-create-request-channels"
                  onChange={(channels) => patchForm({ channels })}
                />
              </div>
              <div className="oma-compose__wide" data-testid="demo-create-request-formats">
                <span className="oma-compose__label">{t('demo.requests.formats')}</span>
                <div className="oma-compose__chips">
                  {['Static', 'Carousel', 'Reel', 'Story', 'Video'].map((format) => {
                    const selected = form.formats
                      .split(',')
                      .map((part) => part.trim())
                      .includes(format);
                    return (
                      <button
                        key={format}
                        type="button"
                        className="oma-compose__chip"
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => {
                          const current = form.formats
                            .split(',')
                            .map((part) => part.trim())
                            .filter(Boolean);
                          const next = selected
                            ? current.filter((part) => part !== format)
                            : [...current, format];
                          patchForm({ formats: next.join(', ') });
                        }}
                      >
                        {format}
                      </button>
                    );
                  })}
                </div>
              </div>
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
                {t('demo.requests.filter.assignee')}
                <OmaSelect
                  value={form.assignee}
                  testId="demo-create-request-assignee"
                  onChange={(assignee) => patchForm({ assignee })}
                  options={[
                    { value: '', label: t('demo.requests.unassigned') },
                    ...members
                      .filter((m) => m.user?.id)
                      .map((m) => ({
                        value: m.user!.id,
                        label: m.user?.name || m.user?.email || m.invited_email || 'Member',
                      })),
                  ]}
                />
              </label>
              <p className="oma-compose__note" data-testid="demo-create-request-requester">
                {t('demo.requests.filter.requester')}: {form.requester || '—'}
              </p>
            </div>
          </section>
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
    </div>
  );
}
