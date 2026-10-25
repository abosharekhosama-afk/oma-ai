import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';

export default async function NotFound() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const locale = resolveLocale(cookieStore.get('oma_locale')?.value ?? hdrs.get('accept-language'));
  return (
    <main id="main" className="oma-error-page">
      <section className="oma-error-state" role="alert" data-testid="error-state-notFound">
        <p className="oma-error-state__code">404</p>
        <h1 className="oma-error-state__title">{t(locale, 'errors.page.notFound.title')}</h1>
        <p className="oma-error-state__body">{t(locale, 'errors.page.notFound.body')}</p>
        <div className="oma-error-state__actions">
          <Link className="oma-error-state__btn oma-error-state__btn--primary" href="/app">
            {t(locale, 'errors.goHome')}
          </Link>
        </div>
      </section>
    </main>
  );
}
