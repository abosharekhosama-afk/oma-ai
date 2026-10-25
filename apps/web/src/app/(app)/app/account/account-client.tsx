'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageSkeleton } from '../../../../components/ui/page-skeleton';
import { ErrorState, errorKindOf, type ErrorKind } from '../../../../components/ui/error-state';
import { useToast } from '../../../../components/ui/toast';
import {
  getProfile,
  initials,
  setLocaleCookie,
  updateProfile,
  type Profile,
} from '../../../../lib/account-api';
import { useLocale, useT } from '../../../../lib/use-locale';

export default function AccountPage() {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [lang, setLang] = useState<'en' | 'ar'>(locale === 'ar' ? 'ar' : 'en');
  const [error, setError] = useState<ErrorKind | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await getProfile();
      setProfile(p);
      setName(p.name);
      setAvatarUrl(p.avatar_url ?? '');
      setLang(p.preferred_locale === 'ar' ? 'ar' : 'en');
    } catch (err) {
      setError(errorKindOf(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setFieldError(null);
    const trimmedUrl = avatarUrl.trim();
    if (!name.trim()) {
      setFieldError(t('account.nameRequired'));
      return;
    }
    if (trimmedUrl && !/^https:\/\//i.test(trimmedUrl)) {
      setFieldError(t('account.avatarInvalid'));
      return;
    }
    setSaving(true);
    try {
      const next = await updateProfile({
        name: name.trim(),
        avatarUrl: trimmedUrl || null,
        preferredLocale: lang,
      });
      setProfile(next);
      if (lang !== locale) {
        setLocaleCookie(lang);
        window.location.reload();
        return;
      }
      toast.push(t('account.saved'), 'success');
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : t('errors.page.generic.title'));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState kind={error} onRetry={() => void load()} />;
  if (!profile) return <PageSkeleton rows={4} />;

  const dirty =
    name !== profile.name ||
    avatarUrl !== (profile.avatar_url ?? '') ||
    lang !== (profile.preferred_locale === 'ar' ? 'ar' : 'en');
  const showImg = avatarUrl.trim().startsWith('https://') && !imgBroken;

  return (
    <div className="oma-planable-page" data-testid="account-page">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">{t('account.title')}</h1>
          <p className="oma-planable-page__sub">{t('account.subtitle')}</p>
        </div>
      </div>
      <div className="oma-account">
        <section className="oma-account__card">
          <h2>{t('account.profile')}</h2>
          <div className="oma-account__row">
            <span className="oma-account__avatar" aria-hidden="true" data-testid="account-avatar">
              {showImg ? (
                <img src={avatarUrl.trim()} alt="" onError={() => setImgBroken(true)} />
              ) : (
                initials(name || profile.email)
              )}
            </span>
            <div>
              <strong>{profile.name}</strong>
              <p className="oma-account__hint">{profile.email}</p>
            </div>
          </div>
          <label className="oma-account__field">
            {t('account.name')}
            <Input
              value={name}
              maxLength={120}
              data-testid="account-name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="oma-account__field">
            {t('account.avatarUrl')}
            <Input
              value={avatarUrl}
              placeholder="https://"
              dir="ltr"
              data-testid="account-avatar-url"
              onChange={(e) => {
                setImgBroken(false);
                setAvatarUrl(e.target.value);
              }}
            />
            <span className="oma-account__hint">{t('account.avatarHint')}</span>
          </label>
          <label className="oma-account__field">
            {t('shell.language')}
            <SelectField
              value={lang}
              data-testid="account-language"
              onChange={(e) => setLang(e.target.value === 'ar' ? 'ar' : 'en')}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </SelectField>
          </label>
          {fieldError ? (
            <p role="alert" className="oma-account__hint" data-testid="account-error">
              {fieldError}
            </p>
          ) : null}
          <div className="oma-ws-action-row">
            <Button
              type="primary"
              data-testid="account-save"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              {t('account.save')}
            </Button>
          </div>
        </section>
        <section className="oma-account__card">
          <h2>{t('account.security')}</h2>
          <p className="oma-account__hint">{t('account.passwordHint')}</p>
          <div>
            <Link href="/forgot-password">{t('account.resetPassword')}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
