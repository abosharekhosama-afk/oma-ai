'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageSkeleton } from '../ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../ui/error-state';
import {
  getPreferences,
  updatePreferences,
  setLocaleCookie,
  NOTIFICATION_PREF_TYPES,
  type UserPreferences,
} from '../../lib/account-api';
import { useToast } from '../ui/toast';
import {
  getWorkspaceSettings,
  patchWorkspaceSettings,
  type WorkspaceSettings,
} from '../../lib/workspace-extras-api';
import { useLocale, useT } from '../../lib/use-locale';
import { ShellIcon } from '../shell/shell-icons';
import type { NavIconId } from '../shell/nav-config';
import { WorkDriveSettings } from './workdrive-settings';
import { useCapabilities } from '../../lib/use-capabilities';

type DemoPreferences = UserPreferences;
type Copy = { en: string; ar: string };
type Integration = { id: string; name: Copy; category: string; purpose: Copy };
import type { SettingsSectionId as Section } from './settings-sections';

const pickCopy = (c: Copy, locale: string) =>
  locale.toLowerCase().startsWith('ar') ? c.ar || c.en : c.en;

/** Honest catalog: nothing is connected yet — no demo endpoint, no fake statuses. */
const INTEGRATIONS: Integration[] = [
  {
    id: 'instagram',
    category: 'social',
    name: { en: 'Instagram', ar: 'إنستغرام' },
    purpose: { en: 'Publish posts and reels', ar: 'نشر المنشورات والريلز' },
  },
  {
    id: 'facebook',
    category: 'social',
    name: { en: 'Facebook', ar: 'فيسبوك' },
    purpose: { en: 'Publish page posts', ar: 'نشر منشورات الصفحة' },
  },
  {
    id: 'tiktok',
    category: 'social',
    name: { en: 'TikTok', ar: 'تيك توك' },
    purpose: { en: 'Publish short videos', ar: 'نشر الفيديوهات القصيرة' },
  },
  {
    id: 'linkedin',
    category: 'social',
    name: { en: 'LinkedIn', ar: 'لينكدإن' },
    purpose: { en: 'Publish company updates', ar: 'نشر تحديثات الشركة' },
  },
  {
    id: 'x',
    category: 'social',
    name: { en: 'X', ar: 'إكس' },
    purpose: { en: 'Publish posts', ar: 'نشر التغريدات' },
  },
  {
    id: 'slack',
    category: 'messaging',
    name: { en: 'Slack', ar: 'سلاك' },
    purpose: { en: 'Approval notifications', ar: 'إشعارات الموافقات' },
  },
];

export type SettingsSection = Section;

const NAV: Array<{ id: Section; icon: NavIconId; group: 'account' | 'workspace' }> = [
  { id: 'general', icon: 'settings', group: 'account' },
  { id: 'localization', icon: 'activity', group: 'account' },
  { id: 'workflow', icon: 'tasks', group: 'account' },
  { id: 'notifications', icon: 'bell', group: 'account' },
  { id: 'workspace', icon: 'company', group: 'workspace' },
  { id: 'storage', icon: 'deliverables', group: 'workspace' },
  { id: 'integrations', icon: 'campaigns', group: 'workspace' },
];



/**
 * Personal + workspace settings in one card (same shell as the Workspace Settings card).
 * Opened from the account menu in the sidebar; `/app/settings?section=` redirects here.
 */
export function SettingsPanel({
  initialSection,
  onClose,
}: {
  initialSection?: Section | null;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [section, setSection] = useState<Section>(initialSection ?? 'general');
  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const capabilities = useCapabilities();
  const [ws, setWs] = useState<WorkspaceSettings | null>(null);
  const [wsDraft, setWsDraft] = useState<{ timezone: string; website_url: string }>({
    timezone: 'Asia/Jerusalem',
    website_url: '',
  });
  const [wsSaving, setWsSaving] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<DemoPreferences | null>(null);
  const [draft, setDraft] = useState<DemoPreferences | null>(null);
  const rows = INTEGRATIONS;
  const [intQ, setIntQ] = useState('');
  const [intCategory, setIntCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Per-user preferences + server workspace settings (timezone, website, approvals).
      const [preferences, workspace] = await Promise.all([
        getPreferences(),
        getWorkspaceSettings().catch((err: unknown) => {
          setWsError(err instanceof Error ? err.message : String(err));
          return null;
        }),
      ]);
      setPrefs(preferences);
      setDraft(preferences);
      setWs(workspace);
      if (workspace) {
        setWsDraft({ timezone: workspace.timezone, website_url: workspace.website_url ?? '' });
      }
      setError(null);
    } catch (err) {
      setError(errorKindOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveWorkspace() {
    setWsSaving(true);
    setWsError(null);
    try {
      const next = await patchWorkspaceSettings({
        timezone: wsDraft.timezone.trim(),
        website_url: wsDraft.website_url.trim() || null,
      });
      setWs(next);
      setWsDraft({ timezone: next.timezone, website_url: next.website_url ?? '' });
      toast.push(t('settings.workspace.saved'), 'success');
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg =
        status === 403
          ? t('settings.workspace.readOnly')
          : err instanceof Error
            ? err.message
            : String(err);
      setWsError(msg);
      toast.push(msg, 'danger');
    } finally {
      setWsSaving(false);
    }
  }

  async function savePrefs() {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await updatePreferences(draft);
      setPrefs(next);
      setDraft(next);
      if (next.localePreference !== 'system' && next.localePreference !== locale) {
        setLocaleCookie(next.localePreference);
        window.location.reload();
        return;
      }
      toast.push(t('demo.settings.saved'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.page.generic.title'), 'danger');
    } finally {
      setSaving(false);
    }
  }

  const dirty = Boolean(prefs && draft && JSON.stringify(prefs) !== JSON.stringify(draft));
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows]);
  const filteredIntegrations = useMemo(() => {
    const q = intQ.trim().toLowerCase();
    return rows.filter((i) => {
      if (intCategory !== 'all' && i.category !== intCategory) return false;
      if (!q) return true;
      const name = pickCopy(i.name, locale).toLowerCase();
      const purpose = pickCopy(i.purpose, locale).toLowerCase();
      return name.includes(q) || purpose.includes(q) || i.category.toLowerCase().includes(q);
    });
  }, [rows, intQ, intCategory, locale]);

  return (
    <div className="oma-ws-overlay" role="presentation" onClick={onClose}>
      <div
        className="oma-ws-panel oma-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.settings')}
        onClick={(e) => e.stopPropagation()}
        data-testid="demo-settings"
        data-surface="settings"
      >
        <aside className="oma-ws-panel-nav">
          <p className="oma-ws-panel-nav-group">{t('settings.group.account')}</p>
          {NAV.filter((n) => n.group === 'account').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              data-testid={`demo-settings-nav-${item.id}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{t(`demo.settings.section.${item.id}`)}</span>
            </button>
          ))}
          <p className="oma-ws-panel-nav-group">{t('nav.section.workspace')}</p>
          {NAV.filter((n) => n.group === 'workspace').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              data-testid={`demo-settings-nav-${item.id}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{t(`demo.settings.section.${item.id}`)}</span>
            </button>
          ))}
        </aside>

        <div className="oma-ws-panel-main">
          <button
            type="button"
            className="oma-ws-panel-close"
            aria-label={t('brand.evidence.close')}
            onClick={onClose}
          >
            ×
          </button>
          {loading ? <PageSkeleton rows={6} /> : null}
          {error ? <ErrorState compact kind={error} onRetry={() => void load()} /> : null}
          {!loading && draft ? (
            <div className="oma-settings-panel__body">
              {section === 'workspace' && (
                <section data-testid="settings-workspace">
                  <h2 className="oma-ws-section-title">{t('settings.workspace.title')}</h2>
                  <p className="oma-ws-empty-desc">{t('settings.workspace.body')}</p>
                  {wsError ? (
                    <p
                      className="oma-ws-save-msg"
                      role="alert"
                      data-testid="settings-workspace-error"
                    >
                      {wsError}
                    </p>
                  ) : null}
                  <div className="oma-ws-field">
                    <label className="oma-ws-label">{t('settings.workspace.timezone')}</label>
                    <Input
                      value={wsDraft.timezone}
                      data-testid="settings-workspace-timezone"
                      onChange={(e) => setWsDraft({ ...wsDraft, timezone: e.target.value })}
                    />
                  </div>
                  <div className="oma-ws-field">
                    <label className="oma-ws-label">{t('settings.workspace.website')}</label>
                    <Input
                      value={wsDraft.website_url}
                      placeholder="https://"
                      data-testid="settings-workspace-website"
                      onChange={(e) => setWsDraft({ ...wsDraft, website_url: e.target.value })}
                    />
                  </div>
                  <div className="oma-ws-action-row">
                    <Button
                      type="primary"
                      data-testid="settings-workspace-save"
                      loading={wsSaving}
                      disabled={
                        wsSaving ||
                        (ws !== null &&
                          ws.timezone === wsDraft.timezone &&
                          (ws.website_url ?? '') === wsDraft.website_url)
                      }
                      onClick={() => void saveWorkspace()}
                    >
                      {t('demo.settings.save')}
                    </Button>
                  </div>
                </section>
              )}

              {(section === 'general' || section === 'localization' || section === 'workflow') && (
                <section data-testid="demo-settings-general">
                  <h2 className="oma-ws-section-title">
                    {t(`demo.settings.section.${section}`) || section}
                  </h2>
                  <p className="oma-ws-empty-desc">{t('settings.prefsNote')}</p>
                  {dirty ? (
                    <p
                      className="oma-settings-dirty"
                      data-testid="demo-settings-dirty"
                      role="status"
                    >
                      {t('demo.settings.dirty')}
                    </p>
                  ) : null}

                  {section === 'general' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">{t('demo.settings.timezone')}</label>
                      <Input
                        value={draft.timezone}
                        data-testid="demo-settings-timezone"
                        onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                      />
                    </div>
                  ) : null}
                  {section === 'general' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">{t('demo.settings.weekStart')}</label>
                      <SelectField
                        value={draft.weekStart}
                        data-testid="demo-settings-week-start"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            weekStart: e.target.value as DemoPreferences['weekStart'],
                          })
                        }
                      >
                        <option value="monday">{t('demo.settings.monday')}</option>
                        <option value="sunday">{t('demo.settings.sunday')}</option>
                      </SelectField>
                    </div>
                  ) : null}
                  {section === 'localization' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">{t('demo.settings.localePref')}</label>
                      <SelectField
                        value={draft.localePreference}
                        data-testid="demo-settings-locale"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            localePreference: e.target.value as DemoPreferences['localePreference'],
                          })
                        }
                      >
                        <option value="system">{t('settings.option.system')}</option>
                        <option value="en">{t('settings.option.en')}</option>
                        <option value="ar">{t('settings.option.ar')}</option>
                      </SelectField>
                    </div>
                  ) : null}
                  {section === 'workflow' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">
                        {t('demo.settings.defaultContentView')}
                      </label>
                      <SelectField
                        value={draft.defaultContentView}
                        data-testid="demo-settings-content-view"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            defaultContentView: e.target
                              .value as DemoPreferences['defaultContentView'],
                          })
                        }
                      >
                        <option value="list">{t('settings.option.list')}</option>
                        <option value="calendar">{t('settings.option.calendar')}</option>
                        <option value="feed">{t('settings.option.feed')}</option>
                        <option value="grid">{t('settings.option.grid')}</option>
                      </SelectField>
                    </div>
                  ) : null}
                  {section === 'workflow' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">{t('demo.settings.defaultTaskView')}</label>
                      <SelectField
                        value={draft.defaultTaskView}
                        data-testid="demo-settings-task-view"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            defaultTaskView: e.target.value as DemoPreferences['defaultTaskView'],
                          })
                        }
                      >
                        <option value="board">{t('settings.option.board')}</option>
                        <option value="list">{t('settings.option.list')}</option>
                      </SelectField>
                    </div>
                  ) : null}

                  <div className="oma-ws-action-row">
                    <Button
                      type="default"
                      disabled={!dirty || saving}
                      onClick={() => setDraft(prefs)}
                    >
                      {t('demo.create.cancel')}
                    </Button>
                    <Button
                      type="primary"
                      data-testid="demo-settings-save"
                      disabled={!dirty || saving}
                      onClick={() => void savePrefs()}
                    >
                      {t('demo.settings.save')}
                    </Button>
                  </div>
                </section>
              )}

              {section === 'notifications' && (
                <section data-testid="settings-notifications">
                  <h2 className="oma-ws-section-title">
                    {t('demo.settings.section.notifications')}
                  </h2>
                  <p className="oma-ws-empty-desc">{t('settings.notifications.body')}</p>
                  <label className="oma-pref-toggle">
                    <span>{t('settings.notifications.all')}</span>
                    <input
                      type="checkbox"
                      data-testid="notif-pref-all"
                      checked={draft.notifications.all !== false}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          notifications: { ...draft.notifications, all: e.target.checked },
                        })
                      }
                    />
                  </label>
                  {NOTIFICATION_PREF_TYPES.map((type) => (
                    <label key={type} className="oma-pref-toggle">
                      <span>{t(`shell.notificationPref.${type}`)}</span>
                      <input
                        type="checkbox"
                        data-testid={`notif-pref-${type}`}
                        disabled={draft.notifications.all === false}
                        checked={
                          draft.notifications.all !== false && draft.notifications[type] !== false
                        }
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            notifications: { ...draft.notifications, [type]: e.target.checked },
                          })
                        }
                      />
                    </label>
                  ))}
                  <div className="oma-ws-action-row">
                    <Button
                      type="default"
                      disabled={!dirty || saving}
                      onClick={() => setDraft(prefs)}
                    >
                      {t('demo.create.cancel')}
                    </Button>
                    <Button
                      type="primary"
                      data-testid="settings-notifications-save"
                      disabled={!dirty || saving}
                      onClick={() => void savePrefs()}
                    >
                      {t('demo.settings.save')}
                    </Button>
                  </div>
                </section>
              )}

              {section === 'storage' && !capabilities.loading && (
                <WorkDriveSettings
                  t={t}
                  locale={locale}
                  canManage={capabilities.capabilities.includes('tenant.manage')}
                />
              )}

              {section === 'integrations' && (
                <section data-testid="demo-settings-integrations">
                  <h2 className="oma-ws-section-title">
                    {t('demo.settings.section.integrations')}
                  </h2>
                  <p className="oma-ws-empty-desc" data-testid="settings-integrations-honest">
                    {t('settings.integrations.body')}
                  </p>
                  <div
                    className="oma-planable-toolbar"
                    style={{ display: 'flex', gap: 8, maxWidth: '100%' }}
                  >
                    <Input
                      value={intQ}
                      placeholder={t('settingsPage.search_integrations')}
                      onChange={(e) => setIntQ(e.target.value)}
                    />
                    <SelectField
                      value={intCategory}
                      onChange={(e) => setIntCategory(e.target.value)}
                    >
                      <option value="all">{t('settings.option.allCategories')}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {t(`settings.integrations.category.${c}`)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="oma-integrations-grid">
                    {filteredIntegrations.map((i) => (
                      <div
                        key={i.id}
                        className="oma-integration-card"
                        data-testid="integration-card"
                      >
                        <strong>{pickCopy(i.name, locale)}</strong>
                        <span className="oma-ws-badge oma-ws-badge--ghost">
                          {t('settings.integrations.notConnected')}
                        </span>
                        <p>{pickCopy(i.purpose, locale)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
