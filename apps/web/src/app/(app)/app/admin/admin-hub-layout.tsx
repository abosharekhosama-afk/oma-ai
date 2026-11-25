'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShellIcon } from '../../../../components/shell/shell-icons';
import type { NavIconId } from '../../../../components/shell/nav-config';
import { useLocale } from '../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../lib/use-platform-operator';
import './admin-hub.css';
import './admin-hub-compact.css';
import './admin-hub-mobile.css';

type NavItem = {
  href: string;
  icon: NavIconId;
  labelEn: string;
  labelAr: string;
  superOnly?: boolean;
};

const nav: NavItem[] = [
  { href: '/app/admin', icon: 'home', labelEn: 'Overview', labelAr: 'نظرة عامة', superOnly: true },
  {
    href: '/app/admin/tenants',
    icon: 'company',
    labelEn: 'Subscribers',
    labelAr: 'المشتركون',
    superOnly: true,
  },
  {
    href: '/app/admin/plans',
    icon: 'settings',
    labelEn: 'Plans & pricing',
    labelAr: 'الخطط والأسعار',
    superOnly: true,
  },
  {
    href: '/app/admin/billing',
    icon: 'analytics',
    labelEn: 'Billing & transfers',
    labelAr: 'الفوترة والتحويل',
    superOnly: false,
  },
  {
    href: '/app/admin/cases',
    icon: 'requests',
    labelEn: 'Support tickets',
    labelAr: 'تذاكر الدعم',
    superOnly: false,
  },
  {
    href: '/app/admin/issues',
    icon: 'activity',
    labelEn: 'Errors & jobs',
    labelAr: 'الأخطاء والمهام',
    superOnly: false,
  },
  {
    href: '/app/admin/support',
    icon: 'filter',
    labelEn: 'Diagnostics',
    labelAr: 'التشخيص',
    superOnly: false,
  },
  {
    href: '/app/admin/team',
    icon: 'team',
    labelEn: 'Support team',
    labelAr: 'فريق الدعم',
    superOnly: true,
  },
];

export function AdminHubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const { loading, ok, superAdmin, support } = usePlatformOperator();
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  const visible = useMemo(
    () =>
      loading || !ok
        ? []
        : nav.filter((item) => (item.superOnly ? superAdmin : superAdmin || support)),
    [loading, ok, superAdmin, support],
  );

  const mobileSectionLabel = useMemo(() => {
    const item = visible.find((entry) =>
      entry.href === '/app/admin'
        ? pathname === '/app/admin'
        : (pathname?.startsWith(entry.href) ?? false),
    );
    if (!item) return isAr ? 'إدارة المنصة' : 'Platform admin';
    return isAr ? item.labelAr : item.labelEn;
  }, [visible, pathname, isAr]);

  if (loading) {
    return (
      <div className="admin-hub">
        <main className="admin-hub__content">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</main>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="admin-hub">
        <main className="admin-hub__content">
          <div className="oma-plx-listening-card admin-hub__denied">
            <h1>{isAr ? 'غير مصرّح' : 'Not authorized'}</h1>
            <p>
              {isAr
                ? 'لوحة الإدارة متاحة لمسؤولي المنصة وفريق الدعم فقط.'
                : 'The platform admin hub is restricted to operator roles.'}
            </p>
            <button type="button" className="admin-hub__btn" onClick={() => router.push('/app')}>
              {isAr ? 'تطبيق العميل' : 'Client app'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`admin-hub${navOpen ? ' admin-hub--nav-open' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="admin-hub__backdrop"
        aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
        onClick={closeNav}
        tabIndex={navOpen ? 0 : -1}
      />
      <header className="admin-hub__mobile-bar">
        <button
          type="button"
          className="admin-hub__menu-toggle"
          aria-expanded={navOpen}
          aria-controls="admin-hub-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          <ShellIcon name="menu" size={18} />
        </button>
        <div className="admin-hub__mobile-title">
          <strong>OMA</strong>
          <span>{mobileSectionLabel}</span>
        </div>
      </header>
      <aside
        id="admin-hub-nav"
        className="admin-hub__rail"
        aria-label={isAr ? 'إدارة المنصة' : 'Platform admin'}
      >
        <div className="admin-hub__brand">
          <strong>OMA</strong>
          <span>{isAr ? 'عمليات المنصة' : 'Platform ops'}</span>
        </div>
        <nav className="admin-hub__menu">
          {visible.map((item) => {
            const active =
              item.href === '/app/admin'
                ? pathname === '/app/admin'
                : (pathname?.startsWith(item.href) ?? false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="admin-hub__menu-item"
                data-active={active ? 'true' : 'false'}
                onClick={closeNav}
              >
                <ShellIcon name={item.icon} size={18} />
                <span>{isAr ? item.labelAr : item.labelEn}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-hub__rail-foot">
          <Link href="/app/help" className="admin-hub__menu-item" onClick={closeNav}>
            <ShellIcon name="requests" size={18} />
            <span>{isAr ? 'مركز العميل' : 'Customer help'}</span>
          </Link>
          <Link href="/app" className="admin-hub__menu-item" onClick={closeNav}>
            <ShellIcon name="company" size={18} />
            <span>{isAr ? 'مساحة العمل' : 'Workspace'}</span>
          </Link>
        </div>
      </aside>
      <main className="admin-hub__content">{children}</main>
    </div>
  );
}
