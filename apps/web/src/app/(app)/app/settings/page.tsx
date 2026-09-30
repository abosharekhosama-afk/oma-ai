'use client';
import { Button, CheckboxField, Input, SelectField } from '@oma/ui/controls';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoGraph, DemoPreferences } from '@oma/demo';
import { DemoDisclosure } from '../../../../components/demo/demo-disclosure';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusChip } from '../../../../components/ui/status-chip';
import { useToast } from '../../../../components/ui/toast';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
  pickCopy,
} from '../../../../lib/demo/use-demo-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import { AiStatusNote } from '../../../../components/ai/ai-status-note';

type Integration = DemoGraph['integrations'][number];
type Section = 'general' | 'workflow' | 'notifications' | 'integrations' | 'localization' | 'demo';

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
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [preferences, integrations] = await Promise.all([
        demoApi<DemoPreferences>('/preferences'),
        demoApi<Integration[]>('/integrations'),
      ]);
      setPrefs(preferences);
      setDraft(preferences);
      setRows(integrations);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (isDemoForbidden(err)) setUnavailable(true);
      else setError(demoErrorMessage(err, 'Demo unavailable'));
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
      const next = await demoApi<DemoPreferences>('/preferences', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setPrefs(next);
      setDraft(next);
      toast.push(t('demo.settings.saved'), 'success');
    } catch (err) {
      toast.push(demoErrorMessage(err, 'Demo unavailable'), 'danger');
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
  const sections: Section[] = [
    'general',
    'workflow',
    'notifications',
    'integrations',
    'localization',
    'demo',
  ];

  return (
    <div className="oma-stack" data-testid="demo-settings">
      <PageHeader title={t('demo.settings.title')} description={t('demo.settings.subtitle')} />
      <AiStatusNote />
      <DemoDisclosure />

      {loading ? <p className="oma-muted">{t('demo.loading')}</p> : null}
      {unavailable ? <p className="oma-muted">{t('demo.unavailable')}</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}

      {!loading && !unavailable && draft ? (
        <div className="oma-settings-layout">
          <nav className="oma-settings-nav" aria-label={t('demo.settings.title')}>
            {sections.map((s) => (
              <Button
                key={s}
                type="default"
                aria-current={section === s ? 'true' : undefined}
                data-testid={`demo-settings-nav-${s}`}
                onClick={() => setSection(s)}
              >
                {t(`demo.settings.section.${s}`)}
              </Button>
            ))}
            <Link
              href="/app/company/members"
              className="oma-text-link"
              data-testid="demo-settings-members-link"
            >
              {t('demo.settings.companyLink')}
            </Link>
          </nav>

          <div className="oma-stack">
            {section === 'general' || section === 'localization' || section === 'workflow' ? (
              <section className="oma-settings-panel" data-testid="demo-settings-general">
                <h2>{t(`demo.settings.section.${section}`)}</h2>
                <p className="oma-muted">{t('demo.settings.demoPrefNote')}</p>
                {dirty ? (
                  <p className="oma-settings-dirty" data-testid="demo-settings-dirty" role="status">
                    {t('demo.settings.dirty')}
                  </p>
                ) : null}
                <label>
                  {t('demo.settings.timezone')}
                  <Input
                    value={draft.timezone}
                    data-testid="demo-settings-timezone"
                    onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  />
                </label>
                <label>
                  {t('demo.settings.weekStart')}
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
                </label>
                <label>
                  {t('demo.settings.localePref')}
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
                </label>
                <label>
                  {t('demo.settings.defaultContentView')}
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
                  </SelectField>
                </label>
                <label>
                  {t('demo.settings.defaultTaskView')}
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
                </label>
                <p className="oma-muted">{t('demo.settings.reducedMotionNote')}</p>
                <div className="oma-chip-row">
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
            ) : null}

            {section === 'notifications' ? (
              <section className="oma-settings-panel" data-testid="demo-settings-notifications">
                <h2>{t('demo.settings.section.notifications')}</h2>
                <label>
                  <CheckboxField
                    checked={draft.reviewReminders}
                    data-testid="demo-settings-review-reminders"
                    onChange={(e) => setDraft({ ...draft, reviewReminders: e.target.checked })}
                  />{' '}
                  {t('demo.settings.reviewReminders')}
                </label>
                <p className="oma-muted">{t('demo.settings.notificationsHonesty')}</p>
                <Button
                  type="primary"
                  data-testid="demo-settings-save-notifications"
                  disabled={!dirty || saving}
                  onClick={() => void savePrefs()}
                >
                  {t('demo.settings.save')}
                </Button>
              </section>
            ) : null}

            {section === 'integrations' || section === 'demo' ? (
              <section className="oma-settings-panel" data-testid="demo-integrations">
                <h2>{t('demo.settings.integrations')}</h2>
                <p className="oma-muted">{t('demo.integrationsDeferred')}</p>
                <div className="oma-integration-toolbar" data-testid="demo-integrations-filters">
                  <label className="oma-stage6-search">
                    {t('demo.settings.integrationsSearch')}
                    <Input
                      value={intQ}
                      data-testid="demo-integrations-search"
                      onChange={(e) => setIntQ(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('demo.settings.integrationsCategory')}
                    <SelectField
                      value={intCategory}
                      data-testid="demo-integrations-category"
                      onChange={(e) => setIntCategory(e.target.value)}
                    >
                      <option value="all">{t('demo.filter.all')}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                </div>
                <ul className="oma-integration-list">
                  {filteredIntegrations.map((i) => (
                    <li key={i.id} className="oma-integration-row" data-testid={`demo-int-${i.id}`}>
                      <div className="oma-chip-row">
                        <strong>{pickCopy(i.name, locale)}</strong>
                        <StatusChip status={i.status} />
                      </div>
                      <p className="oma-muted">{i.category}</p>
                      <p>{pickCopy(i.purpose, locale)}</p>
                      <p className="oma-muted">{pickCopy(i.availableWithout, locale)}</p>
                      <p className="oma-muted">{pickCopy(i.gate, locale)}</p>
                      <Button
                        type="default"
                        data-testid={`demo-int-plan-${i.id}`}
                        onClick={() => setInfoId(i.id)}
                      >
                        {t('demo.settings.viewPlan')}
                      </Button>
                    </li>
                  ))}
                </ul>
                {info ? (
                  <div className="oma-settings-panel" data-testid="demo-int-plan-drawer">
                    <h3>{pickCopy(info.name, locale)}</h3>
                    <p>{pickCopy(info.laterUnlocks, locale)}</p>
                    <p className="oma-honesty-inline">{t('demo.settings.noConnect')}</p>
                    <Button type="default" onClick={() => setInfoId(null)}>
                      {t('demo.create.cancel')}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
