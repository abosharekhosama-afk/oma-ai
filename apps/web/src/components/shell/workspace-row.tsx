'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import { AppstoreOutlined, PlusOutlined, SettingOutlined } from '../ui/lucide-icons';
import { setActiveBrandId } from '../../lib/active-brand';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};
type WorkspaceRowProps = { collapsed?: boolean; onOpenSettings: () => void };

/** Sidebar selectors for the active tenant (Workspace) and activeBrandId (Brand). */
export function WorkspaceRow({ collapsed = false, onOpenSettings }: WorkspaceRowProps) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [busyTenant, setBusyTenant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const switchGen = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(profile);
      } catch {
        if (!cancelled) {
          setMe(null);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const workspace = me?.memberships.find((item) => item.tenant_id === me.active_tenant_id);
  const workspaceName = workspace?.tenant_name || t('shell.workspace') || 'Workspace';
  async function activateWorkspace(tenantId: string) {
    if (!tenantId || tenantId === me?.active_tenant_id || busyTenant) return;
    const gen = ++switchGen.current;
    setBusyTenant(true);
    setError(null);
    setMenuOpen(false);
    try {
      await api('/api/v1/tenants/active', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (gen !== switchGen.current) return;
      setActiveBrandId(null);
      window.location.assign('/app');
    } catch (err) {
      if (gen !== switchGen.current) return;
      setError(err instanceof Error ? err.message : t('common.error'));
      setBusyTenant(false);
    }
  }

  if (collapsed) {
    return (
      <div className="oma-ws-row oma-ws-row--collapsed" title={workspaceName}>
        <button
          type="button"
          className="oma-ws-collapsed-btn"
          aria-label={`${t('shell.workspace')}: ${workspaceName}`}
          onClick={() => {
            window.location.assign('/app/select-company');
          }}
        >
          <span className="oma-ws-avatar">{(workspaceName[0] || 'W').toUpperCase()}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="oma-ws-row" ref={rootRef} data-testid="workspace-row">
      {error ? (
        <p role="alert" className="oma-shell-note">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="oma-ws-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="oma-ws-label">{t('shell.workspace') || 'Workspace'}</span>
        <svg
          className={`oma-ws-chevron${expanded ? ' is-open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {expanded ? (
        <div className="oma-ws-body">
          <div className="oma-ws-name-row">
            <span className="oma-ws-avatar oma-ws-avatar--sm" aria-hidden>
              {(workspaceName[0] || 'W').toUpperCase()}
            </span>
            <button
              type="button"
              className="oma-ws-name"
              title={workspaceName}
              onClick={() => window.location.assign('/app/select-company')}
            >
              {workspaceName}
            </button>
            <div className="oma-ws-actions">
              <button
                type="button"
                className="oma-ws-more"
                aria-label={t('shell.workspaceActions') || 'Workspace actions'}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                data-testid="workspace-row-menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((value) => !value);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="6" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="18" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="oma-ws-menu" role="menu" data-testid="workspace-row-workspace-menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <SettingOutlined width={16} height={16} />
                    <span>{t('shell.workspaceSettings') || 'Workspace settings'}</span>
                  </button>
                  <div className="oma-ws-menu__section" role="presentation">
                    {t('shell.workspaces') || 'Workspaces'}
                  </div>
                  {(me?.memberships ?? []).map((membership) => (
                    <button
                      key={membership.tenant_id}
                      type="button"
                      role="menuitem"
                      className="oma-ws-menu-item"
                      data-active={membership.tenant_id === me?.active_tenant_id ? 'true' : 'false'}
                      onClick={() => {
                        setMenuOpen(false);
                        void activateWorkspace(membership.tenant_id);
                      }}
                    >
                      <AppstoreOutlined width={16} height={16} />
                      <span>{membership.tenant_name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    data-testid="workspace-row-new"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.assign('/app/workspaces/new');
                    }}
                  >
                    <PlusOutlined width={16} height={16} />
                    <span>{t('shell.newWorkspace') || 'New workspace'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    data-testid="workspace-row-all-workspaces"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.assign('/app/select-company');
                    }}
                  >
                    <AppstoreOutlined width={16} height={16} />
                    <span>{t('shell.manageWorkspaces') || 'All workspaces'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
