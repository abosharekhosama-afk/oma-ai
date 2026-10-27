'use client';

import { Button, Input, Modal, Select } from 'antd';
import { useRef, useState } from 'react';
import { NetworkIcon } from '../content/network-icon';
import { initials } from '../content/post-preview-model';
import {
  BRAND_ROLES,
  SOCIAL_NETWORKS,
  type BrandMemberCandidate,
  type BrandMemberRow,
  type BrandRole,
  type SocialNetwork,
  type SocialPageRow,
  type SocialProvider,
} from '../../lib/brand-settings-api';

export type BrandSettingsTab = 'general' | 'members' | 'accounts';
type Tr = (key: string) => string;

export type BrandSettingsViewProps = {
  t: Tr;
  tab: BrandSettingsTab;
  onTab: (tab: BrandSettingsTab) => void;
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
    logo_asset_id?: string | null;
    timezone: string;
    archived: boolean;
  };
  timezones: string[];
  canManage: boolean;
  canManageMembers: boolean;
  canConnect: boolean;
  saving: boolean;
  notice: { kind: 'success' | 'error' | 'info'; text: string } | null;
  onSave: (patch: {
    name: string;
    logoUrl: string | null;
    logoAssetId: string | null;
    timezone: string;
  }) => void;
  /** Uploads to WorkDrive when connected, otherwise returns a small data URL. */
  onLogoFile: (file: File) => Promise<{ url: string; assetId: string | null } | null>;
  /** Where logos are stored; null while loading. */
  logoStorage: { connected: boolean; orgName: string | null; canConnect: boolean } | null;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  members: BrandMemberRow[] | null;
  candidates: BrandMemberCandidate[];
  onAddMember: (userId: string, role: BrandRole) => void;
  onRole: (userId: string, role: BrandRole) => void;
  onRemoveMember: (userId: string) => void;
  pages: SocialPageRow[] | null;
  providers: SocialProvider[];
  connecting: SocialNetwork | null;
  onConnect: (network: SocialNetwork) => void;
  onDisconnect: (page: SocialPageRow) => void;
};

export function BrandLogo({
  name,
  url,
  size = 40,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  return (
    <span className="oma-bs-logo" style={{ inlineSize: size, blockSize: size }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : <span>{initials(name || '·')}</span>}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="oma-bs-avatar" aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials(name || '·')}
    </span>
  );
}

export function BrandSettingsView(p: BrandSettingsViewProps) {
  const { t } = p;
  const tabs: Array<{ id: BrandSettingsTab; label: string }> = [
    { id: 'general', label: t('brandSettings.tab.general') },
    { id: 'members', label: t('brandSettings.tab.members') },
    { id: 'accounts', label: t('brandSettings.tab.accounts') },
  ];
  return (
    <div className="oma-bs" data-testid="brand-settings">
      <header className="oma-bs-head">
        <BrandLogo name={p.brand.name} url={p.brand.logo_url} size={32} />
        <div className="oma-bs-head__text">
          <h1 className="oma-bs-title">{p.brand.name}</h1>
          <p className="oma-bs-sub">{t('brandSettings.subtitle')}</p>
        </div>
        {p.brand.archived ? (
          <span className="oma-bs-badge">{t('brandSettings.archivedBadge')}</span>
        ) : null}
      </header>
      <div className="oma-bs-body">
        <nav className="oma-bs-nav" aria-label={t('brandSettings.navLabel')}>
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              className="oma-bs-nav__item"
              aria-current={p.tab === x.id ? 'page' : undefined}
              data-testid={`brand-settings-tab-${x.id}`}
              onClick={() => p.onTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </nav>
        <main className="oma-bs-main">
          {p.notice ? (
            <p
              className={`oma-bs-notice oma-bs-notice--${p.notice.kind}`}
              role={p.notice.kind === 'error' ? 'alert' : 'status'}
            >
              {p.notice.text}
            </p>
          ) : null}
          {p.tab === 'general' ? <GeneralTab {...p} /> : null}
          {p.tab === 'members' ? <MembersTab {...p} /> : null}
          {p.tab === 'accounts' ? <AccountsTab {...p} /> : null}
        </main>
      </div>
    </div>
  );
}

function GeneralTab(p: BrandSettingsViewProps) {
  const { t } = p;
  const [name, setName] = useState(p.brand.name);
  const [logo, setLogo] = useState<string | null>(p.brand.logo_url);
  const [logoAssetId, setLogoAssetId] = useState<string | null>(p.brand.logo_asset_id ?? null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoLink, setLogoLink] = useState(
    p.brand.logo_url?.startsWith('https://') ? p.brand.logo_url : '',
  );
  const [tz, setTz] = useState(p.brand.timezone);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const disabled = !p.canManage || p.brand.archived;
  const nameError = !name.trim()
    ? t('brandSettings.general.nameRequired')
    : name.trim().length > 120
      ? t('brandSettings.general.nameTooLong')
      : null;
  const dirty =
    name.trim() !== p.brand.name || logo !== p.brand.logo_url || tz !== p.brand.timezone;

  return (
    <>
      <section className="oma-bs-card" aria-labelledby="bs-general">
        <h2 id="bs-general" className="oma-bs-card__title">
          {t('brandSettings.general.title')}
        </h2>
        <p className="oma-bs-card__desc">{t('brandSettings.general.desc')}</p>

        <div className="oma-bs-field">
          <span className="oma-bs-label">{t('brandSettings.general.logo')}</span>
          <div className="oma-bs-logo-row">
            <BrandLogo name={name} url={logo} size={56} />
            <div className="oma-bs-logo-actions">
              <input
                ref={file}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                data-testid="brand-logo-file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setLogoBusy(true);
                  try {
                    const r = await p.onLogoFile(f);
                    if (r) {
                      setLogo(r.url);
                      setLogoAssetId(r.assetId);
                      setLogoLink('');
                    }
                  } finally {
                    setLogoBusy(false);
                  }
                }}
              />
              <Button
                disabled={disabled || logoBusy}
                loading={logoBusy}
                data-testid="brand-logo-upload"
                onClick={() => file.current?.click()}
              >
                {t('brandSettings.general.upload')}
              </Button>
              {logo ? (
                <Button
                  type="text"
                  disabled={disabled}
                  onClick={() => {
                    setLogo(null);
                    setLogoAssetId(null);
                    setLogoLink('');
                  }}
                >
                  {t('brandSettings.general.removeLogo')}
                </Button>
              ) : null}
              <p className="oma-bs-hint" data-testid="brand-logo-storage">
                {p.logoStorage?.connected
                  ? t('brandSettings.general.logoHintWorkDrive').replace(
                      '{org}',
                      p.logoStorage.orgName ?? 'WorkDrive',
                    )
                  : t('brandSettings.general.logoHint')}
                {p.logoStorage && !p.logoStorage.connected && p.logoStorage.canConnect ? (
                  <>
                    {' '}
                    <a href="/app?settings=storage" className="oma-bs-link">
                      {t('brandSettings.general.logoConnectWorkDrive')}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <label className="oma-bs-label oma-bs-label--sub" htmlFor="bs-logo-link">
            {t('brandSettings.general.logoLink')}
          </label>
          <Input
            id="bs-logo-link"
            className="oma-ltr"
            value={logoLink}
            disabled={disabled}
            placeholder="https://"
            onChange={(e) => {
              setLogoLink(e.target.value);
              const v = e.target.value.trim();
              setLogo(v ? v : null);
              setLogoAssetId(null);
            }}
          />
        </div>

        <div className="oma-bs-field">
          <label className="oma-bs-label" htmlFor="bs-name">
            {t('brandSettings.general.name')}
          </label>
          <Input
            id="bs-name"
            value={name}
            maxLength={120}
            disabled={disabled}
            status={nameError ? 'error' : undefined}
            data-testid="brand-settings-name"
            onChange={(e) => setName(e.target.value)}
          />
          {nameError ? <p className="oma-bs-error">{nameError}</p> : null}
        </div>

        <div className="oma-bs-field">
          <label className="oma-bs-label" htmlFor="bs-tz">
            {t('brandSettings.general.timezone')}
          </label>
          <Select
            id="bs-tz"
            showSearch
            value={tz}
            disabled={disabled}
            className="oma-bs-select oma-ltr"
            options={p.timezones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))}
            onChange={setTz}
          />
          <p className="oma-bs-hint">{t('brandSettings.general.timezoneHint')}</p>
        </div>

        <div className="oma-bs-actions">
          <Button
            type="primary"
            loading={p.saving}
            disabled={disabled || !dirty || Boolean(nameError)}
            data-testid="brand-settings-save"
            onClick={() =>
              p.onSave({ name: name.trim(), logoUrl: logo, logoAssetId, timezone: tz })
            }
          >
            {t('brandSettings.save')}
          </Button>
        </div>
      </section>

      {p.canManage ? (
        <section className="oma-bs-card oma-bs-card--danger" aria-labelledby="bs-danger">
          <h2 id="bs-danger" className="oma-bs-card__title">
            {t('brandSettings.danger.title')}
          </h2>
          <div className="oma-bs-danger-row">
            <div>
              <strong>
                {p.brand.archived
                  ? t('brandSettings.danger.unarchive')
                  : t('brandSettings.danger.archive')}
              </strong>
              <p className="oma-bs-hint">
                {p.brand.archived
                  ? t('brandSettings.danger.unarchiveDesc')
                  : t('brandSettings.danger.archiveDesc')}
              </p>
            </div>
            {p.brand.archived ? (
              <Button onClick={p.onUnarchive}>{t('brandSettings.danger.unarchive')}</Button>
            ) : (
              <Button onClick={() => setConfirm('archive')}>
                {t('brandSettings.danger.archive')}
              </Button>
            )}
          </div>
          <div className="oma-bs-danger-row">
            <div>
              <strong>{t('brandSettings.danger.delete')}</strong>
              <p className="oma-bs-hint">{t('brandSettings.danger.deleteDesc')}</p>
            </div>
            <Button danger onClick={() => setConfirm('delete')}>
              {t('brandSettings.danger.delete')}
            </Button>
          </div>
        </section>
      ) : null}

      <Modal
        open={confirm === 'archive'}
        title={t('brandSettings.danger.archiveConfirmTitle')}
        okText={t('brandSettings.danger.archive')}
        cancelText={t('brandSettings.cancel')}
        onCancel={() => setConfirm(null)}
        onOk={() => {
          setConfirm(null);
          p.onArchive();
        }}
      >
        <p>{t('brandSettings.danger.archiveConfirmBody')}</p>
      </Modal>
      <Modal
        open={confirm === 'delete'}
        title={t('brandSettings.danger.deleteConfirmTitle')}
        okText={t('brandSettings.danger.delete')}
        okButtonProps={{ danger: true, disabled: deleteName.trim() !== p.brand.name }}
        cancelText={t('brandSettings.cancel')}
        onCancel={() => {
          setConfirm(null);
          setDeleteName('');
        }}
        onOk={() => {
          setConfirm(null);
          setDeleteName('');
          p.onDelete();
        }}
      >
        <p>{t('brandSettings.danger.deleteConfirmBody')}</p>
        <label className="oma-bs-label" htmlFor="bs-delete-name">
          {t('brandSettings.danger.typeName')}
        </label>
        <Input
          id="bs-delete-name"
          value={deleteName}
          onChange={(e) => setDeleteName(e.target.value)}
        />
      </Modal>
    </>
  );
}

function MembersTab(p: BrandSettingsViewProps) {
  const { t } = p;
  const [userId, setUserId] = useState<string | undefined>();
  const [role, setRole] = useState<BrandRole>('EDITOR');
  const roleOptions = BRAND_ROLES.map((r) => ({ value: r, label: t(`brandSettings.role.${r}`) }));
  return (
    <section className="oma-bs-card" aria-labelledby="bs-members">
      <h2 id="bs-members" className="oma-bs-card__title">
        {t('brandSettings.members.title')}
      </h2>
      <p className="oma-bs-card__desc">{t('brandSettings.members.desc')}</p>
      {p.canManageMembers ? (
        <div className="oma-bs-add" data-testid="brand-members-add">
          <Select
            className="oma-bs-select"
            placeholder={t('brandSettings.members.pick')}
            value={userId}
            onChange={setUserId}
            disabled={!p.candidates.length}
            notFoundContent={t('brandSettings.members.noCandidates')}
            options={p.candidates.map((c) => ({ value: c.user_id, label: c.name || c.email }))}
          />
          <Select className="oma-bs-role" value={role} onChange={setRole} options={roleOptions} />
          <Button
            type="primary"
            disabled={!userId}
            onClick={() => {
              if (!userId) return;
              p.onAddMember(userId, role);
              setUserId(undefined);
            }}
          >
            {t('brandSettings.members.add')}
          </Button>
        </div>
      ) : null}
      {p.members === null ? (
        <div className="oma-bs-skeleton" aria-busy="true" />
      ) : p.members.length === 0 ? (
        <p className="oma-bs-empty">{t('brandSettings.members.empty')}</p>
      ) : (
        <ul className="oma-bs-list" data-testid="brand-members-list">
          {p.members.map((m) => (
            <li key={m.user_id} className="oma-bs-row">
              <Avatar name={m.name || m.email} url={m.avatar_url} />
              <div className="oma-bs-row__id">
                <bdi className="oma-bs-row__name">{m.name || m.email}</bdi>
                <span className="oma-bs-row__meta oma-ltr">{m.email}</span>
              </div>
              {m.workspace_admin ? (
                <span className="oma-bs-chip">{t('brandSettings.members.workspaceAdmin')}</span>
              ) : p.canManageMembers ? (
                <>
                  <Select
                    className="oma-bs-role"
                    value={m.role}
                    aria-label={t('brandSettings.members.role')}
                    onChange={(r) => p.onRole(m.user_id, r)}
                    options={roleOptions}
                  />
                  <Button type="text" onClick={() => p.onRemoveMember(m.user_id)}>
                    {t('brandSettings.members.remove')}
                  </Button>
                </>
              ) : (
                <span className="oma-bs-chip">{t(`brandSettings.role.${m.role}`)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <dl className="oma-bs-roles">
        {BRAND_ROLES.map((r) => (
          <div key={r}>
            <dt>{t(`brandSettings.role.${r}`)}</dt>
            <dd>{t(`brandSettings.roleDesc.${r}`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AccountsTab(p: BrandSettingsViewProps) {
  const { t } = p;
  const byNet = new Map(p.providers.map((x) => [x.network, x]));
  return (
    <section className="oma-bs-card" aria-labelledby="bs-accounts">
      <h2 id="bs-accounts" className="oma-bs-card__title">
        {t('brandSettings.accounts.title')}
      </h2>
      <p className="oma-bs-card__desc">{t('brandSettings.accounts.desc')}</p>
      {p.pages === null ? (
        <div className="oma-bs-skeleton" aria-busy="true" />
      ) : (
        <ul className="oma-bs-nets" data-testid="brand-accounts">
          {SOCIAL_NETWORKS.map((n) => {
            const prov = byNet.get(n);
            const pages = p.pages!.filter((x) => x.network === n);
            const available = Boolean(prov?.available);
            return (
              <li key={n} className="oma-bs-net" data-available={available ? 'true' : 'false'}>
                <div className="oma-bs-net__head">
                  <span className="oma-bs-net__icon">
                    <NetworkIcon network={n} size={20} />
                  </span>
                  <div className="oma-bs-net__text">
                    <strong>{t(`brandSettings.network.${n}`)}</strong>
                    <span className="oma-bs-hint">{t(`brandSettings.networkDesc.${n}`)}</span>
                  </div>
                  {available ? (
                    <Button
                      disabled={!p.canConnect || p.brand.archived}
                      loading={p.connecting === n}
                      data-testid={`brand-connect-${n}`}
                      onClick={() => p.onConnect(n)}
                    >
                      {pages.length
                        ? t('brandSettings.accounts.connectAnother')
                        : t('brandSettings.accounts.connect')}
                    </Button>
                  ) : (
                    <span
                      className="oma-bs-chip oma-bs-chip--muted"
                      data-testid={`brand-unavailable-${n}`}
                    >
                      {t('brandSettings.accounts.notAvailable')}
                    </span>
                  )}
                </div>
                {!available ? (
                  <p className="oma-bs-hint oma-bs-net__note">
                    {t('brandSettings.accounts.notAvailableDesc')}
                  </p>
                ) : null}
                {pages.length ? (
                  <ul className="oma-bs-list">
                    {pages.map((pg) => (
                      <li key={pg.id} className="oma-bs-row">
                        <Avatar name={pg.name} url={pg.avatar_url} />
                        <div className="oma-bs-row__id">
                          <bdi className="oma-bs-row__name">{pg.name}</bdi>
                          <span
                            className={`oma-bs-status oma-bs-status--${pg.status.toLowerCase()}`}
                          >
                            {t(`brandSettings.accounts.status.${pg.status}`)}
                          </span>
                        </div>
                        {pg.status === 'NEEDS_REAUTH' && available && p.canConnect ? (
                          <Button onClick={() => p.onConnect(n)}>
                            {t('brandSettings.accounts.reconnect')}
                          </Button>
                        ) : null}
                        {p.canConnect ? (
                          <Button type="text" onClick={() => p.onDisconnect(pg)}>
                            {t('brandSettings.accounts.disconnect')}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
