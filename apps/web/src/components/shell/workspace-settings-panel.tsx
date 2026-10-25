'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, SelectField } from '@oma/ui/controls';
import { useLocale, useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import { getPreferences, updatePreferences, type UserPreferences } from '../../lib/account-api';
import { ShellIcon } from './shell-icons';
import type { NavIconId } from './nav-config';
import {
  createLabel,
  createTemplate,
  deleteLabel,
  deleteTemplate,
  listBrands,
  listLabels,
  listTemplates,
  DEFAULT_APPROVALS,
  approvalsFromSettings,
  getWorkspaceSettings,
  patchWorkspaceSettings,
  loadTimeSlots,
  saveApprovalSettings,
  saveTimeSlots,
  type ApprovalSettings,
  type ContentLabel,
  type ContentTemplate,
  type TimeSlot,
} from '../../lib/workspace-extras-api';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
  email?: string;
  name?: string;
};

type SettingsSection =
  'general' | 'brand' | 'team' | 'approvals' | 'templates' | 'labels' | 'timetable';

type PrefsDraft = {
  timezone?: string;
  weekStart?: string;
  localePreference?: string;
  workspaceName?: string;
  websiteUrl?: string;
  createInternal?: boolean;
  hideEmails?: boolean;
  autoCrop?: boolean;
};

type Props = { open: boolean; onClose: () => void };

const NAV: Array<{
  id: SettingsSection;
  label: string;
  group: 'workspace' | 'content';
  icon: NavIconId;
}> = [
  { id: 'general', label: 'wsPanel.nav.general', group: 'workspace', icon: 'settings' },
  { id: 'brand', label: 'wsPanel.nav.brand', group: 'workspace', icon: 'brand' },
  { id: 'team', label: 'wsPanel.nav.team', group: 'workspace', icon: 'team' },
  { id: 'approvals', label: 'wsPanel.nav.approvals', group: 'workspace', icon: 'reviews' },
  { id: 'templates', label: 'wsPanel.nav.templates', group: 'content', icon: 'content' },
  { id: 'labels', label: 'wsPanel.nav.labels', group: 'content', icon: 'campaigns' },
  { id: 'timetable', label: 'wsPanel.nav.timetable', group: 'content', icon: 'schedule' },
];

export function WorkspaceSettingsPanel({ open, onClose }: Props) {
  const t = useT();
  const [section, setSection] = useState<SettingsSection>('general');
  const [draft, setDraft] = useState<PrefsDraft>({
    timezone: 'Asia/Jerusalem',
    weekStart: 'monday',
    autoCrop: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [labels, setLabels] = useState<ContentLabel[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [approvals, setApprovals] = useState<ApprovalSettings>(DEFAULT_APPROVALS);
  const [approvalsState, setApprovalsState] = useState<'loading' | 'ready' | 'error' | 'saving'>(
    'loading',
  );
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const isAr = useLocale().toLowerCase().startsWith('ar');
  const [labelModal, setLabelModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [slotModal, setSlotModal] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#c7d2fe');
  const [tplName, setTplName] = useState('');
  const [slotTime, setSlotTime] = useState('13:20');
  const [slotDay, setSlotDay] = useState('Thursday');
  const slotColor = '#fde68a';

  useEffect(() => {
    if (!open) return;
    api<Me>('/api/v1/auth/me')
      .then((data) => {
        const active = data.memberships.find((m) => m.tenant_id === data.active_tenant_id);
        setDraft((d) => ({
          ...d,
          workspaceName: active?.tenant_name || data.memberships[0]?.tenant_name || '',
        }));
      })
      .catch(() => undefined);
    getPreferences()
      .then((prefs) => {
        setDraft((d) => ({
          ...d,
          weekStart: String(prefs.weekStart ?? d.weekStart),
          localePreference: String(prefs.localePreference ?? 'system'),
        }));
      })
      .catch(() => undefined);
    setSlots(loadTimeSlots());
    setApprovalsState('loading');
    getWorkspaceSettings()
      .then((ws) => {
        setApprovals(approvalsFromSettings(ws));
        setDraft((d) => ({ ...d, timezone: ws.timezone, websiteUrl: ws.website_url ?? '' }));
        setApprovalsState('ready');
      })
      .catch((err: unknown) => {
        setApprovalsError(err instanceof Error ? err.message : String(err));
        setApprovalsState('error');
      });
    listBrands()
      .then((b) => {
        setBrands(b);
        if (b[0]) setBrandId(b[0].id);
      })
      .catch(() => setBrands([]));
  }, [open]);

  useEffect(() => {
    if (!open || !brandId) return;
    void listLabels(brandId)
      .then(setLabels)
      .catch(() => setLabels([]));
    void listTemplates(brandId)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open, brandId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const saveGeneral = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      const url = (draft.websiteUrl || '').trim();
      await patchWorkspaceSettings({
        timezone: draft.timezone,
        website_url: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null,
      });
      await updatePreferences({
        weekStart: draft.weekStart as UserPreferences['weekStart'],
        localePreference: draft.localePreference as UserPreferences['localePreference'],
      });
      setMsg(t('demo.settings.saved') || 'Saved');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('errors.page.generic.title'));
    } finally {
      setSaving(false);
    }
  }, [draft, t]);

  if (!open) return null;

  return (
    <div className="oma-ws-overlay" role="presentation" onClick={onClose}>
      <div
        className="oma-ws-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.workspaceSettings')}
        onClick={(e) => e.stopPropagation()}
        data-testid="workspace-settings-panel"
      >
        <aside className="oma-ws-panel-nav">
          <p className="oma-ws-panel-nav-group">{t('nav.section.workspace')}</p>
          {NAV.filter((n) => n.group === 'workspace').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{t(item.label)}</span>
            </button>
          ))}
          <p className="oma-ws-panel-nav-group">{t('demo.campaigns.col.content')}</p>
          {NAV.filter((n) => n.group === 'content').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{t(item.label)}</span>
            </button>
          ))}
        </aside>

        <div className="oma-ws-panel-main">
          <button type="button" className="oma-ws-panel-close" aria-label={t('brand.evidence.close')} onClick={onClose}>
            ×
          </button>

          {section === 'general' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.general_settings')}</h2>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('wsPanel.workspace_name')}</label>
                <Input
                  value={draft.workspaceName || ''}
                  readOnly
                  disabled
                />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('brand.connect.urlLabel')}</label>
                <Input
                  value={draft.websiteUrl || ''}
                  onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })}
                  placeholder={t('wsPanel.website_placeholder')}
                />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('wsPanel.workspace_timezone')}</label>
                <SelectField
                  value={draft.timezone || 'Asia/Jerusalem'}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                >
                  <option value="Asia/Jerusalem">{t('wsPanel.jerusalem_asia_utc_3')}</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">{t('wsPanel.new_york')}</option>
                  <option value="Europe/London">{t('wsPanel.london')}</option>
                  <option value="Asia/Riyadh">{t('wsPanel.riyadh')}</option>
                </SelectField>
              </div>
              <div className="oma-ws-section-actions">
                <Button type="primary" onClick={() => void saveGeneral()} disabled={saving}>
                  {saving ? t('demo.content.saving') : t('account.save')}
                </Button>
                {msg ? <span className="oma-ws-save-msg">{msg}</span> : null}
              </div>
            </div>
          )}

          {section === 'brand' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.brand_context')}</h2>
              <p className="oma-ws-empty-desc">{t('wsPanel.open_brand_intelligence_for_voice')}</p>
              <Button type="primary" onClick={() => (window.location.href = '/app/brands')}>
                <ShellIcon name="brand" size={16} />
                <span>{t('wsPanel.open_brands')}</span>
              </Button>
            </div>
          )}

          {section === 'team' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.team_clients')}</h2>
              <p className="oma-ws-empty-desc">
                {t('wsPanel.manage_members_teamclient_membership_and')}
              </p>
              <div className="oma-ws-action-row">
                <Button type="primary" onClick={() => (window.location.href = '/app/team')}>
                  <ShellIcon name="team" size={16} />
                  <span>{t('wsPanel.open_team')}</span>
                </Button>
                <Button
                  type="default"
                  onClick={() => (window.location.href = '/app/company/members')}
                >
                  {t('wsPanel.company_collaborators')}
                </Button>
              </div>
            </div>
          )}

          {section === 'approvals' && (
            <div className="oma-ws-section" data-testid="ws-approvals">
              <h2 className="oma-ws-section-title">{t('activity.filter.approvals')}</h2>
              <p className="oma-ws-empty-desc">
                {t('wsPanel.choose_how_posts_are_approved')}
              </p>
              {approvalsState === 'loading' ? (
                <div className="oma-skeleton" style={{ height: 120 }} aria-busy="true" />
              ) : approvalsState === 'error' ? (
                <p className="oma-ws-save-msg" role="alert" data-testid="ws-approvals-error">
                  {t('wsPanel.could_not_load_approval_settings')}{' '}
                  {approvalsError}
                </p>
              ) : (
                <>
                  <div className="oma-ws-field">
                    <label className="oma-ws-label">{t('demo.content.policy')}</label>
                    <SelectField
                      data-testid="ws-approval-mode"
                      value={approvals.mode}
                      onChange={(e) =>
                        setApprovals({ ...approvals, mode: e.target.value as ApprovalSettings['mode'] })
                      }
                    >
                      <option value="none">
                        {t('wsPanel.none_no_approval_step')}
                      </option>
                      <option value="optional">
                        {t('wsPanel.optional_approval_available')}
                      </option>
                      <option value="required">
                        {t('wsPanel.required_no_scheduling_until_approved')}
                      </option>
                    </SelectField>
                  </div>
                  {approvals.mode === 'required' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">
                        {t('wsPanel.approvers_required')}
                      </label>
                      <SelectField
                        data-testid="ws-required-approvers"
                        value={String(approvals.requiredApprovers)}
                        onChange={(e) =>
                          setApprovals({ ...approvals, requiredApprovers: Number(e.target.value) })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </SelectField>
                      <p className="oma-ws-empty-desc">
                        {t('wsPanel.each_approval_must_come_from')}
                      </p>
                    </div>
                  ) : null}
                  <div className="oma-ws-action-row">
                    <Button
                      type="primary"
                      loading={approvalsState === 'saving'}
                      data-testid="ws-approvals-save"
                      onClick={() => {
                        setApprovalsState('saving');
                        saveApprovalSettings(approvals)
                          .then((next) => {
                            setApprovals(next);
                            setApprovalsState('ready');
                            setMsg(t('wsPanel.approval_settings_saved'));
                          })
                          .catch((err: unknown) => {
                            setApprovalsState('ready');
                            setMsg(
                              (t('wsPanel.could_not_save')) +
                                (err instanceof Error ? err.message : String(err)),
                            );
                          });
                      }}
                    >
                      {t('wsPanel.save_approval_settings')}
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/reviews')}>
                      {t('wsPanel.open_reviews')}
                    </Button>
                  </div>
                </>
              )}
              {msg ? <p className="oma-ws-save-msg">{msg}</p> : null}
            </div>
          )}

          {section === 'labels' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.labels')}</h2>
              {brands.length > 0 ? (
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('shell.brand')}</label>
                  <SelectField value={brandId || ''} onChange={(e) => setBrandId(e.target.value)}>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : (
                <p className="oma-ws-empty-desc">
                  {t('wsPanel.no_brands_yet_create_a')}
                </p>
              )}
              {labels.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>{t('wsPanel.create_labels')}</h3>
                  <p>{t('wsPanel.labels_organize_posts_around_campaigns')}</p>
                  <Button type="primary" onClick={() => setLabelModal(true)} disabled={!brandId}>
                    {t('wsPanel.create_label')}
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="oma-ws-label-list">
                    {labels.map((l) => (
                      <li key={l.id} className="oma-ws-label-item">
                        <span className="oma-ws-swatch" style={{ background: l.color }} />
                        <span style={{ flex: 1 }}>{l.nameEn}</span>
                        <button
                          type="button"
                          className="oma-ws-danger-btn"
                          onClick={() => {
                            if (!brandId) return;
                            void deleteLabel(brandId, l.id).then(() =>
                              setLabels((prev) => prev.filter((x) => x.id !== l.id)),
                            );
                          }}
                        >
                          {t('wsPanel.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button type="primary" onClick={() => setLabelModal(true)}>
                    {t('wsPanel.create_label')}
                  </Button>
                </>
              )}
            </div>
          )}

          {section === 'templates' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.templates')}</h2>
              {brands.length > 0 ? (
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('shell.brand')}</label>
                  <SelectField value={brandId || ''} onChange={(e) => setBrandId(e.target.value)}>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              ) : null}
              {templates.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>{t('wsPanel.manage_workspace_templates')}</h3>
                  <p>{t('wsPanel.reusable_captions_and_snippets_for')}</p>
                  <Button type="primary" onClick={() => setTemplateModal(true)} disabled={!brandId}>
                    {t('wsPanel.create_new_template')}
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="oma-ws-label-list">
                    {templates.map((tpl) => (
                      <li key={tpl.id} className="oma-ws-label-item">
                        <span style={{ flex: 1 }}>
                          <strong>{tpl.nameEn}</strong>
                          {tpl.captionEn ? (
                            <div className="oma-muted" style={{ fontSize: 12 }}>
                              {tpl.captionEn.slice(0, 80)}
                            </div>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          className="oma-ws-danger-btn"
                          onClick={() => {
                            if (!brandId) return;
                            void deleteTemplate(brandId, tpl.id).then(() =>
                              setTemplates((prev) => prev.filter((x) => x.id !== tpl.id)),
                            );
                          }}
                        >
                          {t('wsPanel.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button type="primary" onClick={() => setTemplateModal(true)}>
                    {t('wsPanel.create_new_template')}
                  </Button>
                </>
              )}
            </div>
          )}

          {section === 'timetable' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">{t('wsPanel.timetable')}</h2>
              {slots.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>{t('wsPanel.add_preferred_time_slots')}</h3>
                  <p>{t('wsPanel.quickselect_times_when_scheduling_posts')}</p>
                  <Button type="primary" onClick={() => setSlotModal(true)}>
                    {t('wsPanel.create_a_slot')}
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="oma-ws-label-list">
                    {slots.map((s) => (
                      <li key={s.id} className="oma-ws-label-item">
                        <span className="oma-ws-swatch" style={{ background: s.color }} />
                        <span style={{ flex: 1 }}>
                          {s.day} · {s.time}
                        </span>
                        <button
                          type="button"
                          className="oma-ws-danger-btn"
                          onClick={() => {
                            const next = slots.filter((x) => x.id !== s.id);
                            setSlots(next);
                            saveTimeSlots(next);
                          }}
                        >
                          {t('wsPanel.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="oma-ws-action-row">
                    <Button type="primary" onClick={() => setSlotModal(true)}>
                      {t('wsPanel.create_a_slot')}
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/schedule')}>
                      {t('wsPanel.open_schedule')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {labelModal ? (
            <Modal title={t('wsPanel.new_label')} onClose={() => setLabelModal(false)}>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('auth.name')}</label>
                <Input value={labelName} onChange={(e) => setLabelName(e.target.value)} />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('wsPanel.color')}</label>
                <div className="oma-ws-color-row">
                  {[
                    '#c7d2fe',
                    '#fbcfe8',
                    '#fed7aa',
                    '#fde68a',
                    '#a7f3d0',
                    '#a5f3fc',
                    '#e5e7eb',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`oma-ws-swatch${labelColor === c ? ' is-selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setLabelColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="oma-ws-modal-actions">
                <Button type="default" onClick={() => setLabelModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    if (!brandId || !labelName.trim()) return;
                    void createLabel(brandId, {
                      nameEn: labelName.trim(),
                      color: labelColor,
                    }).then((row) => {
                      setLabels((prev) => [...prev, row]);
                      setLabelName('');
                      setLabelModal(false);
                    });
                  }}
                >
                  {t('wsPanel.add_label')}
                </Button>
              </div>
            </Modal>
          ) : null}

          {templateModal ? (
            <Modal title={t('wsPanel.new_template')} onClose={() => setTemplateModal(false)}>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('auth.name')}</label>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
              </div>
              <div className="oma-ws-modal-actions">
                <Button type="default" onClick={() => setTemplateModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    if (!brandId || !tplName.trim()) return;
                    void createTemplate(brandId, { nameEn: tplName.trim() }).then((row) => {
                      setTemplates((prev) => [...prev, row]);
                      setTplName('');
                      setTemplateModal(false);
                    });
                  }}
                >
                  {t('wsPanel.save_template')}
                </Button>
              </div>
            </Modal>
          ) : null}

          {slotModal ? (
            <Modal title={t('wsPanel.create_time_slot')} onClose={() => setSlotModal(false)}>
              <div className="oma-ws-slot-row">
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('wsPanel.time')}</label>
                  <Input value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                </div>
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('wsPanel.day')}</label>
                  <SelectField value={slotDay} onChange={(e) => setSlotDay(e.target.value)}>
                    {[
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                      'Sunday',
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
              <div className="oma-ws-modal-actions">
                <Button type="default" onClick={() => setSlotModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    const next = [
                      ...slots,
                      {
                        id: `slot-${Date.now()}`,
                        time: slotTime,
                        day: slotDay,
                        color: slotColor,
                      },
                    ];
                    setSlots(next);
                    saveTimeSlots(next);
                    setSlotModal(false);
                  }}
                >
                  {t('shell.create')}
                </Button>
              </div>
            </Modal>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="oma-ws-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`oma-ws-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="oma-ws-switch-knob" />
      </button>
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="oma-ws-modal" role="dialog">
      <div className="oma-ws-modal-card">
        <div className="oma-ws-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('brand.evidence.close')}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
