'use client';
import { CardGridShimmer } from '../../../../components/ui/shimmer';
import { openSettings } from '../../../../lib/settings-dialog';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../../lib/api';
import { announceBrandLogo, setActiveBrandId } from '../../../../lib/active-brand';
import {
  brandSettingsApi,
  readLogoFile,
  timezoneOptions,
  type SocialNetwork,
} from '../../../../lib/brand-settings-api';
import { updateContentPreferences } from '../../../../lib/content-api';
import { TeamInviteDialog } from '../../../../components/team/team-invite-dialog';
import { OmaDotsLoader, OmaDotsLoaderOverlay } from '../../../../components/ui/oma-dots-loader';
import {
  BriefcaseIcon,
  CardIcon,
  ChartIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CloseIcon,
  CrownIcon,
  HelpIcon,
  ImageIcon,
  LinkIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparkleIcon,
  StarIcon,
  UserPlusIcon,
  UsersIcon,
  PlxLogo,
} from '../../../../components/ui/plx-icons';
import './planable-dashboard.css';
import { useLocale, useT } from '../../../../lib/use-locale';
import { NotificationsBell } from '../../../../components/shell/notifications-bell';
import { UserMenu } from '../../../../components/shell/user-menu';

type Me = {
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

/** Planable "workspace" = brand workspace under the active company (tenant). */
type BrandWorkspace = {
  id: string;
  name: string;
  status?: string;
  primary_website_url?: string | null;
  logo_url?: string | null;
  updated_at?: string;
};

const FAV_KEY = 'plx-favorite-workspaces';

const PLATFORMS: Array<{ name: string; color: string }> = [
  { name: 'Facebook', color: '#1877F2' },
  { name: 'X (Twitter)', color: '#111111' },
  { name: 'Instagram', color: '#E4405F' },
  { name: 'LinkedIn', color: '#0A66C2' },
  { name: 'Google Business Profile', color: '#4285F4' },
  { name: 'YouTube', color: '#FF0000' },
  { name: 'TikTok', color: '#111827' },
  { name: 'Pinterest', color: '#E60023' },
  { name: 'Threads', color: '#111827' },
  { name: 'Universal Content', color: '#374151' },
  { name: 'Newsletters', color: '#F59E0B' },
];

const PLATFORM_NETWORK: Record<string, SocialNetwork | 'universal'> = {
  Facebook: 'facebook',
  'X (Twitter)': 'x',
  Instagram: 'instagram',
  LinkedIn: 'linkedin',
  TikTok: 'tiktok',
  'Universal Content': 'universal',
};

const LABEL_KEYS: Record<string, string> = {
  "Administrator": 'companies.role.admin',
  "Writer": 'companies.role.writer',
  "Billing Manager": 'companies.role.billing',
  "Can manage workspaces, people and billing plan": 'companies.role.admin_desc',
  "Has editing access to all workspaces, but cannot create workspaces or invite people": 'companies.role.writer_desc',
  "Can manage billing plan, change payment details & see invoices": 'companies.role.billing_desc',
  "Comment on posts": 'companies.perm.comment',
  "Manage workspaces and collaborators": 'companies.perm.manage',
  "Create and edit posts": 'companies.perm.edit',
  "View invoices and manage billing": 'companies.perm.billing',
  "Company ownership": 'companies.perm.ownership',
  "X (Twitter)": 'companies.platform.x',
  "Google Business Profile": 'companies.platform.gbp',
  "Universal Content": 'companies.platform.universal',
  "Newsletters": 'companies.platform.newsletters',
  "Workspace name is required": 'companies.name_required',
  "Facebook": 'companies.platform.facebook',
  "Instagram": 'companies.platform.instagram',
  "LinkedIn": 'companies.platform.linkedin',
  "YouTube": 'companies.platform.youtube',
  "TikTok": 'companies.platform.tiktok',
  "Pinterest": 'companies.platform.pinterest',
  "Threads": 'companies.platform.threads',
};

function initials(name: string) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function PlanableDashboard() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandWorkspace[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [wsMenuFor, setWsMenuFor] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [workspaceQuery, setWorkspaceQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [timezones] = useState(() => timezoneOptions(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [wsName, setWsName] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [wsTz, setWsTz] = useState(() => {
    const list = timezoneOptions();
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (list.includes(guess)) return guess;
    if (list.includes('Asia/Dubai')) return 'Asia/Dubai';
    return list[0] ?? 'UTC';
  });
  const [pageName, setPageName] = useState('');
  const [pageLogo, setPageLogo] = useState<string | null>(null);
  const [pageColor, setPageColor] = useState('#1677ff');
  const [contentStyle, setContentStyle] = useState<'default' | 'classic' | 'modern' | 'compact'>(
    'default',
  );
  const createdBrandId = useRef<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(m);
        if (m.active_tenant_id) {
          setBrandsLoading(true);
          try {
            const list = await api<{ data: BrandWorkspace[] }>('/api/v1/brands?limit=100');
            if (!cancelled) setBrands(Array.isArray(list.data) ? list.data : []);
          } catch {
            if (!cancelled) setBrands([]);
          } finally {
            if (!cancelled) setBrandsLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'));
    } catch {
      setFavorites([]);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setCompanyMenuOpen(false);
        setWsMenuFor(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setCompanyMenuOpen(false);
        setWsMenuFor(null);
        setInviteOpen(false);
        setCreateOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = inviteOpen || createOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [inviteOpen, createOpen]);

  const memberships = useMemo(() => me?.memberships ?? [], [me]);
  const needsCompanyPick = Boolean(me && !me.active_tenant_id && memberships.length > 0);
  const primary = useMemo(() => {
    if (memberships.length === 0) return [];
    // Multi-company with no active tenant: do not invent a "primary" that cannot
    // load brands — every company is shown as an activatable card instead.
    if (!me?.active_tenant_id) return [];
    const active = memberships.find((m) => m.tenant_id === me.active_tenant_id);
    return active ? [active] : [];
  }, [memberships, me?.active_tenant_id]);
  const others = useMemo(() => {
    return memberships;
  }, [memberships]);
  const normalizedWorkspaceQuery = workspaceQuery.trim().toLowerCase();
  const visibleBrands = useMemo(() => {
    if (!normalizedWorkspaceQuery) return brands;
    return brands.filter((brand) =>
      [brand.name, brand.primary_website_url, brand.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedWorkspaceQuery)),
    );
  }, [brands, normalizedWorkspaceQuery]);
  const visibleOthers = useMemo(() => {
    if (!normalizedWorkspaceQuery) return others;
    return others.filter((membership) =>
      membership.tenant_name.toLowerCase().includes(normalizedWorkspaceQuery),
    );
  }, [others, normalizedWorkspaceQuery]);

  const companyName =
    primary[0]?.tenant_name ??
    (needsCompanyPick ? (t('selectCompany.title')) : null) ??
    me?.user?.name ??
    me?.name ??
    'Workspace';

  function toggleFav(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }

  async function activate(tenantId: string) {
    if (!tenantId || activating) return;
    setActivating(tenantId);
    try {
      await api('/api/v1/tenants/active', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setActiveBrandId(null);
      window.location.assign('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActivating(null);
    }
  }

  function openCreate() {
    router.push('/app/workspaces/new');
  }

  async function ensureBrand(): Promise<string> {
    if (createdBrandId.current) return createdBrandId.current;
    if (!wsName.trim()) throw new Error(t('companies.name_required'));
    let tenantId = me?.active_tenant_id;
    if (!tenantId) {
      const created = await api<{ data?: { id: string }; id?: string }>('/api/v1/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: wsName.trim() }),
      });
      tenantId = created.data?.id ?? created.id ?? null;
      if (tenantId) {
        try {
          await api('/api/v1/tenants/active', {
            method: 'POST',
            body: JSON.stringify({ tenant_id: tenantId }),
          });
        } catch {
          /* session may already be active */
        }
      }
    }
    const brandRes = await api<{ data: { id: string } }>('/api/v1/brands', {
      method: 'POST',
      body: JSON.stringify({ name: wsName.trim() }),
    });
    const brandId = brandRes.data?.id;
    if (!brandId) throw new Error(t('companies.could_not_create_workspace'));
    createdBrandId.current = brandId;
    await updateContentPreferences(brandId, { defaultTimezone: wsTz });
    if (wsUrl.trim()) {
      try {
        await api(`/api/v1/brands/${brandId}/website`, {
          method: 'POST',
          body: JSON.stringify({
            url: wsUrl.trim().startsWith('http') ? wsUrl.trim() : `https://${wsUrl.trim()}`,
          }),
        });
      } catch {
        /* website connect stays optional */
      }
    }
    return brandId;
  }

  async function connectPlatform(name: string) {
    const network = PLATFORM_NETWORK[name];
    if (!network) {
      setCreateError(t('errors.social_unavailable'));
      return;
    }
    if (network === 'universal') {
      setCreateError(null);
      setCreateStep(3);
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const brandId = await ensureBrand();
      const started = await brandSettingsApi.connect(brandId, network);
      window.location.assign(started.data.authorize_url);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('errors.social_unavailable'));
      setCreateBusy(false);
    }
  }

  async function finishCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!wsName.trim()) {
      setCreateError(t('companies.name_required'));
      return;
    }
    setCreateBusy(true);
    try {
      const brandId = await ensureBrand();
      const detail = await brandSettingsApi.get(brandId);
      const pageLabel = pageName.trim() || wsName.trim();
      const saved = await brandSettingsApi.update(brandId, {
        version: detail.data.version,
        ...(pageLabel !== detail.data.name ? { name: pageLabel } : {}),
        ...(pageLogo ? { logoUrl: pageLogo } : {}),
      });
      announceBrandLogo(brandId, saved.data.logo_url ?? pageLogo);
      await updateContentPreferences(brandId, {
        defaultTimezone: wsTz,
        previewStyle: contentStyle,
        accentColor: pageColor,
      });
      window.location.assign(`/app/brands/${brandId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('companies.could_not_create_workspace'));
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="plx-dash" id="main" dir={locale === 'ar' ? 'rtl' : 'ltr'} ref={rootRef}>
      <header className="plx-topbar">
        <Link href="/app" className="plx-topbar-logo" aria-label={t('companies.oma_home')}>
          <PlxLogo sub={null} compact />
        </Link>
        <div className="plx-topbar-search" data-testid="workspace-management-search">
          <SearchIcon width={16} height={16} />
          <input
            type="search"
            value={workspaceQuery}
            onChange={(event) => setWorkspaceQuery(event.target.value)}
            placeholder={t('companies.search_workspaces')}
            aria-label={t('companies.search_workspaces')}
            data-testid="workspace-search-input"
          />
        </div>
        <span className="plx-topbar-spacer" />
        <button type="button" className="plx-icon-btn" aria-label={t('companies.help')}>
          <HelpIcon />
        </button>
        <NotificationsBell />
        <UserMenu />
      </header>

      {loading ? (
        <div className="plx-dash-loading">
          <CardGridShimmer cards={6} />
        </div>
      ) : error ? (
        <div className="plx-dash-body">
          <div className="plx-empty" role="alert">
            <p>{error}</p>
            <Link href="/app">{t('auth.login')}</Link>
          </div>
        </div>
      ) : (
        <div className="plx-dash-body">
          <div className="plx-company-row">
            <span className="plx-company-avatar">{initials(companyName)}</span>
            <div className="plx-company-menu-wrap">
              <button
                type="button"
                className="plx-company-name"
                aria-expanded={companyMenuOpen}
                onClick={() => {
                  setCompanyMenuOpen((v) => !v);
                  setWsMenuFor(null);
                }}
              >
                {companyName}
                <ChevronDownIcon />
              </button>
              {companyMenuOpen ? (
                <div className="plx-menu" role="menu">
                  <Link
                    className="plx-menu-item"
                    href="/app/billing"
                    onClick={() => setCompanyMenuOpen(false)}
                  >
                    <CrownIcon /> Upgrade plan
                  </Link>
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => setCompanyMenuOpen(false)}
                  >
                    <ChartIcon /> Usage
                  </button>
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => setCompanyMenuOpen(false)}
                  >
                    <CardIcon /> Billing
                  </button>
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => {
                      setCompanyMenuOpen(false);
                      openSettings();
                    }}
                  >
                    <SettingsIcon /> Settings
                  </button>
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => setCompanyMenuOpen(false)}
                  >
                    <PencilIcon /> Rename company
                  </button>
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => {
                      setCompanyMenuOpen(false);
                      router.push('/app/team');
                    }}
                  >
                    <UsersIcon /> Members
                  </button>
                  <div className="plx-menu-sep" />
                  <button
                    type="button"
                    className="plx-menu-item"
                    onClick={() => {
                      setCompanyMenuOpen(false);
                      setInviteOpen(true);
                    }}
                  >
                    <UserPlusIcon /> Invite collaborators
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" className="plx-upgrade-pill" onClick={() => router.push('/app/billing')} data-testid="workspace-upgrade">
              <SparkleIcon width={15} height={15} />
              {t('companies.upgrade')}
            </button>
            <button type="button" className="plx-ghost-pill" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon width={16} height={16} />
              {t('companies.invite_users')}
            </button>
            <span className="plx-topbar-spacer" />
            <button type="button" className="plx-new-ws" onClick={openCreate}>
              <PlusIcon width={16} height={16} />
              {t('shell.newWorkspace')}
            </button>
          </div>

          {me?.active_tenant_id ? (
            <div className="plx-other-head">
              <h2>{t('companies.brands_in_workspace') || 'Brands in this Workspace'}</h2>
              <hr />
            </div>
          ) : null}
          <div className="plx-ws-grid" data-testid="plx-brands-grid">
            {brandsLoading ? <p className="plx-muted">{t('companies.loading_workspaces2')}</p> : null}
            {!brandsLoading && normalizedWorkspaceQuery && visibleBrands.length === 0 && visibleOthers.length === 0 ? (
              <p className="plx-workspaces-empty" role="status">
                {t('companies.no_workspace_matches')}
              </p>
            ) : null}
            {needsCompanyPick && !brandsLoading ? (
              <p className="plx-workspaces-empty" role="status" data-testid="select-company-hint">
                {t('selectCompany.body')}
              </p>
            ) : null}
            {visibleBrands.map((b) => (
              <WorkspaceCard
                key={b.id}
                id={b.id}
                kind="brand"
                name={b.name}
                logoUrl={b.logo_url}
                meta={b.primary_website_url || b.status || t('shell.brand') || 'Brand'}
                fav={favorites.includes(b.id)}
                busy={activating === b.id}
                menuOpen={wsMenuFor === b.id}
                onActivate={() => {
                  window.location.assign(`/app/brands/${b.id}`);
                }}
                onToggleFav={() => toggleFav(b.id)}
                onToggleMenu={() => setWsMenuFor((cur) => (cur === b.id ? null : b.id))}
                onCloseMenu={() => setWsMenuFor(null)}
                onInvite={() => {
                  setWsMenuFor(null);
                  setInviteOpen(true);
                }}
                onSettings={() => {
                  setWsMenuFor(null);
                  window.location.assign(`/app/brands/${b.id}`);
                }}
                onConnect={() => {
                  setWsMenuFor(null);
                  window.location.assign(`/app/brands/${b.id}/connect`);
                }}
                onOpenContent={() => {
                  setWsMenuFor(null);
                  window.location.assign(`/app/content?brand=${b.id}`);
                }}
              />
            ))}
            {!normalizedWorkspaceQuery && Boolean(me?.active_tenant_id) ? (
              <button type="button" className="plx-ws-create" onClick={() => router.push('/app/brands/new')}>
                <span className="plx-ws-create-plus">
                  <PlusIcon />
                </span>
                <span className="plx-ws-create-label">{t('shell.newBrand') || 'New brand'}</span>
              </button>
            ) : null}
          </div>

          {visibleOthers.length > 0 ? (
            <>
              <div className="plx-other-head">
                <h2>
                  {needsCompanyPick ? t('selectCompany.title') : t('companies.workspaces') || 'Workspaces'}
                </h2>
                <hr />
              </div>
              <div
                className="plx-ws-grid plx-ws-grid--others"
                data-testid={needsCompanyPick ? 'select-company-cards' : 'other-company-cards'}
              >
                {visibleOthers.map((m) => (
                  <WorkspaceCard
                    key={m.tenant_id}
                    id={m.id || m.tenant_id}
                    tenantId={m.tenant_id}
                    name={m.tenant_name}
                    meta={t('shell.workspace') || 'Workspace'}
                    fav={favorites.includes(m.id || m.tenant_id)}
                    busy={activating === m.tenant_id}
                    menuOpen={wsMenuFor === (m.id || m.tenant_id)}
                    onActivate={() => activate(m.tenant_id)}
                    onToggleFav={() => toggleFav(m.id || m.tenant_id)}
                    onToggleMenu={() =>
                      setWsMenuFor((cur) =>
                        cur === (m.id || m.tenant_id) ? null : m.id || m.tenant_id,
                      )
                    }
                    onCloseMenu={() => setWsMenuFor(null)}
                    onInvite={() => {
                      setWsMenuFor(null);
                      setInviteOpen(true);
                    }}
                    onSettings={() => {
                      setWsMenuFor(null);
                      openSettings();
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      <TeamInviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      {createOpen ? (
        <div
          className="plx-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setCreateOpen(false)}
        >
          {createStep === 1 ? (
            <div
              className="plx-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t('companies.create_a_workspace')}
            >
              <button
                type="button"
                className="plx-modal-x"
                aria-label={t('brand.evidence.close')}
                onClick={() => setCreateOpen(false)}
              >
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">{t('companies.create_a_workspace')}</h2>
              <p className="plx-modal-sub-center">
                A workspace is a group of channels and collaborators, a place where you can organize
                your campaigns, workflows and assets.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCreateStep(2);
                }}
              >
                <label className="plx-label" htmlFor="plx-ws-name">
                  {t('wsPanel.workspace_name')}
                </label>
                <input
                  id="plx-ws-name"
                  className="plx-input-sm"
                  placeholder={t('companies.ph.workspace_name')}
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  autoFocus
                />
                <label className="plx-label" htmlFor="plx-ws-url">
                  {t('brand.connect.urlLabel')}
                </label>
                <input
                  id="plx-ws-url"
                  className="plx-input-sm"
                  placeholder={t('companies.ph.website')}
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                />
                <label className="plx-label" htmlFor="plx-ws-tz">
                  {t('wsPanel.workspace_timezone')}
                </label>
                <select
                  id="plx-ws-tz"
                  className="plx-input-sm plx-select"
                  value={wsTz}
                  onChange={(e) => setWsTz(e.target.value)}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <div className="plx-progress" aria-hidden="true">
                  <span className="is-active" />
                  <span />
                  <span />
                </div>
                <button
                  type="submit"
                  className="plx-btn plx-btn--dark plx-btn--block"
                  disabled={!wsName.trim()}
                >
                  {t('demo.content.next')}
                </button>
              </form>
            </div>
          ) : createStep === 2 ? (
            <div
              className="plx-modal plx-modal--wide"
              role="dialog"
              aria-modal="true"
              aria-label={t('companies.connect_pages')}
            >
              <button
                type="button"
                className="plx-modal-x"
                aria-label={t('brand.evidence.close')}
                onClick={() => setCreateOpen(false)}
              >
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">
                Connect {wsName || 'your workspace'}&apos;s pages
              </h2>
              <p className="plx-modal-sub-center">
                Add all your brands&apos; content channels. You can always add more later.
              </p>
              <div className="plx-platform-grid">
                {PLATFORMS.map((p) => {
                  const network = PLATFORM_NETWORK[p.name];
                  return (
                    <button
                      key={p.name}
                      type="button"
                      className="plx-platform-tile"
                      disabled={createBusy}
                      data-available={network ? 'true' : 'false'}
                      onClick={() => void connectPlatform(p.name)}
                    >
                      <span className="plx-platform-glyph" style={{ background: p.color }}>
                        {initials(p.name)}
                      </span>
                      <span className="plx-platform-name">{t(LABEL_KEYS[p.name] ?? p.name)}</span>
                    </button>
                  );
                })}
              </div>
              {createError ? (
                <p role="alert" className="plx-error">
                  {createError}
                </p>
              ) : null}
              <div className="plx-connect-footer">
                <button type="button" className="plx-link-btn" onClick={() => setCreateStep(1)}>
                  {t('companies.go_back')}
                </button>
                <button
                  type="button"
                  className="plx-btn plx-btn--ghost"
                  onClick={() => setCreateStep(3)}
                >
                  {t('companies.connect_later')}
                </button>
              </div>
              <div className="plx-progress" aria-hidden="true">
                <span className="is-done" />
                <span className="is-active" />
                <span />
              </div>
            </div>
          ) : (
            <div className="plx-modal" role="dialog" aria-modal="true" aria-label={t('companies.create_a_page')}>
              <button
                type="button"
                className="plx-modal-x"
                aria-label={t('brand.evidence.close')}
                onClick={() => setCreateOpen(false)}
              >
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">{t('companies.create_a_page_for_any')}</h2>
              <form onSubmit={finishCreate}>
                <div className="plx-page-form">
                  <button
                    type="button"
                    className="plx-pic-upload"
                    aria-label={t('companies.add_profile_picture')}
                    onClick={() =>
                      (document.getElementById('plx-page-logo') as HTMLInputElement | null)?.click()
                    }
                  >
                    {pageLogo ? (
                      <img src={pageLogo} alt="" width={48} height={48} />
                    ) : (
                      <ImageIcon />
                    )}
                    <span>{t('companies.add_profile_picture')}</span>
                    <input
                      id="plx-page-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        try {
                          setPageLogo(await readLogoFile(file));
                          setCreateError(null);
                        } catch (err) {
                          setCreateError(
                            t(
                              (err as Error).message === 'size'
                                ? 'brandSettings.general.logoTooBig'
                                : 'brandSettings.general.logoType',
                            ),
                          );
                        }
                      }}
                    />
                  </button>
                  <div className="plx-page-fields">
                    <label className="plx-label" htmlFor="plx-page-name">
                      {t('companies.page_name')}
                    </label>
                    <input
                      id="plx-page-name"
                      className="plx-input-sm"
                      placeholder={t('companies.ph.page_name')}
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                      autoFocus
                    />
                    <div className="plx-page-meta-row">
                      <div>
                        <span className="plx-mini-label">{t('companies.platform_color')}</span>
                        <input
                          className="plx-color-swatch"
                          type="color"
                          aria-label={t('companies.platform_color')}
                          value={pageColor}
                          onChange={(event) => setPageColor(event.target.value)}
                        />
                      </div>
                      <div>
                        <span className="plx-mini-label">{t('companies.platform_icon')}</span>
                        <span className="plx-icon-swatch" style={{ background: pageColor, color: '#fff' }}>
                          {pageLogo ? (
                            <img src={pageLogo} alt="" width={18} height={18} />
                          ) : (
                            initials(pageName || wsName || 'P')
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="plx-label">{t('companies.content_style')}</span>
                <div className="plx-style-row" role="radiogroup" aria-label={t('companies.content_style')}>
                  {(['default', 'classic', 'modern', 'compact'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={contentStyle === s}
                      className={contentStyle === s ? 'plx-style is-selected' : 'plx-style'}
                      onClick={() => setContentStyle(s)}
                    >
                      <span
                        className={
                          s === 'default'
                            ? 'plx-style-preview plx-style-preview--default'
                            : 'plx-style-preview'
                        }
                      >
                        {t('companies.ab')}
                      </span>
                      <span className="plx-style-name">{s}</span>
                    </button>
                  ))}
                </div>
                {createError ? (
                  <p role="alert" className="plx-error">
                    {createError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="plx-btn plx-btn--soft plx-btn--block"
                  disabled={!pageName.trim() || createBusy}
                >
                  {createBusy ? <OmaDotsLoader label={t('companies.creating_page')} /> : t('companies.create_page')}
                </button>
              </form>
              <div className="plx-progress" aria-hidden="true">
                <span className="is-done" />
                <span className="is-done" />
                <span className="is-active" />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceCard(props: {
  id: string;
  tenantId?: string;
  kind?: 'workspace' | 'brand';
  name: string;
  meta?: string;
  fav: boolean;
  busy: boolean;
  menuOpen: boolean;
  onActivate: () => void;
  onToggleFav: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onInvite: () => void;
  onSettings: () => void;
  onConnect?: () => void;
  onOpenContent?: () => void;
  logoUrl?: string | null;
}) {
  const t = useT();
  const entityLabel = props.kind === 'brand' ? t('entity.type.brand') || 'Brand' : t('shell.workspace') || 'Workspace';
  const truncate = (n: string) => (n.length > 14 ? `${n.slice(0, 14)}â€¦` : n);
  return (
    <div
      role="button"
      tabIndex={0}
      className="plx-ws-card"
      data-testid={`plx-workspace-card-${props.id}`}
      onClick={props.onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onActivate();
        }
      }}
      aria-label={props.kind === 'brand' ? `${entityLabel}: ${props.name}` : t('companies.open_workspace').replace('{name}', props.name)}
    >
      <button
        type="button"
        className={props.fav ? 'plx-ws-star is-fav' : 'plx-ws-star'}
        aria-label={props.fav ? t('companies.remove_from_favorites') : t('companies.add_to_favorites')}
        onClick={(e) => {
          e.stopPropagation();
          props.onToggleFav();
        }}
      >
        <StarIcon filled={props.fav} />
      </button>
      <span className="plx-ws-avatar">
        {props.logoUrl ? (
          <img src={props.logoUrl} alt="" width={28} height={28} />
        ) : (
          <ImageIcon width={22} height={22} />
        )}
      </span>
      <span className="plx-ws-name">{truncate(props.name)}</span>
      <span className="plx-ws-meta">{props.meta || 'Workspace'}</span>
      <div className="plx-ws-menu-wrap">
        <button
          type="button"
          className="plx-ws-more"
          aria-label={t('companies.workspace_options').replace('{name}', props.name)}
          aria-expanded={props.menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleMenu();
          }}
        >
          <MoreIcon />
        </button>
        {props.menuOpen ? (
          <div className="plx-menu plx-menu--up" role="menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="plx-menu-item"
              onClick={() => {
                props.onActivate();
                props.onCloseMenu();
              }}
            >
              <BriefcaseIcon /> {props.kind === 'brand' ? (t('companies.open_brand') || 'Open brand') : (t('companies.open_workspace_action') || 'Open workspace')}
            </button>
            {props.kind === 'brand' ? (
              <>
                <button type="button" className="plx-menu-item" onClick={() => { props.onConnect?.(); props.onCloseMenu(); }}>
                  <LinkIcon /> Connect website
                </button>
                <button type="button" className="plx-menu-item" onClick={() => { props.onOpenContent?.(); props.onCloseMenu(); }}>
                  <ImageIcon /> Content calendar
                </button>
              </>
            ) : (
              <button type="button" className="plx-menu-item" onClick={props.onInvite}>
                <UsersIcon /> Manage people
              </button>
            )}
            <button type="button" className="plx-menu-item" onClick={props.onSettings}>
              <SettingsIcon /> {props.kind === 'brand' ? (t('companies.brand_settings') || 'Brand settings') : (t('shell.workspaceSettings') || 'Workspace settings')}
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onCloseMenu}>
              <CheckSquareIcon /> Approvals
            </button>
          </div>
        ) : null}
      </div>
      {props.busy ? <OmaDotsLoaderOverlay label={t('companies.opening_workspace')} /> : null}
    </div>
  );
}
