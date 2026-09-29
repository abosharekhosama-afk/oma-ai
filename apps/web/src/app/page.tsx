import { OmaLinkButton } from '../components/ui/oma-link-button';
import { cookies, headers } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';

export default async function HomePage() {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get('oma_locale')?.value ?? hdrs.get('accept-language'));

  return (
    <main id="main" className="oma-auth">
      <div className="oma-auth-brand">
        <span className="oma-rail-mark" aria-hidden="true">
          OMA
        </span>
        <strong>{t(locale, 'app.name')}</strong>
      </div>
      <h1>{t(locale, 'app.name')}</h1>
      <p className="oma-muted">{t(locale, 'landing.tagline')}</p>
      <p className="oma-muted">{t(locale, 'app.endorsement')}</p>
      <div className="oma-form-actions">
        <OmaLinkButton href="/login" type="primary">
          {t(locale, 'auth.login')}
        </OmaLinkButton>
        <OmaLinkButton href="/register" type="default">
          {t(locale, 'auth.register')}
        </OmaLinkButton>
      </div>
    </main>
  );
}
