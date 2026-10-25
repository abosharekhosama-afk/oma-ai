'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import { ShellIcon } from './shell-icons';
import { resolveActiveBrand, selectBrand, useActiveBrandId } from '../../lib/active-brand';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

type BrandItem = {
  id: string;
  name: string;
  status?: string;
  primary_website_url?: string | null;
};

type WorkspaceRowProps = {
  collapsed?: boolean;
  onOpenSettings: () => void;
};

/**
 * Planable-style Workspace row in the rail:
 * - Shows active brand workspace name (not only company)
 * - Menu: settings, switch workspace, new workspace (→ /app/brands/new)
 */
export function WorkspaceRow({ collapsed = false, onOpenSettings }: WorkspaceRowProps) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(m);
        if (m.active_tenant_id) {
          try {
            const list = await api<{ data: BrandItem[] }>('/api/v1/brands?limit=50');
            if (!cancelled) setBrands(Array.isArray(list.data) ? list.data : []);
          } catch {
            if (!cancelled) setBrands([]);
          }
        }
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const company =
    me?.memberships.find((m) => m.tenant_id === me.active_tenant_id)?.tenant_name ||
    me?.memberships[0]?.tenant_name ||
    t('shell.workspace') ||
    'Workspace';

  // Active brand scopes work surfaces (content, tasks, …); none selected = all brands.
  const activeBrandId = useActiveBrandId();
  const activeBrand = resolveActiveBrand(brands, activeBrandId);
  const name = activeBrand?.name || company;

  if (collapsed) {
    return (
      <div className="oma-ws-row oma-ws-row--collapsed" title={name}>
        <button
          type="button"
          className="oma-ws-collapsed-btn"
          aria-label={name}
          onClick={onOpenSettings}
        >
          <span className="oma-ws-avatar">{(name[0] || 'W').toUpperCase()}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="oma-ws-row" ref={rootRef} data-testid="workspace-row">
      <button
        type="button"
        className="oma-ws-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
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
              {(name[0] || 'W').toUpperCase()}
            </span>
            <button
              type="button"
              className="oma-ws-name"
              title={name}
              onClick={() => {
                if (activeBrand) window.location.assign(`/app/brands/${activeBrand.id}`);
                else window.location.assign('/app/brands');
              }}
            >
              {name}
            </button>
            <div className="oma-ws-actions">
              <button
                type="button"
                className="oma-ws-more"
                aria-label={t('shell.workspaceActions') || 'Workspace actions'}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                data-testid="workspace-row-menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="6" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="18" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="oma-ws-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <ShellIcon name="settings" size={14} />
                    <span>{t('shell.workspaceSettings') || 'Workspace settings'}</span>
                  </button>
                  {brands.length > 1 ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="oma-ws-menu-item"
                      data-active={!activeBrand ? 'true' : 'false'}
                      data-testid="workspace-row-brand-all"
                      onClick={() => {
                        setMenuOpen(false);
                        selectBrand(null);
                      }}
                    >
                      <ShellIcon name="brand" size={14} />
                      <span>{t('shell.brandAll') || 'All brands'}</span>
                    </button>
                  ) : null}
                  {brands.slice(0, 6).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      role="menuitem"
                      className="oma-ws-menu-item"
                      data-active={activeBrand?.id === b.id ? 'true' : 'false'}
                      data-testid={`workspace-row-brand-${b.id}`}
                      onClick={() => {
                        setMenuOpen(false);
                        selectBrand(b.id);
                      }}
                    >
                      <ShellIcon name="brand" size={14} />
                      <span>{b.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    data-testid="workspace-row-new"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.assign('/app/brands/new');
                    }}
                  >
                    <ShellIcon name="plus" size={14} />
                    <span>{t('shell.newWorkspace') || 'New workspace'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.assign('/app/select-company');
                    }}
                  >
                    <ShellIcon name="company" size={14} />
                    <span>{t('shell.allWorkspaces') || 'All workspaces'}</span>
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
