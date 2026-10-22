'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

type WorkspaceRowProps = {
  collapsed?: boolean;
  onOpenSettings: () => void;
};

/**
 * Planable-style Workspace row in the rail:
 * - Label "Workspace" + chevron
 * - Workspace name
 * - Actions (⋯) menu: Workspace settings / New workspace
 */
export function WorkspaceRow({ collapsed = false, onOpenSettings }: WorkspaceRowProps) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Me>('/api/v1/auth/me')
      .then(setMe)
      .catch(() => setMe(null));
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

  const active = me?.memberships.find((m) => m.tenant_id === me.active_tenant_id);
  const name =
    active?.tenant_name ||
    me?.memberships[0]?.tenant_name ||
    t('shell.workspace') ||
    'Workspace';

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
            <span className="oma-ws-name" title={name}>
              {name}
            </span>
            <div className="oma-ws-actions">
              <button
                type="button"
                className="oma-ws-more"
                aria-label={t('shell.workspaceActions') || 'Workspace actions'}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.1 2.8-.9-1.6 1.2-1.5-1.7-1.7-1.5 1.2-1.6-.9L14.5 4h-5l-.2 2.8-1.6.9-1.5-1.2-1.7 1.7 1.2 1.5-.9 1.6L3 12.5v5l2.8.2.9 1.6-1.2 1.5 1.7 1.7 1.5-1.2 1.6.9.2 2.8h5l.2-2.8 1.6-.9 1.5 1.2 1.7-1.7-1.2-1.5.9-1.6 2.8-.2v-5l-2.8-.2Z" />
                    </svg>
                    <span>{t('shell.workspaceSettings') || 'Workspace settings'}</span>
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
                    </svg>
                    <span>{t('shell.newWorkspace') || 'New workspace'}</span>
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
