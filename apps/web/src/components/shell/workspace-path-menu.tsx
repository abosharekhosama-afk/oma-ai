'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import {
  CheckOutlined,
  DownOutlined,
  PlusOutlined,
  SettingOutlined,
  ShopOutlined,
  AppstoreOutlined,
} from '../ui/lucide-icons';
import {
  BRAND_LOGO_EVENT,
  selectBrand,
  setActiveBrandId,
  useActiveBrandId,
} from '../../lib/active-brand';

type Membership = { id: string; tenant_id: string; tenant_name: string };
type Me = { active_tenant_id: string | null; memberships: Membership[] };
type BrandItem = { id: string; name: string; logo_url?: string | null };

function OmaMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="11" height="11" rx="3.5" fill="#5CC98E" />
      <rect x="16" y="3" width="11" height="11" rx="3.5" fill="#4C8DFF" />
      <rect x="3" y="16" width="11" height="11" rx="3.5" fill="#FFB547" />
      <rect x="16" y="16" width="11" height="11" rx="3.5" fill="#A66CFF" />
    </svg>
  );
}
function WorkspaceMark({ logoUrl, size = 22 }: { logoUrl?: string | null; size?: number }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" width={size} height={size} />
  ) : (
    <OmaMark size={size} />
  );
}

/** Workspace (tenant) and Brand selectors are separate controls with separate actions. */
export function WorkspacePathMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [openMenu, setOpenMenu] = useState<'workspace' | 'brand' | null>(null);
  const [busyTenant, setBusyTenant] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeBrandId = useActiveBrandId();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(profile);
        if (profile.active_tenant_id) {
          const list = await api<{ data?: BrandItem[] }>('/api/v1/brands?limit=100');
          if (!cancelled) setBrands(Array.isArray(list.data) ? list.data : []);
        } else if (!cancelled) {
          setBrands([]);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setBrands([]);
        }
      }
    }
    void load();
    const onLogo = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; logo_url?: string | null }>).detail;
      if (!detail?.id) return;
      setBrands((rows) =>
        rows.map((brand) =>
          brand.id === detail.id ? { ...brand, logo_url: detail.logo_url ?? null } : brand,
        ),
      );
    };
    window.addEventListener(BRAND_LOGO_EVENT, onLogo);
    return () => {
      cancelled = true;
      window.removeEventListener(BRAND_LOGO_EVENT, onLogo);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const activeMembership = me?.memberships.find((item) => item.tenant_id === me.active_tenant_id);
  const workspaceName = activeMembership?.tenant_name || t('shell.workspace') || 'Workspace';
  const selectedBrand = brands.find((brand) => brand.id === activeBrandId);
  const brandName = selectedBrand?.name || t('shell.brandAll') || 'All brands';

  async function activateWorkspace(tenantId: string) {
    if (!tenantId || tenantId === me?.active_tenant_id || busyTenant) return;
    setBusyTenant(true);
    try {
      await api('/api/v1/tenants/active', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setActiveBrandId(null);
      window.location.assign('/app');
    } catch {
      setBusyTenant(false);
    }
  }

  return (
    <div className="oma-path-ws" ref={rootRef} data-testid="shell-context-selectors">
      <div className="oma-context-selector">
        <button
          type="button"
          className="oma-breadcrumb-workspace"
          data-testid="shell-workspace-path"
          aria-label={t('shell.workspaceSelector') || 'Workspace selector'}
          aria-expanded={openMenu === 'workspace'}
          aria-haspopup="menu"
          onClick={() => setOpenMenu((current) => (current === 'workspace' ? null : 'workspace'))}
        >
          <span className="oma-breadcrumb-workspace-mark" aria-hidden>
            <OmaMark />
          </span>
          <span className="oma-breadcrumb-workspace-label">{workspaceName}</span>
          <span className="oma-breadcrumb-caret" aria-hidden>
            <DownOutlined width={14} height={14} />
          </span>
        </button>
        {openMenu === 'workspace' ? (
          <div className="oma-path-ws-menu" role="menu" data-testid="shell-workspace-menu">
            <div className="oma-path-ws-menu__head">
              <span className="oma-breadcrumb-workspace-mark" aria-hidden>
                <OmaMark />
              </span>
              <strong className="oma-path-ws-menu__title">
                {t('shell.workspace') || 'Workspace'}
              </strong>
            </div>
            <div className="oma-path-ws-menu__chips">
              <button
                type="button"
                role="menuitem"
                className="oma-path-ws-menu__chip"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenSettings();
                }}
              >
                <SettingOutlined width={16} height={16} />
                <span>{t('shell.workspaceSettings') || 'Workspace settings'}</span>
              </button>
            </div>
            <div className="oma-path-ws-menu__section-label">
              {t('shell.workspaces') || 'Workspaces'}
            </div>
            <div className="oma-path-ws-menu__list">
              {(me?.memberships ?? []).map((membership) => {
                const active = membership.tenant_id === me?.active_tenant_id;
                return (
                  <button
                    key={membership.tenant_id}
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item oma-path-ws-menu__ws"
                    data-active={active ? 'true' : 'false'}
                    data-testid={`shell-workspace-option-${membership.tenant_id}`}
                    disabled={busyTenant}
                    onClick={() => {
                      setOpenMenu(null);
                      void activateWorkspace(membership.tenant_id);
                    }}
                  >
                    <span className="oma-path-ws-menu__ws-icon" aria-hidden>
                      <AppstoreOutlined width={18} height={18} />
                    </span>
                    <span className="oma-path-ws-menu__ws-name">{membership.tenant_name}</span>
                    {active ? (
                      <span className="oma-path-ws-menu__check" aria-hidden>
                        <CheckOutlined width={16} height={16} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              role="menuitem"
              className="oma-ws-menu-item"
              data-testid="shell-new-workspace"
              onClick={() => {
                setOpenMenu(null);
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
              onClick={() => {
                setOpenMenu(null);
                window.location.assign('/app/select-company');
              }}
            >
              <AppstoreOutlined width={16} height={16} />
              <span>{t('shell.manageWorkspaces') || 'All workspaces'}</span>
            </button>
          </div>
        ) : null}
      </div>

      <span className="oma-breadcrumb-sep" aria-hidden>
        /
      </span>

      <div className="oma-context-selector">
        <button
          type="button"
          className="oma-breadcrumb-workspace oma-breadcrumb-brand"
          data-testid="shell-brand-path"
          aria-label={t('shell.brandSelector') || 'Brand selector'}
          aria-expanded={openMenu === 'brand'}
          aria-haspopup="menu"
          onClick={() => setOpenMenu((current) => (current === 'brand' ? null : 'brand'))}
        >
          <span className="oma-breadcrumb-workspace-mark" aria-hidden>
            <ShopOutlined width={16} height={16} />
          </span>
          <span className="oma-breadcrumb-workspace-label">{brandName}</span>
          <span className="oma-breadcrumb-caret" aria-hidden>
            <DownOutlined width={14} height={14} />
          </span>
        </button>
        {openMenu === 'brand' ? (
          <div className="oma-path-ws-menu" role="menu" data-testid="shell-brand-menu">
            <div className="oma-path-ws-menu__head">
              <span className="oma-breadcrumb-workspace-mark" aria-hidden>
                <ShopOutlined width={16} height={16} />
              </span>
              <strong className="oma-path-ws-menu__title">{t('shell.brand') || 'Brand'}</strong>
            </div>
            <div className="oma-path-ws-menu__list">
              <button
                type="button"
                role="menuitem"
                className="oma-ws-menu-item oma-path-ws-menu__ws"
                data-active={!activeBrandId ? 'true' : 'false'}
                data-testid="shell-brand-option-all"
                onClick={() => {
                  setOpenMenu(null);
                  selectBrand(null);
                }}
              >
                <span className="oma-path-ws-menu__ws-icon" aria-hidden>
                  <ShopOutlined width={16} height={16} />
                </span>
                <span className="oma-path-ws-menu__ws-name">
                  {t('shell.brandAll') || 'All brands'}
                </span>
                {!activeBrandId ? (
                  <span className="oma-path-ws-menu__check" aria-hidden>
                    <CheckOutlined width={16} height={16} />
                  </span>
                ) : null}
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  role="menuitem"
                  className="oma-ws-menu-item oma-path-ws-menu__ws"
                  data-active={activeBrandId === brand.id ? 'true' : 'false'}
                  data-testid={`shell-brand-option-${brand.id}`}
                  onClick={() => {
                    setOpenMenu(null);
                    selectBrand(brand.id);
                  }}
                >
                  <span className="oma-path-ws-menu__ws-icon" aria-hidden>
                    <WorkspaceMark logoUrl={brand.logo_url} size={20} />
                  </span>
                  <span className="oma-path-ws-menu__ws-name">{brand.name}</span>
                  {activeBrandId === brand.id ? (
                    <span className="oma-path-ws-menu__check" aria-hidden>
                      <CheckOutlined width={16} height={16} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              className="oma-ws-menu-item"
              data-testid="shell-new-brand"
              onClick={() => {
                setOpenMenu(null);
                window.location.assign('/app/brands/new');
              }}
            >
              <PlusOutlined width={16} height={16} />
              <span>{t('shell.newBrand') || 'New brand'}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
