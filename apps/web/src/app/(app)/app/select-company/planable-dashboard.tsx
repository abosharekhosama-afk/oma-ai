'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../../lib/api';
import { OmaDotsLoader, OmaDotsLoaderOverlay } from '../../../../components/ui/oma-dots-loader';
import {
  BellIcon, BriefcaseIcon, CardIcon, ChartIcon, CheckIcon, CheckSquareIcon, ChevronDownIcon,
  ClockIcon, CloseIcon, CrownIcon, EnvelopeIcon, HelpIcon, ImageIcon, LinkIcon, MoreIcon,
  PencilIcon, PlusIcon, SearchIcon, SettingsIcon, SparkleIcon, StarIcon, TagIcon, TrashIcon,
  UserPlusIcon, UsersIcon, PlxLogo,
} from '../../../../components/ui/plx-icons';
import './planable-dashboard.css';

type Me = {
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

const FAV_KEY = 'plx-favorite-workspaces';

const ROLES = [
  {
    id: 'Administrator',
    desc: 'Can manage workspaces, people and billing plan',
    perms: [
      { label: 'Comment on posts', ok: true },
      { label: 'Manage workspaces and collaborators', ok: true },
      { label: 'Create and edit posts', ok: true },
      { label: 'View invoices and manage billing', ok: true },
      { label: 'Company ownership', ok: false },
    ],
  },
  {
    id: 'Writer',
    desc: 'Has editing access to all workspaces, but cannot create workspaces or invite people',
    perms: [
      { label: 'Comment on posts', ok: true },
      { label: 'Manage workspaces and collaborators', ok: false },
      { label: 'Create and edit posts', ok: true },
      { label: 'View invoices and manage billing', ok: false },
      { label: 'Company ownership', ok: false },
    ],
  },
  {
    id: 'Billing Manager',
    desc: 'Can manage billing plan, change payment details & see invoices',
    perms: [
      { label: 'Comment on posts', ok: false },
      { label: 'Manage workspaces and collaborators', ok: false },
      { label: 'Create and edit posts', ok: false },
      { label: 'View invoices and manage billing', ok: true },
      { label: 'Company ownership', ok: false },
    ],
  },
] as const;

type RoleId = (typeof ROLES)[number]['id'];

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

const TIMEZONES = [
  'Hebron, Asia (UTC +3)',
  'Dubai, Asia (UTC +4)',
  'Riyadh, Asia (UTC +3)',
  'Cairo, Africa (UTC +2)',
  'London, Europe (UTC +0)',
  'New York, America (UTC -5)',
];

function initials(name: string) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function PlanableDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [wsMenuFor, setWsMenuFor] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [wsName, setWsName] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [wsTz, setWsTz] = useState(TIMEZONES[0]);
  const [pageName, setPageName] = useState('');
  const [contentStyle, setContentStyle] = useState<'default' | 'classic' | 'modern' | 'compact'>('default');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Me>('/api/v1/auth/me')
      .then((m) => setMe(m))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'));
    } catch {
      setFavorites([]);
    }
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
  const primary = useMemo(() => {
    if (memberships.length === 0) return [];
    const active = memberships.find((m) => m.tenant_id === me?.active_tenant_id);
    return [active ?? memberships[0]];
  }, [memberships, me?.active_tenant_id]);
  const others = useMemo(
    () => memberships.filter((m) => !primary.some((p) => p.tenant_id === m.tenant_id)),
    [memberships, primary],
  );

  const companyName = me?.user?.name ?? me?.name ?? primary[0]?.tenant_name ?? 'Workspace';

  function toggleFav(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch { /* noop */ }
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
      window.location.assign('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActivating(null);
    }
  }

  function openCreate() {
    setCreateStep(1);
    setWsName('');
    setWsUrl('');
    setWsTz(TIMEZONES[0]);
    setPageName('');
    setContentStyle('default');
    setCreateError(null);
    setCreateOpen(true);
  }

  async function finishCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateBusy(true);
    try {
      await api('/api/v1/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: wsName, website: wsUrl, timezone: wsTz }),
      });
      window.location.assign('/app');
    } catch (err) {
      // Stay on Planable create UI — do not send users to legacy OMA onboarding.
      setCreateError(err instanceof Error ? err.message : 'Could not create workspace');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="plx-dash" id="main" dir="ltr" ref={rootRef}>
      <header className="plx-topbar">
        <Link href="/app" className="plx-topbar-logo" aria-label="OMA home">
          <PlxLogo sub={null} compact />
        </Link>
        <div className="plx-topbar-search">
          <SearchIcon width={16} height={16} />
          <span>Search</span>
        </div>
        <span className="plx-topbar-spacer" />
        <button type="button" className="plx-icon-btn" aria-label="Help">
          <HelpIcon />
        </button>
        <button type="button" className="plx-icon-btn" aria-label="Notifications">
          <BellIcon />
        </button>
        <span className="plx-avatar" title={me?.user?.email ?? me?.email ?? ''}>
          {initials(me?.user?.name ?? me?.name ?? 'O')}
        </span>
      </header>

      {loading ? (
        <div className="plx-dash-loading">
          <OmaDotsLoader label="Loading workspaces" />
        </div>
      ) : error ? (
        <div className="plx-dash-body">
          <div className="plx-empty" role="alert">
            <p>{error}</p>
            <Link href="/app">Sign in</Link>
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
                  <button type="button" className="plx-menu-item" onClick={() => setCompanyMenuOpen(false)}>
                    <CrownIcon /> Upgrade plan
                  </button>
                  <button type="button" className="plx-menu-item" onClick={() => setCompanyMenuOpen(false)}>
                    <ChartIcon /> Usage
                  </button>
                  <button type="button" className="plx-menu-item" onClick={() => setCompanyMenuOpen(false)}>
                    <CardIcon /> Billing
                  </button>
                  <button type="button" className="plx-menu-item" onClick={() => { setCompanyMenuOpen(false); router.push('/app/settings'); }}>
                    <SettingsIcon /> Settings
                  </button>
                  <button type="button" className="plx-menu-item" onClick={() => setCompanyMenuOpen(false)}>
                    <PencilIcon /> Rename company
                  </button>
                  <button type="button" className="plx-menu-item" onClick={() => { setCompanyMenuOpen(false); router.push('/app/company/members'); }}>
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
            <button type="button" className="plx-upgrade-pill">
              <SparkleIcon width={15} height={15} />
              Upgrade
            </button>
            <button type="button" className="plx-ghost-pill" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon width={16} height={16} />
              Invite users
            </button>
            <span className="plx-topbar-spacer" />
            <button type="button" className="plx-new-ws" onClick={openCreate}>
              <PlusIcon width={16} height={16} />
              New workspace
            </button>
          </div>

          <div className="plx-ws-grid">
            {primary.map((m) => (
              <WorkspaceCard
                key={m.tenant_id}
                id={m.id || m.tenant_id}
                tenantId={m.tenant_id}
                name={m.tenant_name}
                fav={favorites.includes(m.id || m.tenant_id)}
                busy={activating === m.tenant_id}
                menuOpen={wsMenuFor === (m.id || m.tenant_id)}
                onActivate={() => activate(m.tenant_id)}
                onToggleFav={() => toggleFav(m.id || m.tenant_id)}
                onToggleMenu={() =>
                  setWsMenuFor((cur) => (cur === (m.id || m.tenant_id) ? null : m.id || m.tenant_id))
                }
                onCloseMenu={() => setWsMenuFor(null)}
                onInvite={() => {
                  setWsMenuFor(null);
                  setInviteOpen(true);
                }}
                onSettings={() => {
                  setWsMenuFor(null);
                  router.push('/app/settings');
                }}
              />
            ))}
            <button type="button" className="plx-ws-create" onClick={openCreate}>
              <span className="plx-ws-create-plus">
                <PlusIcon />
              </span>
              <span className="plx-ws-create-label">Create a workspace</span>
            </button>
          </div>

          {others.length > 0 ? (
            <>
              <div className="plx-other-head">
                <h2>Other workspaces</h2>
                <hr />
              </div>
              <div className="plx-ws-grid plx-ws-grid--others">
                {others.map((m) => (
                  <WorkspaceCard
                    key={m.tenant_id}
                    id={m.id || m.tenant_id}
                    tenantId={m.tenant_id}
                    name={m.tenant_name}
                    fav={favorites.includes(m.id || m.tenant_id)}
                    busy={activating === m.tenant_id}
                    menuOpen={wsMenuFor === (m.id || m.tenant_id)}
                    onActivate={() => activate(m.tenant_id)}
                    onToggleFav={() => toggleFav(m.id || m.tenant_id)}
                    onToggleMenu={() =>
                      setWsMenuFor((cur) => (cur === (m.id || m.tenant_id) ? null : m.id || m.tenant_id))
                    }
                    onCloseMenu={() => setWsMenuFor(null)}
                    onInvite={() => {
                      setWsMenuFor(null);
                      setInviteOpen(true);
                    }}
                    onSettings={() => {
                      setWsMenuFor(null);
                      router.push('/app/settings');
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {inviteOpen ? <InviteModal company={companyName} onClose={() => setInviteOpen(false)} /> : null}

      {createOpen ? (
        <div className="plx-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          {createStep === 1 ? (
            <div className="plx-modal" role="dialog" aria-modal="true" aria-label="Create a workspace">
              <button type="button" className="plx-modal-x" aria-label="Close" onClick={() => setCreateOpen(false)}>
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">Create a workspace</h2>
              <p className="plx-modal-sub-center">
                A workspace is a group of channels and collaborators, a place where you can organize your
                campaigns, workflows and assets.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); setCreateStep(2); }}>
                <label className="plx-label" htmlFor="plx-ws-name">Workspace name</label>
                <input
                  id="plx-ws-name"
                  className="plx-input-sm"
                  placeholder="e.g. Planable"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  autoFocus
                />
                <label className="plx-label" htmlFor="plx-ws-url">Website URL</label>
                <input
                  id="plx-ws-url"
                  className="plx-input-sm"
                  placeholder="e.g. planable.io"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                />
                <label className="plx-label" htmlFor="plx-ws-tz">Workspace timezone</label>
                <select
                  id="plx-ws-tz"
                  className="plx-input-sm plx-select"
                  value={wsTz}
                  onChange={(e) => setWsTz(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <div className="plx-progress" aria-hidden="true">
                  <span className="is-active" /><span /><span />
                </div>
                <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={!wsName.trim()}>
                  Next
                </button>
              </form>
            </div>
          ) : createStep === 2 ? (
            <div className="plx-modal plx-modal--wide" role="dialog" aria-modal="true" aria-label="Connect pages">
              <button type="button" className="plx-modal-x" aria-label="Close" onClick={() => setCreateOpen(false)}>
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">Connect {wsName || 'your workspace'}&apos;s pages</h2>
              <p className="plx-modal-sub-center">
                Add all your brands&apos; content channels. You can always add more later.
              </p>
              <div className="plx-platform-grid">
                {PLATFORMS.map((p) => (
                  <button key={p.name} type="button" className="plx-platform-tile">
                    <span className="plx-platform-glyph" style={{ background: p.color }}>
                      {initials(p.name)}
                    </span>
                    <span className="plx-platform-name">{p.name}</span>
                  </button>
                ))}
              </div>
              <div className="plx-connect-footer">
                <button type="button" className="plx-link-btn" onClick={() => setCreateStep(1)}>
                  Go back
                </button>
                <button type="button" className="plx-btn plx-btn--ghost" onClick={() => setCreateStep(3)}>
                  Connect later
                </button>
              </div>
              <div className="plx-progress" aria-hidden="true">
                <span className="is-done" /><span className="is-active" /><span />
              </div>
            </div>
          ) : (
            <div className="plx-modal" role="dialog" aria-modal="true" aria-label="Create a page">
              <button type="button" className="plx-modal-x" aria-label="Close" onClick={() => setCreateOpen(false)}>
                <CloseIcon />
              </button>
              <h2 className="plx-modal-title-center">Create a page for any type of content</h2>
              <form onSubmit={finishCreate}>
                <div className="plx-page-form">
                  <button type="button" className="plx-pic-upload" aria-label="Add profile picture">
                    <ImageIcon />
                    <span>Add profile picture</span>
                  </button>
                  <div className="plx-page-fields">
                    <label className="plx-label" htmlFor="plx-page-name">Page name</label>
                    <input
                      id="plx-page-name"
                      className="plx-input-sm"
                      placeholder="e.g. Blog"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                      autoFocus
                    />
                    <div className="plx-page-meta-row">
                      <div>
                        <span className="plx-mini-label">Platform color</span>
                        <span className="plx-color-swatch" />
                      </div>
                      <div>
                        <span className="plx-mini-label">Platform icon</span>
                        <span className="plx-icon-swatch">
                          <PencilIcon width={14} height={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="plx-label">Content style</span>
                <div className="plx-style-row" role="radiogroup" aria-label="Content style">
                  {(['default', 'classic', 'modern', 'compact'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={contentStyle === s}
                      className={contentStyle === s ? 'plx-style is-selected' : 'plx-style'}
                      onClick={() => setContentStyle(s)}
                    >
                      <span className={s === 'default' ? 'plx-style-preview plx-style-preview--default' : 'plx-style-preview'}>
                        Ab
                      </span>
                      <span className="plx-style-name">{s}</span>
                    </button>
                  ))}
                </div>
                {createError ? <p role="alert" className="plx-error">{createError}</p> : null}
                <button type="submit" className="plx-btn plx-btn--soft plx-btn--block" disabled={!pageName.trim() || createBusy}>
                  {createBusy ? <OmaDotsLoader label="Creating page" /> : 'Create page'}
                </button>
              </form>
              <div className="plx-progress" aria-hidden="true">
                <span className="is-done" /><span className="is-done" /><span className="is-active" />
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
  tenantId: string;
  name: string;
  fav: boolean;
  busy: boolean;
  menuOpen: boolean;
  onActivate: () => void;
  onToggleFav: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onInvite: () => void;
  onSettings: () => void;
}) {
  const truncate = (n: string) => (n.length > 14 ? `${n.slice(0, 14)}…` : n);
  return (
    <div
      role="button"
      tabIndex={0}
      className="plx-ws-card"
      onClick={props.onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onActivate();
        }
      }}
      aria-label={`Open workspace ${props.name}`}
    >
      <button
        type="button"
        className={props.fav ? 'plx-ws-star is-fav' : 'plx-ws-star'}
        aria-label={props.fav ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.stopPropagation();
          props.onToggleFav();
        }}
      >
        <StarIcon filled={props.fav} />
      </button>
      <span className="plx-ws-avatar">
        <ImageIcon width={22} height={22} />
      </span>
      <span className="plx-ws-name">{truncate(props.name)}</span>
      <span className="plx-ws-meta">Workspace</span>
      <div className="plx-ws-menu-wrap">
        <button
          type="button"
          className="plx-ws-more"
          aria-label={`Workspace options for ${props.name}`}
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
            <button type="button" className="plx-menu-item" onClick={props.onCloseMenu}>
              <ClockIcon /> Configure timetable
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onCloseMenu}>
              <TagIcon /> Manage labels
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onInvite}>
              <UsersIcon /> Manage people
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onSettings}>
              <SettingsIcon /> Settings
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onCloseMenu}>
              <BriefcaseIcon /> Brand context
            </button>
            <button type="button" className="plx-menu-item" onClick={props.onCloseMenu}>
              <CheckSquareIcon /> Approvals settings
            </button>
            <button type="button" className="plx-menu-item plx-menu-item--danger" onClick={props.onCloseMenu}>
              <TrashIcon /> Delete
            </button>
          </div>
        ) : null}
      </div>
      {props.busy ? <OmaDotsLoaderOverlay label="Opening workspace" /> : null}
    </div>
  );
}

function InviteModal({ company, onClose }: { company: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleId>('Administrator');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const roleDef = ROLES.find((r) => r.id === role) ?? ROLES[0];

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Type or search email');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api('/api/v1/company/invites', {
        method: 'POST',
        body: JSON.stringify({ email, name, role }),
      });
      setSent(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite?role=${encodeURIComponent(role)}`);
      setSent(true);
      setTimeout(onClose, 900);
    } catch {
      setError('Could not copy the invite link');
    }
  }

  return (
    <div className="plx-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="plx-modal" role="dialog" aria-modal="true" aria-label={`Invite members to ${company}`}>
        <button type="button" className="plx-modal-x" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 className="plx-modal-title">Invite members to {company}</h2>
        <p className="plx-modal-sub">
          Inviting a new company collaborator will give them access to all workspaces.
        </p>
        {sent ? (
          <div className="plx-invite-sent">
            <CheckIcon width={22} height={22} />
            <span>Invitation sent</span>
          </div>
        ) : (
          <form onSubmit={send}>
            <div className="plx-invite-row">
              <input
                className="plx-input-sm"
                placeholder="Type or search email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <input
                className="plx-input-sm"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="plx-role-wrap">
              <button
                type="button"
                className="plx-input-sm plx-role-select"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((v) => !v)}
              >
                {role}
                <ChevronDownIcon />
              </button>
              {roleMenuOpen ? (
                <>
                  <div className="plx-perms" role="tooltip">
                    <span className="plx-perms-title">Granted permissions</span>
                    <ul>
                      {roleDef.perms.map((perm) => (
                        <li key={perm.label} className={perm.ok ? '' : 'is-denied'}>
                          {perm.ok ? <CheckIcon width={15} height={15} /> : <CloseIcon width={15} height={15} />}
                          {perm.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="plx-menu plx-role-menu" role="listbox">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={r.id === role}
                        className={r.id === role ? 'plx-role-option is-active' : 'plx-role-option'}
                        onClick={() => {
                          setRole(r.id);
                          setRoleMenuOpen(false);
                        }}
                      >
                        <strong>{r.id}</strong>
                        <span>{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            {error ? <p role="alert" className="plx-error">{error}</p> : null}
            <div className="plx-modal-actions">
              <button type="button" className="plx-btn plx-btn--outline" onClick={copyLink}>
                <LinkIcon width={16} height={16} />
                Create invite link
              </button>
              <button type="submit" className="plx-btn plx-btn--primary" disabled={busy}>
                {busy ? <OmaDotsLoader label="Sending invite" /> : (
                  <>
                    <EnvelopeIcon width={16} height={16} />
                    Send email invite
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
