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
  { id: 'general', label: 'General settings', group: 'workspace', icon: 'settings' },
  { id: 'brand', label: 'Brand context', group: 'workspace', icon: 'brand' },
  { id: 'team', label: 'Team & clients', group: 'workspace', icon: 'team' },
  { id: 'approvals', label: 'Approvals', group: 'workspace', icon: 'reviews' },
  { id: 'templates', label: 'Templates', group: 'content', icon: 'content' },
  { id: 'labels', label: 'Labels', group: 'content', icon: 'campaigns' },
  { id: 'timetable', label: 'Timetable', group: 'content', icon: 'schedule' },
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
          workspaceName: active?.tenant_name || data.memberships[0]?.tenant_name || 'Workspace',
        }));
      })
      .catch(() => undefined);
    getPreferences()
      .then((prefs) => {
        setDraft((d) => ({
          ...d,
          timezone: String(prefs.timezone ?? d.timezone),
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
      await updatePreferences({
        timezone: draft.timezone,
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
        aria-label="Workspace settings"
        onClick={(e) => e.stopPropagation()}
        data-testid="workspace-settings-panel"
      >
        <aside className="oma-ws-panel-nav">
          <p className="oma-ws-panel-nav-group">Workspace</p>
          {NAV.filter((n) => n.group === 'workspace').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
          <p className="oma-ws-panel-nav-group">Content</p>
          {NAV.filter((n) => n.group === 'content').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <ShellIcon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <div className="oma-ws-panel-main">
          <button type="button" className="oma-ws-panel-close" aria-label="Close" onClick={onClose}>
            ×
          </button>

          {section === 'general' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">General settings</h2>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Workspace name</label>
                <Input
                  value={draft.workspaceName || ''}
                  onChange={(e) => setDraft({ ...draft, workspaceName: e.target.value })}
                />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Website URL</label>
                <Input
                  value={draft.websiteUrl || ''}
                  onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })}
                  placeholder="e.g. planable.io"
                />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Workspace timezone</label>
                <SelectField
                  value={draft.timezone || 'Asia/Jerusalem'}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                >
                  <option value="Asia/Jerusalem">Jerusalem, Asia (UTC +3)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Riyadh">Riyadh</option>
                </SelectField>
              </div>
              <div className="oma-ws-toggles">
                <Toggle
                  label="Create new posts as internal"
                  checked={Boolean(draft.createInternal)}
                  onChange={(v) => setDraft({ ...draft, createInternal: v })}
                />
                <Toggle
                  label="Hide emails from clients"
                  checked={Boolean(draft.hideEmails)}
                  onChange={(v) => setDraft({ ...draft, hideEmails: v })}
                />
                <Toggle
                  label="Auto-crop images"
                  checked={draft.autoCrop !== false}
                  onChange={(v) => setDraft({ ...draft, autoCrop: v })}
                />
              </div>
              <div className="oma-ws-section-actions">
                <Button type="primary" onClick={() => void saveGeneral()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                {msg ? <span className="oma-ws-save-msg">{msg}</span> : null}
              </div>
            </div>
          )}

          {section === 'brand' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Brand context</h2>
              <p className="oma-ws-empty-desc">Open brand intelligence for voice and guidelines.</p>
              <Button type="primary" onClick={() => (window.location.href = '/app/brands')}>
                <ShellIcon name="brand" size={16} />
                <span>Open brands</span>
              </Button>
            </div>
          )}

          {section === 'team' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Team & clients</h2>
              <p className="oma-ws-empty-desc">
                Manage members, Team/Client membership, and the permissions grid.
              </p>
              <div className="oma-ws-action-row">
                <Button type="primary" onClick={() => (window.location.href = '/app/team')}>
                  <ShellIcon name="team" size={16} />
                  <span>Open Team</span>
                </Button>
                <Button
                  type="default"
                  onClick={() => (window.location.href = '/app/company/members')}
                >
                  Company collaborators
                </Button>
              </div>
            </div>
          )}

          {section === 'approvals' && (
            <div className="oma-ws-section" data-testid="ws-approvals">
              <h2 className="oma-ws-section-title">{isAr ? 'الموافقات' : 'Approvals'}</h2>
              <p className="oma-ws-empty-desc">
                {isAr
                  ? 'اختر كيف تُعتمد المنشورات قبل الجدولة. يُحفظ الإعداد على الخادم لكل مساحة العمل.'
                  : 'Choose how posts are approved before they can be scheduled. Saved for the whole workspace.'}
              </p>
              {approvalsState === 'loading' ? (
                <div className="oma-skeleton" style={{ height: 120 }} aria-busy="true" />
              ) : approvalsState === 'error' ? (
                <p className="oma-ws-save-msg" role="alert" data-testid="ws-approvals-error">
                  {isAr ? 'تعذّر تحميل إعدادات الموافقة.' : 'Could not load approval settings.'}{' '}
                  {approvalsError}
                </p>
              ) : (
                <>
                  <div className="oma-ws-field">
                    <label className="oma-ws-label">{isAr ? 'سياسة الاعتماد' : 'Approval policy'}</label>
                    <SelectField
                      data-testid="ws-approval-mode"
                      value={approvals.mode}
                      onChange={(e) =>
                        setApprovals({ ...approvals, mode: e.target.value as ApprovalSettings['mode'] })
                      }
                    >
                      <option value="none">
                        {isAr ? 'بدون — لا حاجة للاعتماد' : 'None — no approval step'}
                      </option>
                      <option value="optional">
                        {isAr ? 'اختياري — يمكن طلب الاعتماد' : 'Optional — approval available'}
                      </option>
                      <option value="required">
                        {isAr
                          ? 'إلزامي — لا جدولة قبل اكتمال الاعتماد'
                          : 'Required — no scheduling until approved'}
                      </option>
                    </SelectField>
                  </div>
                  {approvals.mode === 'required' ? (
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">
                        {isAr ? 'عدد المعتمِدين المطلوب' : 'Approvers required'}
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
                        {isAr
                          ? 'يجب أن يعتمد المنشور أشخاص مختلفون، مثل «١ من ٢ معتمد».'
                          : 'Each approval must come from a different person, e.g. “1 of 2 approved”.'}
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
                            setMsg(isAr ? 'تم حفظ إعدادات الموافقة' : 'Approval settings saved');
                          })
                          .catch((err: unknown) => {
                            setApprovalsState('ready');
                            setMsg(
                              (isAr ? 'تعذّر الحفظ: ' : 'Could not save: ') +
                                (err instanceof Error ? err.message : String(err)),
                            );
                          });
                      }}
                    >
                      {isAr ? 'حفظ' : 'Save approval settings'}
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/reviews')}>
                      {isAr ? 'فتح المراجعات' : 'Open reviews'}
                    </Button>
                  </div>
                </>
              )}
              {msg ? <p className="oma-ws-save-msg">{msg}</p> : null}
            </div>
          )}

          {section === 'labels' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Labels</h2>
              {brands.length > 0 ? (
                <div className="oma-ws-field">
                  <label className="oma-ws-label">Brand</label>
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
                  No brands yet. Create a brand to store labels in the API.
                </p>
              )}
              {labels.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>Create labels</h3>
                  <p>Labels organize posts around campaigns and topics.</p>
                  <Button type="primary" onClick={() => setLabelModal(true)} disabled={!brandId}>
                    Create label
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
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button type="primary" onClick={() => setLabelModal(true)}>
                    Create label
                  </Button>
                </>
              )}
            </div>
          )}

          {section === 'templates' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Templates</h2>
              {brands.length > 0 ? (
                <div className="oma-ws-field">
                  <label className="oma-ws-label">Brand</label>
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
                  <h3>Manage workspace templates</h3>
                  <p>Reusable captions and snippets for faster content creation.</p>
                  <Button type="primary" onClick={() => setTemplateModal(true)} disabled={!brandId}>
                    Create new template
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
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button type="primary" onClick={() => setTemplateModal(true)}>
                    Create new template
                  </Button>
                </>
              )}
            </div>
          )}

          {section === 'timetable' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Timetable</h2>
              {slots.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>Add preferred time slots</h3>
                  <p>Quick-select times when scheduling posts.</p>
                  <Button type="primary" onClick={() => setSlotModal(true)}>
                    Create a slot
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
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="oma-ws-action-row">
                    <Button type="primary" onClick={() => setSlotModal(true)}>
                      Create a slot
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/schedule')}>
                      Open schedule
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {labelModal ? (
            <Modal title="New label" onClose={() => setLabelModal(false)}>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Name</label>
                <Input value={labelName} onChange={(e) => setLabelName(e.target.value)} />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Color</label>
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
                  Cancel
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
                  Add label
                </Button>
              </div>
            </Modal>
          ) : null}

          {templateModal ? (
            <Modal title="New template" onClose={() => setTemplateModal(false)}>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Name</label>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
              </div>
              <div className="oma-ws-modal-actions">
                <Button type="default" onClick={() => setTemplateModal(false)}>
                  Cancel
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
                  Save template
                </Button>
              </div>
            </Modal>
          ) : null}

          {slotModal ? (
            <Modal title="Create time slot" onClose={() => setSlotModal(false)}>
              <div className="oma-ws-slot-row">
                <div className="oma-ws-field">
                  <label className="oma-ws-label">Time</label>
                  <Input value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                </div>
                <div className="oma-ws-field">
                  <label className="oma-ws-label">Day</label>
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
                  Cancel
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
                  Create
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
  return (
    <div className="oma-ws-modal" role="dialog">
      <div className="oma-ws-modal-card">
        <div className="oma-ws-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
