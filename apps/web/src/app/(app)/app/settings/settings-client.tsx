'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import {
  getPreferences,
  updatePreferences,
  setLocaleCookie,
  NOTIFICATION_PREF_TYPES,
  type UserPreferences,
} from '../../../../lib/account-api';
import { useToast } from '../../../../components/ui/toast';
import {
  getWorkspaceSettings,
  patchWorkspaceSettings,
  type WorkspaceSettings,
} from '../../../../lib/workspace-extras-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { AiStatusNote } from '../../../../components/ai/ai-status-note';
import { ShellIcon } from '../../../../components/shell/shell-icons';
import type { NavIconId } from '../../../../components/shell/nav-config';

type DemoPreferences = UserPreferences;
type Copy = { en: string; ar: string };
type Integration = { id: string; name: Copy; category: string; purpose: Copy };
type Section =
  | 'workspace'
  | 'general'
  | 'workflow'
  | 'notifications'
  | 'integrations'
  | 'localization';

const pickCopy = (c: Copy, locale: string) =>
  locale.toLowerCase().startsWith('ar') ? c.ar || c.en : c.en;

/** Honest catalog: nothing is connected yet — no demo endpoint, no fake statuses. */
const INTEGRATIONS: Integration[] = [
  { id: 'instagram', category: 'social', name: { en: 'Instagram', ar: 'إنستغرام' }, purpose: { en: 'Publish posts and reels', ar: 'نشر المنشورات والريلز' } },
  { id: 'facebook', category: 'social', name: { en: 'Facebook', ar: 'فيسبوك' }, purpose: { en: 'Publish page posts', ar: 'نشر منشورات الصفحة' } },
  { id: 'tiktok', category: 'social', name: { en: 'TikTok', ar: 'تيك توك' }, purpose: { en: 'Publish short videos', ar: 'نشر الفيديوهات القصيرة' } },
  { id: 'linkedin', category: 'social', name: { en: 'LinkedIn', ar: 'لينكدإن' }, purpose: { en: 'Publish company updates', ar: 'نشر تحديثات الشركة' } },
  { id: 'x', category: 'social', name: { en: 'X', ar: 'إكس' }, purpose: { en: 'Publish posts', ar: 'نشر التغريدات' } },
  { id: 'storage', category: 'storage', name: { en: 'File storage', ar: 'تخزين الملفات' }, purpose: { en: 'Sync approved assets', ar: 'مزامنة الملفات المعتمدة' } },
  { id: 'slack', category: 'messaging', name: { en: 'Slack', ar: 'سلاك' }, purpose: { en: 'Approval notifications', ar: 'إشعارات الموافقات' } },
];

const NAV: Array<{ id: Section; label: string; icon: NavIconId }> = [
  { id: 'workspace', label: 'Workspace', icon: 'company' },
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'workflow', label: 'Workflow', icon: 'tasks' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'integrations', label: 'Integrations', icon: 'company' },
  { id: 'localization', label: 'Localization', icon: 'activity' },
];

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [section, setSection] = useState<Section>('workspace');
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
    <div className="oma-planable-page" data-testid="demo-settings" data-surface="settings">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">{t('demo.settings.title') || 'Settings'}</h1>
          <p className="oma-planable-page__sub">
            {t('demo.settings.subtitle') || 'Preferences, workflow, and integrations'}
          </p>
        </div>
        <Button type="default" onClick={() => (window.location.href = '/app/company/members')}>
          <ShellIcon name="company" size={14} />
          <span>{t('demo.settings.companyLink') || 'Company members'}</span>
        </Button>
      </div>

      <AiStatusNote />

      {loading ? <PageSkeleton rows={6} /> : null}
      {error ? <ErrorState compact kind={error} onRetry={() => void load()} /> : null}

      {!loading && draft ? (
        <div className="oma-settings-shell">
          <aside className="oma-ws-panel-nav oma-settings-shell__nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
                data-testid={`demo-settings-nav-${item.id}`}
                onClick={() => setSection(item.id)}
              >
                <ShellIcon name={item.icon} size={16} />
                <span>{t(`demo.settings.section.${item.id}`) || item.label}</span>
              </button>
            ))}
          </aside>

          <div className="oma-planable-card oma-settings-shell__main">
            {section === 'workspace' && (
              <section data-testid="settings-workspace">
                <h2 className="oma-ws-section-title">{t('settings.workspace.title')}</h2>
                <p className="oma-ws-empty-desc">{t('settings.workspace.body')}</p>
                {wsError ? (
                  <p className="oma-ws-save-msg" role="alert" data-testid="settings-workspace-error">
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
                  <p className="oma-settings-dirty" data-testid="demo-settings-dirty" role="status">
                    {t('demo.settings.dirty')}
                  </p>
                ) : null}

                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('demo.settings.timezone')}</label>
                  <Input
                    value={draft.timezone}
                    data-testid="demo-settings-timezone"
                    onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  />
                </div>
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
                    <option value="system">system</option>
                    <option value="en">en</option>
                    <option value="ar">ar</option>
                  </SelectField>
                </div>
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('demo.settings.defaultContentView')}</label>
                  <SelectField
                    value={draft.defaultContentView}
                    data-testid="demo-settings-content-view"
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultContentView: e.target.value as DemoPreferences['defaultContentView'],
                      })
                    }
                  >
                    <option value="list">list</option>
                    <option value="calendar">calendar</option>
                    <option value="feed">feed</option>
                    <option value="grid">grid</option>
                  </SelectField>
                </div>
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
                    <option value="board">board</option>
                    <option value="list">list</option>
                  </SelectField>
                </div>
                <p className="oma-muted">{t('demo.settings.reducedMotionNote')}</p>
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
                <h2 className="oma-ws-section-title">{t('demo.settings.section.notifications')}</h2>
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
                <label className="oma-pref-toggle">
                  <span>{t('settings.notifications.reviewReminders')}</span>
                  <input
                    type="checkbox"
                    checked={draft.reviewReminders}
                    onChange={(e) => setDraft({ ...draft, reviewReminders: e.target.checked })}
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

            {section === 'integrations' && (
              <section data-testid="demo-settings-integrations">
                <h2 className="oma-ws-section-title">{t('demo.settings.section.integrations')}</h2>
                <p className="oma-ws-empty-desc" data-testid="settings-integrations-honest">
                  {t('settings.integrations.body')}
                </p>
                <div
                  className="oma-planable-toolbar"
                  style={{ display: 'flex', gap: 8, maxWidth: '100%' }}
                >
                  <Input
                    value={intQ}
                    placeholder="Search integrations…"
                    onChange={(e) => setIntQ(e.target.value)}
                  />
                  <SelectField value={intCategory} onChange={(e) => setIntCategory(e.target.value)}>
                    <option value="all">all</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div className="oma-integrations-grid">
                  {filteredIntegrations.map((i) => (
                    <div key={i.id} className="oma-integration-card" data-testid="integration-card">
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
        </div>
      ) : null}
    </div>
  );
}
