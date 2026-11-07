'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
} from '../../../../components/ui/lucide-icons';
import { ConfirmActionDialog } from '../../../../components/ui/confirm-action-dialog';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import { useToast } from '../../../../components/ui/toast';
import {
  cancelAccountDeletion,
  changeMyPassword,
  disableTwoFactor,
  exportMyData,
  getProfile,
  initials,
  scheduleAccountDeletion,
  setupTwoFactor,
  updateProfile,
  uploadAvatar,
  verifyTwoFactor,
  type Profile,
  type TwoFactorSetupResponse,
} from '../../../../lib/account-api';
import { useLocale, useT } from '../../../../lib/use-locale';
import './account-planable.css';

export default function AccountPage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password change state + confirmation
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Real TOTP 2FA state + confirmation
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[] | null>(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [disable2faConfirmOpen, setDisable2faConfirmOpen] = useState(false);

  // 30-day scheduled deletion + confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cancelDeleteConfirmOpen, setCancelDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Export data state + confirmation
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState<ErrorKind | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const avatarFile = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await getProfile();
      setProfile(p);
      setName(p.name);
      setAvatarUrl(p.avatar_url ?? '');
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
      setProfile((prev) => (prev ? { ...prev, ...next } : next));
      toast.push(t('account.saved'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    }
  }

  async function handlePasswordSaveConfirmed() {
    if (!newPassword.trim()) return;
    setChangingPassword(true);
    try {
      await changeMyPassword({
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      setPasswordConfirmOpen(false);
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

  async function handleStart2FA() {
    setTwoFactorBusy(true);
    try {
      const res = await setupTwoFactor();
      setTwoFactorSetup(res);
      setTwoFactorCode('');
      setTwoFactorBackupCodes(null);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleVerify2FA() {
    if (twoFactorCode.trim().length < 6) return;
    setTwoFactorBusy(true);
    try {
      const res = await verifyTwoFactor(twoFactorCode.trim());
      setProfile((prev) => (prev ? { ...prev, two_factor_enabled: res.two_factor_enabled } : prev));
      setTwoFactorBackupCodes(res.backup_codes);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      toast.push(
        t('account.two_factor_enabled_toast') || 'Two-factor authentication enabled.',
        'success',
      );
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleDisable2FAConfirmed() {
    setTwoFactorBusy(true);
    try {
      await disableTwoFactor();
      setProfile((prev) => (prev ? { ...prev, two_factor_enabled: false } : prev));
      setDisable2faConfirmOpen(false);
      setTwoFactorBackupCodes(null);
      toast.push(
        t('account.two_factor_disabled_toast') || 'Two-factor authentication disabled.',
        'success',
      );
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleExportDataConfirmed() {
    setExporting(true);
    try {
      const payload = await exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `oma-account-data-${profile?.id.slice(0, 8) ?? 'user'}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportConfirmOpen(false);
      toast.push(t('account.export_done') || 'Your data export has been downloaded.', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setExporting(false);
    }
  }

  async function handleScheduleDeleteConfirmed() {
    setDeleting(true);
    try {
      const res = await scheduleAccountDeletion();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              deletion_scheduled_at: res.deletion_scheduled_at,
              deletion_purge_at: res.deletion_purge_at,
            }
          : prev,
      );
      setDeleteConfirmOpen(false);
      toast.push(
        t('account.delete_scheduled_toast') ||
          'Account scheduled for deletion in 30 days. You can cancel anytime before then.',
        'success',
      );
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancelDeleteConfirmed() {
    setDeleting(true);
    try {
      await cancelAccountDeletion();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              deletion_scheduled_at: null,
              deletion_purge_at: null,
            }
          : prev,
      );
      setCancelDeleteConfirmOpen(false);
      toast.push(t('account.delete_cancelled_toast') || 'Account deletion cancelled.', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.http'), 'danger');
    } finally {
      setDeleting(false);
    }
  }

  function copyText(value: string, msgKey: string, fallback: string) {
    void navigator.clipboard?.writeText(value);
    toast.push(t(msgKey) || fallback, 'success');
  }

  if (error) return <ErrorState kind={error} onRetry={() => void load()} />;
  if (!profile) return <PageSkeleton rows={4} />;

  const normalizedAvatarUrl = avatarUrl.trim();
  const showImg =
    (normalizedAvatarUrl.startsWith('https://') ||
      normalizedAvatarUrl.startsWith('/api/v1/media/')) &&
    !imgBroken;

  const twoFactorEnabled = Boolean(profile.two_factor_enabled);
  const purgeDate = profile.deletion_purge_at ? profile.deletion_purge_at.slice(0, 10) : null;

  return (
    <div
      className="oma-plx-profile-page"
      data-testid="account-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="oma-plx-profile-page__inner">
        <h1 className="oma-plx-profile-page__title">{t('account.profile') || 'Profile'}</h1>

        {purgeDate ? (
          <div
            className="oma-plx-profile-deletion-banner"
            role="status"
            data-testid="account-deletion-scheduled-banner"
          >
            <div>
              <strong>
                {t('account.delete_scheduled_title') ||
                  'Your account is scheduled for deletion in 30 days'}
              </strong>
              <p>
                {(
                  t('account.delete_scheduled_body') ||
                  'Permanent erasure date: {date}. You can cancel this request anytime before that date.'
                ).replace('{date}', purgeDate)}
              </p>
            </div>
            <button
              type="button"
              className="oma-plx-profile-btn"
              onClick={() => setCancelDeleteConfirmOpen(true)}
              data-testid="account-cancel-deletion-btn"
            >
              {t('account.cancel_deletion_cta') || 'Cancel deletion'}
            </button>
          </div>
        ) : null}

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
                      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
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

        {/* Section 2: Security (Email read-only, Password, Real 2FA) */}
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
                <span
                  className="oma-plx-profile-email-display oma-ltr"
                  data-testid="account-email-readonly"
                >
                  {profile.email}
                </span>
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
                  onClick={() => setPasswordConfirmOpen(true)}
                  data-testid="account-password-submit"
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
                {twoFactorEnabled ? (
                  <span className="oma-plx-profile-2fa-active">
                    <CheckCircleOutlined />
                    <span>{t('account.two_factor_active_badge') || 'Enabled'}</span>
                  </span>
                ) : null}
                <button
                  type="button"
                  className="oma-plx-profile-btn"
                  disabled={twoFactorBusy}
                  onClick={() => {
                    if (twoFactorEnabled) setDisable2faConfirmOpen(true);
                    else void handleStart2FA();
                  }}
                  data-testid="account-2fa-btn"
                >
                  {twoFactorEnabled
                    ? t('account.disable_2fa') || 'Disable 2FA'
                    : t('account.enable_2fa') || 'Enable 2FA'}
                </button>
              </div>
            </div>

            {twoFactorBackupCodes && twoFactorBackupCodes.length > 0 ? (
              <div className="oma-plx-profile-2fa-backups" data-testid="account-2fa-backup-codes">
                <strong>
                  {t('account.two_factor_backup_title') ||
                    'Save your recovery backup codes in a safe place:'}
                </strong>
                <div className="oma-plx-profile-2fa-backups__grid oma-ltr">
                  {twoFactorBackupCodes.map((c) => (
                    <code key={c}>{c}</code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Section 3: Support (Export data, 30-day Delete account, User ID) */}
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
                  onClick={() => setExportConfirmOpen(true)}
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
                  {t('account.delete_account_30d_hint') ||
                    'Schedule your account and all related data for permanent erasure after a 30-day grace period.'}
                </span>
              </div>
              <div className="oma-plx-profile-row__control">
                {purgeDate ? (
                  <button
                    type="button"
                    className="oma-plx-profile-btn"
                    onClick={() => setCancelDeleteConfirmOpen(true)}
                    data-testid="account-delete-cancel-row-btn"
                  >
                    {t('account.cancel_deletion_cta') || 'Cancel scheduled deletion'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="oma-plx-profile-btn oma-plx-profile-btn--danger"
                    onClick={() => setDeleteConfirmOpen(true)}
                    data-testid="account-delete-btn"
                  >
                    <DeleteOutlined />
                    <span>{t('account.delete_account_cta') || 'Delete account and data'}</span>
                  </button>
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
                    onClick={() =>
                      copyText(profile.id, 'account.user_id_copied', 'User ID copied to clipboard.')
                    }
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

      {/* Real TOTP 2FA Setup & Verification Card Modal */}
      {twoFactorSetup ? (
        <div
          className="oma-plx-confirm-overlay"
          role="dialog"
          aria-modal="true"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          data-testid="account-2fa-modal"
          onClick={() => {
            if (!twoFactorBusy) setTwoFactorSetup(null);
          }}
        >
          <div className="oma-plx-confirm-card" onClick={(e) => e.stopPropagation()}>
            <header className="oma-plx-confirm-card__head">
              <span
                className="oma-plx-confirm-card__badge oma-plx-confirm-card__badge--primary"
                aria-hidden="true"
              >
                <LockOutlined />
              </span>
              <h3 className="oma-plx-confirm-card__title">
                {t('account.two_factor_setup_title') || 'Set up Two-Factor Authentication'}
              </h3>
              <button
                type="button"
                className="oma-plx-confirm-card__close"
                onClick={() => setTwoFactorSetup(null)}
                disabled={twoFactorBusy}
                aria-label={t('common.close')}
              >
                <CloseOutlined />
              </button>
            </header>

            <div className="oma-plx-confirm-card__body">
              <p>
                {t('account.two_factor_setup_desc') ||
                  'Add this secret key to your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code generated by the app:'}
              </p>
              <div className="oma-plx-2fa-secret-box">
                <code className="oma-ltr" data-testid="account-2fa-secret">
                  {twoFactorSetup.secret}
                </code>
                <button
                  type="button"
                  className="oma-plx-profile-icon-btn"
                  onClick={() =>
                    copyText(
                      twoFactorSetup.secret,
                      'account.two_factor_secret_copied',
                      '2FA secret copied.',
                    )
                  }
                  aria-label="Copy secret"
                >
                  <CopyOutlined />
                </button>
              </div>
              <label className="oma-plx-2fa-code-field">
                <span>{t('account.two_factor_code_label') || '6-digit verification code'}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="oma-plx-profile-input oma-ltr"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  data-testid="account-2fa-code-input"
                />
              </label>
            </div>

            <footer className="oma-plx-confirm-card__foot">
              <button
                type="button"
                className="oma-plx-confirm-card__btn oma-plx-confirm-card__btn--cancel"
                onClick={() => setTwoFactorSetup(null)}
                disabled={twoFactorBusy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="oma-plx-confirm-card__btn oma-plx-confirm-card__btn--primary"
                disabled={twoFactorBusy || twoFactorCode.length !== 6}
                onClick={() => void handleVerify2FA()}
                data-testid="account-2fa-verify-btn"
              >
                {t('account.two_factor_verify_cta') || 'Verify & enable 2FA'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* Confirmation Card: Disable 2FA */}
      <ConfirmActionDialog
        open={disable2faConfirmOpen}
        title={t('account.disable_2fa_confirm_title') || 'Disable two-factor authentication?'}
        description={
          t('account.disable_2fa_confirm_body') ||
          'Removing 2FA will make your account rely on your password or OAuth provider only.'
        }
        confirmLabel={t('account.disable_2fa') || 'Disable 2FA'}
        cancelLabel={t('common.cancel')}
        tone="danger"
        busy={twoFactorBusy}
        onConfirm={() => void handleDisable2FAConfirmed()}
        onCancel={() => setDisable2faConfirmOpen(false)}
        testId="confirm-disable-2fa-dialog"
      />

      {/* Confirmation Card: Change Password */}
      <ConfirmActionDialog
        open={passwordConfirmOpen}
        title={t('account.password_confirm_title') || 'Confirm password update'}
        description={
          t('account.password_confirm_body') ||
          'Are you sure you want to update your account password?'
        }
        confirmLabel={t('auth.reset.submit')}
        cancelLabel={t('common.cancel')}
        tone="primary"
        busy={changingPassword}
        onConfirm={() => void handlePasswordSaveConfirmed()}
        onCancel={() => setPasswordConfirmOpen(false)}
        testId="confirm-password-dialog"
      />

      {/* Confirmation Card: Export All My Data */}
      <ConfirmActionDialog
        open={exportConfirmOpen}
        title={t('account.export_confirm_title') || 'Export all your account data?'}
        description={
          t('account.export_confirm_body') ||
          'We will compile your profile, workspaces, brands, posts, comments, tasks, and activity into a downloadable JSON archive.'
        }
        confirmLabel={t('account.export_all_my_data') || 'Export all my data'}
        cancelLabel={t('common.cancel')}
        tone="primary"
        busy={exporting}
        onConfirm={() => void handleExportDataConfirmed()}
        onCancel={() => setExportConfirmOpen(false)}
        testId="confirm-export-data-dialog"
      />

      {/* Confirmation Card: Schedule Account Deletion (30 days) */}
      <ConfirmActionDialog
        open={deleteConfirmOpen}
        title={t('account.delete_confirm_30d_title') || 'Schedule account deletion (30 days)?'}
        description={
          t('account.delete_confirm_30d_body') ||
          'Your account and all associated data (posts, comments, workspaces, pages) will be scheduled for permanent deletion in 30 days. You can cancel the deletion at any time during the next 30 days.'
        }
        confirmLabel={t('account.delete_account_cta') || 'Delete account and data'}
        cancelLabel={t('common.cancel')}
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleScheduleDeleteConfirmed()}
        onCancel={() => setDeleteConfirmOpen(false)}
        testId="confirm-delete-account-dialog"
      />

      {/* Confirmation Card: Cancel Scheduled Account Deletion */}
      <ConfirmActionDialog
        open={cancelDeleteConfirmOpen}
        title={t('account.cancel_delete_confirm_title') || 'Keep your account active?'}
        description={
          t('account.cancel_delete_confirm_body') ||
          'This will cancel the scheduled 30-day deletion and keep your account and workspaces active.'
        }
        confirmLabel={t('account.cancel_deletion_cta') || 'Cancel deletion'}
        cancelLabel={t('common.close')}
        tone="primary"
        busy={deleting}
        onConfirm={() => void handleCancelDeleteConfirmed()}
        onCancel={() => setCancelDeleteConfirmOpen(false)}
        testId="confirm-cancel-delete-account-dialog"
      />
    </div>
  );
}
