'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, SelectField } from '@oma/ui/controls';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';

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

type WorkspaceSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const WORKSPACE_NAV: Array<{ id: SettingsSection; label: string; group: 'workspace' | 'content' }> =
  [
    { id: 'general', label: 'General settings', group: 'workspace' },
    { id: 'brand', label: 'Brand context', group: 'workspace' },
    { id: 'team', label: 'Team & clients', group: 'workspace' },
    { id: 'approvals', label: 'Approvals', group: 'workspace' },
    { id: 'templates', label: 'Templates', group: 'content' },
    { id: 'labels', label: 'Labels', group: 'content' },
    { id: 'timetable', label: 'Timetable', group: 'content' },
  ];

export function WorkspaceSettingsPanel({ open, onClose }: WorkspaceSettingsPanelProps) {
  const t = useT();
  const [section, setSection] = useState<SettingsSection>('general');
  const [teamTab, setTeamTab] = useState<TeamTab>('members');
  const [me, setMe] = useState<Me | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [timezone, setTimezone] = useState('Jerusalem, Asia (UTC +3)');
  const [createInternal, setCreateInternal] = useState(false);
  const [hideEmails, setHideEmails] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelModal, setLabelModal] = useState(false);
  const [slotModal, setSlotModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Me>('/api/v1/auth/me')
      .then((data) => {
        setMe(data);
        const active = data.memberships.find((m) => m.tenant_id === data.active_tenant_id);
        setWorkspaceName(active?.tenant_name || data.memberships[0]?.tenant_name || 'Workspace');
      })
      .catch(() => setMe(null));
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
    try {
      // Prefer existing preferences API when available
      await api('/api/v1/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          workspace_name: workspaceName,
          website_url: websiteUrl,
          timezone,
          create_posts_as_internal: createInternal,
          hide_emails_from_clients: hideEmails,
          auto_crop_images: autoCrop,
        }),
      }).catch(() => null);
    } finally {
      setSaving(false);
    }
  }, [workspaceName, websiteUrl, timezone, createInternal, hideEmails, autoCrop]);

  if (!open) return null;

  const displayName = workspaceName || 'Workspace';
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
        {/* Left nav */}
        <aside className="oma-ws-panel-nav">
          <p className="oma-ws-panel-nav-group">Workspace</p>
          {WORKSPACE_NAV.filter((n) => n.group === 'workspace').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`oma-ws-panel-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.id === 'general' && <NavIcon kind="settings" />}
              {item.id === 'brand' && <NavIcon kind="brand" />}
              {item.id === 'team' && <NavIcon kind="team" />}
              {item.id === 'approvals' && <NavIcon kind="check" />}
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
              {item.id === 'templates' && <NavIcon kind="doc" />}
              {item.id === 'labels' && <NavIcon kind="tag" />}
              {item.id === 'timetable' && <NavIcon kind="clock" />}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <div className="oma-ws-panel-main">
          <button type="button" className="oma-ws-panel-close" aria-label="Close" onClick={onClose}>
            ×
          </button>

          {section === 'general' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">General settings</h2>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Workspace name</label>
                <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Website URL</label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="e.g. planable.io"
                />
              </div>
              <div className="oma-ws-field">
                <label className="oma-ws-label">Workspace timezone</label>
                <SelectField value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="Jerusalem, Asia (UTC +3)">Jerusalem, Asia (UTC +3)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York (UTC -5)</option>
                  <option value="Europe/London">London (UTC +0)</option>
                  <option value="Asia/Riyadh">Riyadh (UTC +3)</option>
                </SelectField>
              </div>

              <div className="oma-ws-toggles">
                <ToggleRow
                  label="Create new posts as internal"
                  checked={createInternal}
                  onChange={setCreateInternal}
                />
                <ToggleRow
                  label="Hide emails from clients"
                  checked={hideEmails}
                  onChange={setHideEmails}
                />
                <ToggleRow label="Auto-crop images" checked={autoCrop} onChange={setAutoCrop} />
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
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          )}

          {section === 'brand' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Brand context</h2>
              <p className="oma-ws-empty-desc">
                Add brand voice, guidelines, and context so the team stays consistent across posts.
              </p>
              <Button type="primary" onClick={() => window.location.assign('/app/brands')}>
                Open brand workspace
              </Button>
            </div>
          )}

          {section === 'team' && (
            <div className="oma-ws-section oma-ws-section--team">
              <div className="oma-ws-team-header">
                <h2 className="oma-ws-section-title">Team & clients</h2>
                <Button type="primary" onClick={() => window.location.assign('/app/team')}>
                  Invite members
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
                            {userEmail ? <div className="oma-ws-user-email">{userEmail}</div> : null}
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
              )}

              {teamTab === 'permissions' && (
                <div>
                  <h3 className="oma-ws-subhead">Adjust permissions</h3>
                  <p className="oma-ws-empty-desc">
                    Set up who can edit, approve, publish, analyze, engage, and administer the
                    workspace.
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
                </div>
              )}

              {teamTab === 'notifications' && (
                <div>
                  <h3 className="oma-ws-subhead">Manage notifications</h3>
                  <p className="oma-ws-empty-desc">
                    Adjust who receives email, browser, or Slack notifications.
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
                        Connect your Slack account to receive notifications and never miss a
                        comment, suggestion, approval request, or brand mention alerts.
                      </p>
                    </div>
                    <Button type="default">Connect</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'approvals' && (
            <div className="oma-ws-section">
              <h2 className="oma-ws-section-title">Approvals</h2>
              <p className="oma-ws-empty-desc">
                Configure approval workflows for posts and campaigns.
              </p>
              <Button type="primary" onClick={() => window.location.assign('/app/reviews')}>
                Open approvals
              </Button>
            </div>
          )}

          {section === 'labels' && (
            <div className="oma-ws-section oma-ws-section--center">
              <h2 className="oma-ws-section-title">Labels</h2>
              <div className="oma-ws-empty-block">
                <h3>Create labels</h3>
                <p>Labels make it easy to organize posts around your campaigns.</p>
                <Button type="primary" onClick={() => setLabelModal(true)}>
                  Create label
                </Button>
              </div>
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
                            className="oma-ws-swatch"
                            style={{ background: c }}
                            aria-label={c}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="oma-ws-modal-actions">
                      <Button type="default" onClick={() => setLabelModal(false)}>
                        Cancel
                      </Button>
                      <Button type="primary" onClick={() => setLabelModal(false)}>
                        Add label
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {section === 'templates' && (
            <div className="oma-ws-section oma-ws-section--center">
              <h2 className="oma-ws-section-title">Templates</h2>
              <div className="oma-ws-empty-block">
                <h3>Manage your workspace templates</h3>
                <p>
                  Create content faster with reusable captions, hashtags, and text snippets for all
                  your social media profiles and other content.
                </p>
                <Button type="primary" onClick={() => setTemplateModal(true)}>
                  Create new template
                </Button>
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
                      <Button type="primary" onClick={() => setTemplateModal(false)}>
                        Save template
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {section === 'timetable' && (
            <div className="oma-ws-section oma-ws-section--center">
              <h2 className="oma-ws-section-title">Timetable</h2>
              <div className="oma-ws-empty-block">
                <h3>Add your preferred time slots</h3>
                <p>
                  Set up your timetable for faster scheduling across all your social media profiles.
                </p>
                <Button type="primary" onClick={() => setSlotModal(true)}>
                  Create a slot
                </Button>
              </div>
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
                        <Input defaultValue="13:20" />
                      </div>
                      <div className="oma-ws-field">
                        <label className="oma-ws-label">Select day</label>
                        <SelectField defaultValue="Thursday">
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                          <option value="Saturday">Saturday</option>
                          <option value="Sunday">Sunday</option>
                        </SelectField>
                      </div>
                    </div>
                    <div className="oma-ws-field">
                      <label className="oma-ws-label">Select color</label>
                      <div className="oma-ws-color-row">
                        {['#fde68a', '#a5f3fc', '#ddd6fe', '#fde68a', '#bbf7d0', '#bae6fd', '#fecaca'].map(
                          (c) => (
                            <button
                              key={c}
                              type="button"
                              className="oma-ws-swatch"
                              style={{ background: c }}
                            />
                          ),
                        )}
                      </div>
                    </div>
                    <div className="oma-ws-modal-actions">
                      <Button type="default" onClick={() => setSlotModal(false)}>
                        Cancel
                      </Button>
                      <Button type="primary" onClick={() => setSlotModal(false)}>
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

function NavIcon({ kind }: { kind: 'settings' | 'brand' | 'team' | 'check' | 'doc' | 'tag' | 'clock' }) {
  const paths: Record<string, string> = {
    settings:
      'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.1 2.8-.9-1.6 1.2-1.5-1.7-1.7-1.5 1.2-1.6-.9L14.5 4h-5l-.2 2.8-1.6.9-1.5-1.2-1.7 1.7 1.2 1.5-.9 1.6L3 12.5v5l2.8.2.9 1.6-1.2 1.5 1.7 1.7 1.5-1.2 1.6.9.2 2.8h5l.2-2.8 1.6-.9 1.5 1.2 1.7-1.7-1.2-1.5.9-1.6 2.8-.2v-5l-2.8-.2Z',
    brand: 'M4 6h16v12H4V6Zm2 2v8h12V8H6Z',
    team: 'M9 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM4.5 19c0-2.5 2.2-4.5 4.5-4.5h1c2.3 0 4.5 2 4.5 4.5V20H4.5v-1Z',
    check: 'M9 12.5 11 14.5 15.5 10 14 8.5 11 11.5 9.5 10 8 11.5 9 12.5Z',
    doc: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V9h4.5L14 4.5Z',
    tag: 'M4 4h8l8 8-8 8H4V4Zm3 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
    clock:
      'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm1 2v5.2l3.5 2.1-1 1.6L11 13V7h2Z',
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={paths[kind]} />
    </svg>
  );
}
