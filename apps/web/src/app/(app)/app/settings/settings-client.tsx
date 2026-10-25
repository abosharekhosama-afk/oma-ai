'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import type { DemoGraph } from '@oma/demo';
import {
  getPreferences,
  updatePreferences,
  setLocaleCookie,
  NOTIFICATION_PREF_TYPES,
  type UserPreferences,
} from '../../../../lib/account-api';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { useToast } from '../../../../components/ui/toast';
import { demoApi, isDemoForbidden, pickCopy } from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { AiStatusNote } from '../../../../components/ai/ai-status-note';
import { ShellIcon } from '../../../../components/shell/shell-icons';
import type { NavIconId } from '../../../../components/shell/nav-config';

type DemoPreferences = UserPreferences;
type Integration = DemoGraph['integrations'][number];
type Section = 'general' | 'workflow' | 'notifications' | 'integrations' | 'localization' | 'demo';

const NAV: Array<{ id: Section; label: string; icon: NavIconId }> = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'workflow', label: 'Workflow', icon: 'tasks' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'integrations', label: 'Integrations', icon: 'company' },
  { id: 'localization', label: 'Localization', icon: 'activity' },
  { id: 'demo', label: 'Demo', icon: 'home' },
];

export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [section, setSection] = useState<Section>('general');
  const [prefs, setPrefs] = useState<DemoPreferences | null>(null);
  const [draft, setDraft] = useState<DemoPreferences | null>(null);
  const [rows, setRows] = useState<Integration[]>([]);
  const [intQ, setIntQ] = useState('');
  const [intCategory, setIntCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Per-user preferences are real account data; integrations catalog is optional (demo-only).
      const [preferences, integrations] = await Promise.all([
        getPreferences(),
        demoApi<Integration[]>('/integrations').catch(() => [] as Integration[]),
      ]);
      setPrefs(preferences);
      setDraft(preferences);
      setRows(integrations);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(errorKindOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
  const info = rows.find((r) => r.id === infoId) ?? null;

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
      <DemoDisclosure />

      {loading ? <PageSkeleton rows={6} /> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? <ErrorState compact kind={error} onRetry={() => void load()} /> : null}

      {!loading && !unavailable && draft ? (
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
                    <button
                      key={i.id}
                      type="button"
                      className="oma-integration-card"
                      onClick={() => setInfoId(i.id)}
                    >
                      <strong>{pickCopy(i.name, locale)}</strong>
                      <span className="oma-ws-badge oma-ws-badge--ghost">{i.category}</span>
                      <p>{pickCopy(i.purpose, locale)}</p>
                    </button>
                  ))}
                </div>
                {info ? (
                  <div className="oma-ws-slack-card" style={{ marginTop: 16 }}>
                    <div>
                      <strong>{pickCopy(info.name, locale)}</strong>
                      <p>{pickCopy(info.laterUnlocks, locale)}</p>
                      <p className="oma-muted">{pickCopy(info.gate, locale)}</p>
                    </div>
                    <Button type="default" onClick={() => setInfoId(null)}>
                      Close
                    </Button>
                  </div>
                ) : null}
              </section>
            )}

            {section === 'demo' && (
              <section>
                <h2 className="oma-ws-section-title">{t('demo.settings.section.demo')}</h2>
                <p className="oma-ws-empty-desc">
                  Demo graph and disclosure settings remain available for certification scenarios.
                </p>
                <Button type="default" onClick={() => void load()}>
                  Reload demo data
                </Button>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
