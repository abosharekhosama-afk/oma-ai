import { cookies, headers } from 'next/headers';
import { resolveLocale } from '@oma/i18n';
import { ErrorState } from '../components/ui/error-state';

export default async function NotFound() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const locale = resolveLocale(cookieStore.get('oma_locale')?.value ?? hdrs.get('accept-language'));
  return (
    <main id="main" className="oma-error-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <ErrorState kind="notFound" code="404" homeHref="/app" />
    </main>
  );
}
