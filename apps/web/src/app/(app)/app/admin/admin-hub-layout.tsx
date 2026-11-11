'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../lib/use-platform-operator';
import './admin-hub.css';

const links = [
  { href: '/app/admin', labelEn: 'Overview', labelAr: 'نظرة عامة', superOnly: true },
  { href: '/app/admin/tenants', labelEn: 'Tenants', labelAr: 'المستأجرون', superOnly: true },
  { href: '/app/admin/plans', labelEn: 'Plans & limits', labelAr: 'الخطط والحدود', superOnly: true },
  { href: '/app/admin/team', labelEn: 'Support team', labelAr: 'فريق الدعم', superOnly: true },
  { href: '/app/admin/support', labelEn: 'Support', labelAr: 'الدعم الفني', superOnly: false },
  { href: '/app/admin/billing', labelEn: 'Billing', labelAr: 'الفوترة', superOnly: false },
] as const;

export function AdminHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const { loading, ok, superAdmin, support } = usePlatformOperator();

  if (loading) {
    return (
      <div className="admin-hub">
        <main className="admin-hub__main">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</main>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="admin-hub">
        <main className="admin-hub__main">
          <h1>{isAr ? 'غير مصرّح' : 'Not authorized'}</h1>
          <p>
            {isAr
              ? 'لوحة الإدارة والدعم متاحة لمسؤولي المنصة فقط.'
              : 'The platform admin and support hub is restricted to operator roles.'}
          </p>
          <button type="button" onClick={() => router.push('/app')}>
            {isAr ? 'العودة للتطبيق' : 'Back to app'}
          </button>
        </main>
      </div>
    );
  }

  const visible = links.filter((l) => {
    if (l.href === '/app/admin/support') return support || superAdmin;
    if (l.superOnly) return superAdmin;
    return support || superAdmin;
  });

  return (
    <div className="admin-hub" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="admin-hub__bar">
        <div>
          <strong>{isAr ? 'إدارة المنصة' : 'Platform operations'}</strong>
        </div>
        <nav className="admin-hub__nav" aria-label={isAr ? 'إدارة المنصة' : 'Platform admin'}>
          {visible.map((l) => {
            const active =
              l.href === '/app/admin'
                ? pathname === '/app/admin'
                : (pathname?.startsWith(l.href) ?? false);
            return (
              <Link key={l.href} href={l.href} data-active={active ? 'true' : 'false'}>
                {isAr ? l.labelAr : l.labelEn}
              </Link>
            );
          })}
          <Link href="/app">{isAr ? 'تطبيق العميل' : 'Client app'}</Link>
        </nav>
      </header>
      <main className="admin-hub__main">{children}</main>
    </div>
  );
}
