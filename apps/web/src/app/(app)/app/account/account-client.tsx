'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyOutlined, DeleteOutlined, EditOutlined } from '../../../../components/ui/lucide-icons';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import { useToast } from '../../../../components/ui/toast';
import {
  changeMyPassword,
  deleteMyAccount,
  exportMyData,
  getPreferences,
  getProfile,
  initials,
  updatePreferences,
  updateProfile,
  uploadAvatar,
  type Profile,
  type UserPreferences,
} from '../../../../lib/account-api';
import { SESSION_OK_KEY } from '../../../../lib/session';
import { useLocale, useT } from '../../../../lib/use-locale';
import './account-planable.css';

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jerusalem', label: 'Jerusalem, Asia (UTC +2)' },
  { value: 'Asia/Dubai', label: 'Dubai, Asia (UTC +4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh, Asia (UTC +3)' },
  { value: 'Africa/Cairo', label: 'Cairo, Africa (UTC +2)' },
  { value: 'Europe/London', label: 'London, Europe (UTC +0)' },
  { value: 'Europe/Paris', label: 'Paris, Europe (UTC +1)' },
  { value: 'America/New_York', label: 'New York, America (UTC -5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, America (UTC -8)' },
  { value: 'UTC', label: 'UTC (UTC +0)' },
];

export default function AccountPage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const avatarFile = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, pr] = await Promise.all([getProfile(), getPreferences().catch(() => null)]);
      setProfile(p);
      setName(p.name);
      setEmailInput(p.email);
      setAvatarUrl(p.avatar_url ?? '');
      if (pr) setPrefs(pr);
    } catch (err) {
      setError(errorKindOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNameIfChanged() {
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setName(profile.name);
      return;
    }
    if (trimmed === profile.name) return;
    try {
      const next = await updateProfile({ name: trimmed });
      setProfile(next);
      toast.push(t('account.saved'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    }
  }

  async function saveEmail() {
    if (!profile) return;
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || trimmed === profile.email) {
      setEditingEmail(false);
      return;
    }
    try {
      const next = await updateProfile({ email: trimmed });
      setProfile(next);
      setEditingEmail(false);
      toast.push(t('account.saved'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    }
  }

  async function patchPrefs(patch: Partial<UserPreferences>) {
    try {
      const next = await updatePreferences(patch);
      setPrefs(next);
      toast.push(t('account.saved'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    }
  }

  async function handlePasswordSave() {
    if (!newPassword.trim()) return;
    setChangingPassword(true);
    try {
      await changeMyPassword({
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      toast.push(t('auth.reset.done'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('auth.reset.error'), 'danger');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const payload = await exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oma-account-export-${profile?.id.slice(0, 8) ?? 'user'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.push(t('account.export_done') || 'Your data export has been downloaded.', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      try {
        window.sessionStorage.removeItem(SESSION_OK_KEY);
      } catch {
        /* ignore */
      }
      window.location.href = '/login';
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
      setDeleting(false);
    }
  }

  function copyUserId() {
    if (!profile?.id) return;
    void navigator.clipboard?.writeText(profile.id);
    toast.push(t('account.user_id_copied') || 'User ID copied to clipboard.', 'success');
  }

  if (error) return <ErrorState kind={error} onRetry={() => void load()} />;
  if (!profile) return <PageSkeleton rows={4} />;

  const normalizedAvatarUrl = avatarUrl.trim();
  const showImg =
    (normalizedAvatarUrl.startsWith('https://') ||
      normalizedAvatarUrl.startsWith('/api/v1/media/')) &&
    !imgBroken;

  const timezone = prefs?.timezone ?? 'Asia/Jerusalem';
  const hourFormat = prefs?.hourFormat ?? '24h';
  const weekStart = prefs?.weekStart ?? 'monday';
  const twoFactorEnabled = Boolean(prefs?.twoFactorEnabled);

  return (
    <div
      className="oma-plx-profile-page"
      data-testid="account-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="oma-plx-profile-page__inner">
        <h1 className="oma-plx-profile-page__title">{t('account.profile') || 'Profile'}</h1>

        {/* Section 1: Profile settings */}
        <section className="oma-plx-profile-sec">
          <h2 className="oma-plx-profile-sec__heading">
            {t('shell.profile_settings') || 'Profile settings'}
          </h2>
          <div className="oma-plx-profile-card">
            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.avatar_label') || 'Avatar'}</strong>
                <span>
                  {t('account.visible_to_others') || 'Visible to others in your workspaces.'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                <input
                  ref={avatarFile}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  data-testid="account-avatar-file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingAvatar(true);
                    try {
                      const uploaded = await uploadAvatar(file);
                      setImgBroken(false);
                      setAvatarUrl(uploaded.avatar_url);
                      const updated = await updateProfile({ avatarUrl: uploaded.avatar_url });
                      setProfile(updated);
                      toast.push(t('account.saved'), 'success');
                    } catch (err) {
                      toast.push(
                        err instanceof Error ? err.message : t('errors.page.generic.title'),
                        'danger',
                      );
                    } finally {
                      setUploadingAvatar(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="oma-plx-profile-avatar-btn"
                  disabled={uploadingAvatar}
                  onClick={() => avatarFile.current?.click()}
                  data-testid="account-avatar"
                  aria-label={t('account.avatar_label') || 'Avatar'}
                >
                  {showImg ? (
                    <img src={normalizedAvatarUrl} alt="" onError={() => setImgBroken(true)} />
                  ) : (
                    <span>{initials(name || profile.email)}</span>
                  )}
                  <span className="oma-plx-profile-avatar-btn__edit" aria-hidden>
                    <EditOutlined />
                  </span>
                </button>
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.name')}</strong>
                <span>
                  {t('account.visible_to_others') || 'Visible to others in your workspaces.'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control oma-plx-profile-row__control--wide">
                <input
                  type="text"
                  className="oma-plx-profile-input"
                  value={name}
                  maxLength={120}
                  data-testid="account-name"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => void saveNameIfChanged()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Security */}
        <section className="oma-plx-profile-sec">
          <h2 className="oma-plx-profile-sec__heading">
            {t('account.security_heading') || 'Security'}
          </h2>
          <div className="oma-plx-profile-card">
            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('auth.email')}</strong>
                <span>
                  {t('account.email_hint') || 'Used for login, and invites to workspaces.'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                {editingEmail ? (
                  <div className="oma-plx-profile-inline-edit">
                    <input
                      type="email"
                      className="oma-plx-profile-input"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      data-testid="account-email-input"
                    />
                    <button
                      type="button"
                      className="oma-plx-profile-btn"
                      onClick={() => void saveEmail()}
                    >
                      {t('account.save')}
                    </button>
                  </div>
                ) : (
                  <div className="oma-plx-profile-email-display">
                    <span className="oma-ltr">{profile.email}</span>
                    <button
                      type="button"
                      className="oma-plx-profile-icon-btn"
                      onClick={() => setEditingEmail(true)}
                      aria-label={t('common.edit') || 'Edit email'}
                      data-testid="account-edit-email"
                    >
                      <EditOutlined />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('auth.password')}</strong>
                <span>
                  {t('account.password_row_hint') || 'Change the password for this account'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                <button
                  type="button"
                  className="oma-plx-profile-btn"
                  onClick={() => setPasswordModalOpen((v) => !v)}
                  data-testid="account-change-password-btn"
                >
                  {t('account.change_password') || 'Change password'}
                </button>
              </div>
            </div>

            {passwordModalOpen ? (
              <div className="oma-plx-profile-subform" data-testid="account-password-form">
                <input
                  type="password"
                  className="oma-plx-profile-input"
                  placeholder={t('account.current_password') || 'Current password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="oma-plx-profile-input"
                  placeholder={t('auth.reset.newPassword')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="oma-plx-profile-btn oma-plx-profile-btn--primary"
                  disabled={changingPassword || !newPassword.trim()}
                  onClick={() => void handlePasswordSave()}
                >
                  {t('auth.reset.submit')}
                </button>
              </div>
            ) : null}

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.two_factor_title') || 'Two-factor authentication'}</strong>
                <span>
                  {t('account.two_factor_hint') || 'Add another layer of security to your account'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                <button
                  type="button"
                  className="oma-plx-profile-btn"
                  onClick={() => void patchPrefs({ twoFactorEnabled: !twoFactorEnabled })}
                  data-testid="account-2fa-btn"
                >
                  {twoFactorEnabled
                    ? t('account.disable_2fa') || 'Disable 2FA'
                    : t('account.enable_2fa') || 'Enable 2FA'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Time & location */}
        <section className="oma-plx-profile-sec">
          <h2 className="oma-plx-profile-sec__heading">
            {t('account.time_location_heading') || 'Time & location'}
          </h2>
          <div className="oma-plx-profile-card">
            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.timezone_label') || 'Account timezone'}</strong>
                <span>
                  {t('account.timezone_hint') ||
                    "Used for workspaces you create, that don't have a timezone."}
                </span>
              </div>
              <div className="oma-plx-profile-row__control oma-plx-profile-row__control--wide">
                <select
                  className="oma-plx-profile-select"
                  value={timezone}
                  onChange={(e) => void patchPrefs({ timezone: e.target.value })}
                  data-testid="account-timezone-select"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.hour_format_label') || 'Hour format'}</strong>
              </div>
              <div className="oma-plx-profile-row__control">
                <div className="oma-plx-profile-seg" role="group">
                  <button
                    type="button"
                    data-active={hourFormat === '24h' ? 'true' : 'false'}
                    onClick={() => void patchPrefs({ hourFormat: '24h' })}
                    data-testid="account-hour-24"
                  >
                    {t('account.hour_24') || '24 hour'}
                  </button>
                  <button
                    type="button"
                    data-active={hourFormat === '12h' ? 'true' : 'false'}
                    onClick={() => void patchPrefs({ hourFormat: '12h' })}
                    data-testid="account-hour-12"
                  >
                    {t('account.hour_12') || '12 hour'}
                  </button>
                </div>
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.week_starts_on') || 'Week starts on'}</strong>
              </div>
              <div className="oma-plx-profile-row__control">
                <div className="oma-plx-profile-seg" role="group">
                  <button
                    type="button"
                    data-active={weekStart === 'monday' ? 'true' : 'false'}
                    onClick={() => void patchPrefs({ weekStart: 'monday' })}
                    data-testid="account-week-monday"
                  >
                    {t('account.monday') || 'Monday'}
                  </button>
                  <button
                    type="button"
                    data-active={weekStart === 'sunday' ? 'true' : 'false'}
                    onClick={() => void patchPrefs({ weekStart: 'sunday' })}
                    data-testid="account-week-sunday"
                  >
                    {t('account.sunday') || 'Sunday'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Support */}
        <section className="oma-plx-profile-sec">
          <h2 className="oma-plx-profile-sec__heading">
            {t('account.support_heading') || 'Support'}
          </h2>
          <div className="oma-plx-profile-card">
            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.export_data_title') || 'Export data'}</strong>
                <span>
                  {t('account.export_data_hint') ||
                    'Save all the information created by me or related to me in OMA (posts, comments, workspaces, pages etc.)'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                <button
                  type="button"
                  className="oma-plx-profile-btn"
                  disabled={exporting}
                  onClick={() => void handleExportData()}
                  data-testid="account-export-btn"
                >
                  {t('account.export_all_my_data') || 'Export all my data'}
                </button>
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.delete_account_title') || 'Delete my account'}</strong>
                <span>
                  {t('account.delete_account_hint') ||
                    'Close my account and erase all my data (posts, comments, workspaces, pages etc.). This action is irreversible.'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                {!deleteConfirmOpen ? (
                  <button
                    type="button"
                    className="oma-plx-profile-btn oma-plx-profile-btn--danger"
                    onClick={() => setDeleteConfirmOpen(true)}
                    data-testid="account-delete-btn"
                  >
                    <DeleteOutlined />
                    <span>{t('account.delete_account_cta') || 'Delete account and data'}</span>
                  </button>
                ) : (
                  <div className="oma-plx-profile-inline-edit">
                    <button
                      type="button"
                      className="oma-plx-profile-btn oma-plx-profile-btn--danger"
                      disabled={deleting}
                      onClick={() => void handleDeleteAccount()}
                      data-testid="account-delete-confirm-btn"
                    >
                      {t('common.confirm') || 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      className="oma-plx-profile-btn"
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="oma-plx-profile-row">
              <div className="oma-plx-profile-row__text">
                <strong>{t('account.user_id_label') || 'User ID'}</strong>
              </div>
              <div className="oma-plx-profile-row__control">
                <div className="oma-plx-profile-userid">
                  <code className="oma-ltr">{profile.id}</code>
                  <button
                    type="button"
                    className="oma-plx-profile-icon-btn"
                    onClick={copyUserId}
                    aria-label={t('views.menu.copy_link') || 'Copy User ID'}
                    data-testid="account-copy-userid"
                  >
                    <CopyOutlined />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
