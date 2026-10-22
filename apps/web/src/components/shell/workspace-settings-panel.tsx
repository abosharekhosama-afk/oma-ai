'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, SelectField } from '@oma/ui/controls';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import {
  demoApi,
  demoErrorMessage,
  isDemoForbidden,
} from '../../lib/demo/use-demo-api';
import { ShellIcon } from './shell-icons';
import type { NavIconId } from './nav-config';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
  email?: string;
  name?: string;
};

type SettingsSection =
  | 'general'
  | 'brand'
  | 'team'
  | 'approvals'
  | 'templates'
  | 'labels'
  | 'timetable';

type TeamTab = 'members' | 'permissions' | 'notifications';

type PrefsDraft = {
  timezone?: string;
  weekStart?: string;
  localePreference?: string;
  defaultContentView?: string;
  defaultTaskView?: string;
  workspaceName?: string;
  websiteUrl?: string;
  createInternal?: boolean;
  hideEmails?: boolean;
  autoCrop?: boolean;
};

type WorkspaceSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const WORKSPACE_NAV: Array<{
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

export function WorkspaceSettingsPanel({ open, onClose }: WorkspaceSettingsPanelProps) {
  const t = useT();
  const [section, setSection] = useState<SettingsSection>('general');
  const [teamTab, setTeamTab] = useState<TeamTab>('members');
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState<PrefsDraft>({
    timezone: 'Asia/Jerusalem',
    weekStart: 'monday',
    localePreference: 'system',
    autoCrop: true,
    createInternal: false,
    hideEmails: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [labelName, setLabelName] = useState('');
  const [labelModal, setLabelModal] = useState(false);
  const [slotModal, setSlotModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [labels, setLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [slots, setSlots] = useState<Array<{ id: string; time: string; day: string; color: string }>>(
    [],
  );
  const [slotTime, setSlotTime] = useState('13:20');
  const [slotDay, setSlotDay] = useState('Thursday');
  const [slotColor, setSlotColor] = useState('#fde68a');
  const [labelColor, setLabelColor] = useState('#c7d2fe');

  useEffect(() => {
    if (!open) return;
    api<Me>('/api/v1/auth/me')
      .then((data) => {
        setMe(data);
        const active = data.memberships.find((m) => m.tenant_id === data.active_tenant_id);
        setDraft((d) => ({
          ...d,
          workspaceName: active?.tenant_name || data.memberships[0]?.tenant_name || 'Workspace',
        }));
      })
      .catch(() => setMe(null));

    // Load existing demo preferences when available (same source as /app/settings)
    demoApi<Record<string, unknown>>('/preferences')
      .then((prefs) => {
        setDraft((d) => ({
          ...d,
          timezone: String(prefs.timezone ?? d.timezone ?? 'Asia/Jerusalem'),
          weekStart: String(prefs.weekStart ?? d.weekStart ?? 'monday'),
          localePreference: String(prefs.localePreference ?? d.localePreference ?? 'system'),
          defaultContentView: String(prefs.defaultContentView ?? d.defaultContentView ?? ''),
          defaultTaskView: String(prefs.defaultTaskView ?? d.defaultTaskView ?? ''),
        }));
      })
      .catch(() => {
        /* demo may be unavailable — keep local defaults */
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const saveGeneral = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await demoApi('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          timezone: draft.timezone,
          weekStart: draft.weekStart,
          localePreference: draft.localePreference,
          defaultContentView: draft.defaultContentView,
          defaultTaskView: draft.defaultTaskView,
        }),
      });
      setSaveMsg(t('demo.settings.saved') || 'Saved');
    } catch (err) {
      if (isDemoForbidden(err)) {
        setSaveMsg('Demo unavailable');
      } else {
        setSaveMsg(demoErrorMessage(err, 'Could not save'));
      }
    } finally {
      setSaving(false);
    }
  }, [draft, t]);

  if (!open) return null;

  const userLabel = me?.name || me?.email || 'You';
  const userEmail = me?.email || '';

  return (
    <div className="oma-ws-overlay" role="presentation" onClick={onClose}>
      <div
        className="oma-ws-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.workspaceSettings') || 'Workspace settings'}
        onClick={(e) => e.stopPropagation()}
        data-testid="workspace-settings-panel"
      >
        <aside className="oma-ws-panel-nav">
          <p className="oma-ws-panel-nav-group">Workspace</p>
          {WORKSPACE_NAV.filter((n) => n.group === 'workspace').map((item) => (
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
          {WORKSPACE_NAV.filter((n) => n.group === 'content').map((item) => (
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
                  <option value="America/New_York">New York (UTC -5)</option>
                  <option value="Europe/London">London (UTC +0)</option>
                  <option value="Asia/Riyadh">Riyadh (UTC +3)</option>
                </SelectField>
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('demo.settings.weekStart') || 'Week starts on'}</label>
                <SelectField
                  value={draft.weekStart || 'monday'}
                  onChange={(e) => setDraft({ ...draft, weekStart: e.target.value })}
                >
                  <option value="monday">{t('demo.settings.monday') || 'Monday'}</option>
                  <option value="sunday">{t('demo.settings.sunday') || 'Sunday'}</option>
                </SelectField>
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('demo.settings.localePref') || 'Locale'}</label>
                <SelectField
                  value={draft.localePreference || 'system'}
                  onChange={(e) => setDraft({ ...draft, localePreference: e.target.value })}
                >
                  <option value="system">system</option>
                  <option value="en">en</option>
                  <option value="ar">ar</option>
                </SelectField>
              </div>

              <div className="oma-ws-toggles">
                <ToggleRow
                  label="Create new posts as internal"
                  checked={Boolean(draft.createInternal)}
                  onChange={(v) => setDraft({ ...draft, createInternal: v })}
                />
                <ToggleRow
                  label="Hide emails from clients"
                  checked={Boolean(draft.hideEmails)}
                  onChange={(v) => setDraft({ ...draft, hideEmails: v })}
                />
                <ToggleRow
                  label="Auto-crop images"
                  checked={draft.autoCrop !== false}
                  onChange={(v) => setDraft({ ...draft, autoCrop: v })}
                />
              </div>

              <div className="oma-ws-danger">
                <h3 className="oma-ws-danger-title">Delete workspace</h3>
                <p className="oma-ws-danger-desc">
                  Permanently deletes this workspace and all its data. This cannot be undone.
                </p>
                <button type="button" className="oma-ws-danger-btn">
                  Delete this workspace
                </button>
              </div>

              <div className="oma-ws-section-actions">
                <Button type="primary" onClick={() => void saveGeneral()} disabled={saving}>
                  {saving ? 'Saving…' : t('common.save') || 'Save changes'}
                </Button>
                {saveMsg ? <span className="oma-ws-save-msg">{saveMsg}</span> : null}
              </div>
            </div>
          )}

          {section === 'brand' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Brand context</h2>
              <p className="oma-ws-empty-desc">
                Manage brand voice, guidelines, and intelligence from the brand workspace — same
                flows as the existing Brands area.
              </p>
              <div className="oma-ws-action-row">
                <Button type="primary" onClick={() => (window.location.href = '/app/brands')}>
                  <ShellIcon name="brand" size={16} />
                  <span>Open brands</span>
                </Button>
                <Button type="default" onClick={() => (window.location.href = '/app/brands/new')}>
                  <ShellIcon name="plus" size={16} />
                  <span>New brand</span>
                </Button>
              </div>
            </div>
          )}

          {section === 'team' && (
            <div className="oma-ws-section oma-ws-section--team">
              <div className="oma-ws-team-header">
                <h2 className="oma-ws-section-title">Team & clients</h2>
                <Button type="primary" onClick={() => (window.location.href = '/app/team')}>
                  <ShellIcon name="plus" size={14} />
                  <span>Invite members</span>
                </Button>
              </div>
              <div className="oma-ws-tabs">
                {(
                  [
                    ['members', 'Members'],
                    ['permissions', 'Permissions'],
                    ['notifications', 'Notifications'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`oma-ws-tab${teamTab === id ? ' is-active' : ''}`}
                    onClick={() => setTeamTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {teamTab === 'members' && (
                <>
                  <table className="oma-ws-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Membership</th>
                        <th>Role</th>
                        <th>Last online</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="oma-ws-user-cell">
                            <span className="oma-ws-avatar oma-ws-avatar--sm">
                              {(userLabel[0] || 'U').toUpperCase()}
                            </span>
                            <div>
                              <div className="oma-ws-user-name">
                                {userLabel} <span className="oma-muted">(you)</span>
                              </div>
                              {userEmail ? (
                                <div className="oma-ws-user-email">{userEmail}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="oma-ws-badge">Team</span>
                        </td>
                        <td>
                          <span className="oma-ws-badge oma-ws-badge--ghost">Company Owner</span>
                        </td>
                        <td>Online</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="oma-ws-section-actions">
                    <Button type="default" onClick={() => (window.location.href = '/app/company/members')}>
                      <ShellIcon name="company" size={14} />
                      <span>Full company members</span>
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/team')}>
                      <ShellIcon name="team" size={14} />
                      <span>Open team page</span>
                    </Button>
                  </div>
                </>
              )}

              {teamTab === 'permissions' && (
                <div>
                  <h3 className="oma-ws-subhead">Adjust permissions</h3>
                  <p className="oma-ws-empty-desc">
                    Set up who can edit, approve, publish, analyze, engage, and administer the
                    workspace. Full role management lives in Company members.
                  </p>
                  <table className="oma-ws-table oma-ws-table--perms">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>View</th>
                        <th>Approve</th>
                        <th>Edit</th>
                        <th>Publish</th>
                        <th>Analyze</th>
                        <th>Engage</th>
                        <th>Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="oma-ws-user-cell">
                            <span className="oma-ws-avatar oma-ws-avatar--sm">
                              {(userLabel[0] || 'U').toUpperCase()}
                            </span>
                            <div>
                              <div className="oma-ws-user-name">{userLabel} (you)</div>
                              <div className="oma-muted">Team</div>
                            </div>
                          </div>
                        </td>
                        {['view', 'approve', 'edit', 'publish', 'analyze', 'engage', 'admin'].map(
                          (p) => (
                            <td key={p} className="oma-ws-check-cell">
                              <input type="checkbox" defaultChecked={p !== 'view'} readOnly />
                            </td>
                          ),
                        )}
                      </tr>
                    </tbody>
                  </table>
                  <div className="oma-ws-section-actions">
                    <Button
                      type="default"
                      onClick={() => (window.location.href = '/app/company/members')}
                    >
                      Manage roles
                    </Button>
                  </div>
                </div>
              )}

              {teamTab === 'notifications' && (
                <div>
                  <h3 className="oma-ws-subhead">Manage notifications</h3>
                  <p className="oma-ws-empty-desc">
                    Adjust who receives email, browser, or Slack notifications. Detailed
                    notification preferences are also available in Settings.
                  </p>
                  <table className="oma-ws-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Posts updates</th>
                        <th>Approvals</th>
                        <th>Your posts</th>
                        <th>Other posts</th>
                        <th>Social inbox</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="oma-ws-user-cell">
                            <span className="oma-ws-avatar oma-ws-avatar--sm">
                              {(userLabel[0] || 'U').toUpperCase()}
                            </span>
                            <div>
                              <div className="oma-ws-user-name">{userLabel} (you)</div>
                              <div className="oma-muted">Team</div>
                            </div>
                          </div>
                        </td>
                        <td className="oma-ws-check-cell">
                          <input type="checkbox" />
                        </td>
                        <td className="oma-ws-check-cell">
                          <input type="checkbox" defaultChecked />
                        </td>
                        <td className="oma-ws-check-cell">
                          <input type="checkbox" defaultChecked />
                        </td>
                        <td className="oma-ws-check-cell">
                          <input type="checkbox" defaultChecked />
                        </td>
                        <td className="oma-ws-check-cell">
                          <input type="checkbox" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="oma-ws-slack-card">
                    <div>
                      <strong>Connect your Slack</strong>
                      <p>
                        Connect Slack to receive notifications for comments, suggestions, approval
                        requests, or brand mentions.
                      </p>
                    </div>
                    <Button type="default" onClick={() => (window.location.href = '/app/settings')}>
                      Open integrations
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'approvals' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Approvals</h2>
              <p className="oma-ws-empty-desc">
                Review and approve content using the existing Reviews workflow.
              </p>
              <div className="oma-ws-action-row">
                <Button type="primary" onClick={() => (window.location.href = '/app/reviews')}>
                  <ShellIcon name="reviews" size={16} />
                  <span>Open reviews</span>
                </Button>
                <Button type="default" onClick={() => (window.location.href = '/app/content')}>
                  <ShellIcon name="content" size={16} />
                  <span>Content queue</span>
                </Button>
              </div>
            </div>
          )}

          {section === 'labels' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Labels</h2>
              {labels.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>Create labels</h3>
                  <p>Labels make it easy to organize posts around your campaigns.</p>
                  <Button type="primary" onClick={() => setLabelModal(true)}>
                    Create label
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="oma-ws-label-list">
                    {labels.map((l) => (
                      <li key={l.id} className="oma-ws-label-item">
                        <span className="oma-ws-swatch" style={{ background: l.color }} />
                        <span>{l.name}</span>
                      </li>
                    ))}
                  </ul>
                  <Button type="primary" onClick={() => setLabelModal(true)}>
                    Create label
                  </Button>
                </>
              )}
              {labelModal ? (
                <div className="oma-ws-modal" role="dialog">
                  <div className="oma-ws-modal-card">
                    <div className="oma-ws-modal-head">
                      <h3>New label</h3>
                      <button type="button" onClick={() => setLabelModal(false)} aria-label="Close">
                        ×
                      </button>
                    </div>
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">Name</label>
                      <Input
                        value={labelName}
                        onChange={(e) => setLabelName(e.target.value)}
                        placeholder="Label name"
                      />
                    </div>
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">Color</label>
                      <div className="oma-ws-color-row">
                        {[
                          '#c7d2fe',
                          '#fbcfe8',
                          '#fecdd3',
                          '#fed7aa',
                          '#fde68a',
                          '#d9f99d',
                          '#a7f3d0',
                          '#a5f3fc',
                          '#bae6fd',
                          '#e5e7eb',
                        ].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`oma-ws-swatch${labelColor === c ? ' is-selected' : ''}`}
                            style={{ background: c }}
                            aria-label={c}
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
                          if (!labelName.trim()) return;
                          setLabels((prev) => [
                            ...prev,
                            {
                              id: `label-${Date.now()}`,
                              name: labelName.trim(),
                              color: labelColor,
                            },
                          ]);
                          setLabelName('');
                          setLabelModal(false);
                        }}
                      >
                        Add label
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {section === 'templates' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Templates</h2>
              <div className="oma-ws-empty-block">
                <h3>Manage your workspace templates</h3>
                <p>
                  Create content faster with reusable captions, hashtags, and text snippets. Content
                  creation continues in the Content workspace.
                </p>
                <div className="oma-ws-action-row" style={{ justifyContent: 'center' }}>
                  <Button type="primary" onClick={() => setTemplateModal(true)}>
                    Create new template
                  </Button>
                  <Button type="default" onClick={() => (window.location.href = '/app/content')}>
                    <ShellIcon name="content" size={14} />
                    <span>Open content</span>
                  </Button>
                </div>
              </div>
              {templateModal ? (
                <div className="oma-ws-modal" role="dialog">
                  <div className="oma-ws-modal-card oma-ws-modal-card--wide">
                    <div className="oma-ws-modal-head">
                      <Input placeholder="Add a descriptive name…" />
                      <button
                        type="button"
                        onClick={() => setTemplateModal(false)}
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                    <div className="oma-ws-template-body">
                      <div className="oma-ws-template-chips">
                        <span className="oma-ws-chip">Campaign</span>
                        <span className="oma-ws-chip">Labels</span>
                      </div>
                      <p className="oma-muted">Title</p>
                      <p className="oma-muted">Type &apos;/&apos; to add headlines, media and more…</p>
                    </div>
                    <div className="oma-ws-modal-actions">
                      <Button type="default" onClick={() => setTemplateModal(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => {
                          setTemplateModal(false);
                          window.location.href = '/app/content';
                        }}
                      >
                        Save & open content
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {section === 'timetable' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Timetable</h2>
              {slots.length === 0 ? (
                <div className="oma-ws-empty-block">
                  <h3>Add your preferred time slots</h3>
                  <p>
                    Set up your timetable for faster scheduling. Full calendar lives in Schedule.
                  </p>
                  <div className="oma-ws-action-row" style={{ justifyContent: 'center' }}>
                    <Button type="primary" onClick={() => setSlotModal(true)}>
                      Create a slot
                    </Button>
                    <Button type="default" onClick={() => (window.location.href = '/app/schedule')}>
                      <ShellIcon name="schedule" size={14} />
                      <span>Open schedule</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="oma-ws-label-list">
                    {slots.map((s) => (
                      <li key={s.id} className="oma-ws-label-item">
                        <span className="oma-ws-swatch" style={{ background: s.color }} />
                        <span>
                          {s.day} · {s.time}
                        </span>
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
              {slotModal ? (
                <div className="oma-ws-modal" role="dialog">
                  <div className="oma-ws-modal-card">
                    <div className="oma-ws-modal-head">
                      <h3>Create time slot</h3>
                      <button type="button" onClick={() => setSlotModal(false)} aria-label="Close">
                        ×
                      </button>
                    </div>
                    <p className="oma-ws-empty-desc">
                      Choose a recurring time for your posting schedule.
                    </p>
                    <div className="oma-ws-slot-row">
                      <div className="oma-ws-field">
                        <label className="oma-ws-label">Select time</label>
                        <Input value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                      </div>
                      <div className="oma-ws-field">
                        <label className="oma-ws-label">Select day</label>
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
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">Select color</label>
                      <div className="oma-ws-color-row">
                        {[
                          '#fde68a',
                          '#a5f3fc',
                          '#ddd6fe',
                          '#bbf7d0',
                          '#bae6fd',
                          '#fecaca',
                          '#fed7aa',
                        ].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`oma-ws-swatch${slotColor === c ? ' is-selected' : ''}`}
                            style={{ background: c }}
                            onClick={() => setSlotColor(c)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="oma-ws-modal-actions">
                      <Button type="default" onClick={() => setSlotModal(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => {
                          setSlots((prev) => [
                            ...prev,
                            {
                              id: `slot-${Date.now()}`,
                              time: slotTime,
                              day: slotDay,
                              color: slotColor,
                            },
                          ]);
                          setSlotModal(false);
                        }}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
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
