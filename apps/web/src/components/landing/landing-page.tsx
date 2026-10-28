'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { PlxLogo } from '../ui/plx-icons';
import { useLocale, useT } from '../../lib/use-locale';
import { setLocaleCookie, updateProfile } from '../../lib/account-api';
import { useInView } from './use-inview';
import {
  FacebookGlyph,
  InstagramGlyph,
  LinkedInGlyph,
  TikTokGlyph,
  XGlyph,
} from './platform-icons';
import './landing.css';

const TAB_MS = 6000;

const TAB_IDS = ['calendar', 'feed', 'approvals', 'analytics'] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_IMAGES: Record<TabId, { src: string; altKey: string }> = {
  calendar: { src: '/landing/calendar.png', altKey: 'landing.feat.calendar.alt' },
  feed: { src: '/landing/composer.png', altKey: 'landing.feat.collab.alt' },
  approvals: { src: '/landing/approvals.png', altKey: 'landing.feat.approve.alt' },
  analytics: { src: '/landing/analytics.png', altKey: 'landing.feat.analytics.alt' },
};

function Reveal({
  children,
  className = '',
  variant = 'y',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'y' | 'x';
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const base = variant === 'x' ? 'oma-lp-reveal-x' : 'oma-lp-reveal';
  return (
    <div ref={ref} className={`${base}${inView ? ' is-inview' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}

function BulletIcon() {
  return (
    <span className="oma-lp-bullet-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function LandingPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('calendar');
  const [progressKey, setProgressKey] = useState(0);
  const megaId = useId();
  const manifesto = useInView<HTMLElement>();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setTab((prev) => {
        const i = TAB_IDS.indexOf(prev);
        return TAB_IDS[(i + 1) % TAB_IDS.length]!;
      });
      setProgressKey((k) => k + 1);
    }, TAB_MS);
    return () => window.clearInterval(id);
  }, [tab]);

  const switchLocale = useCallback(
    (next: 'en' | 'ar') => {
      if (next === locale) return;
      setLocaleCookie(next);
      void updateProfile({ preferredLocale: next }).catch(() => undefined);
      router.refresh();
    },
    [locale, router],
  );

  const selectTab = (id: TabId) => {
    setTab(id);
    setProgressKey((k) => k + 1);
  };

  const year = new Date().getFullYear();
  const tabTitleKey = `landing.tabs.${tab}Title` as const;
  const tabBullets = [
    t(`landing.tabs.${tab}B1`),
    t(`landing.tabs.${tab}B2`),
    t(`landing.tabs.${tab}B3`),
  ];

  const megaItems = [
    { href: '#features', title: t('landing.mega.plan.title'), desc: t('landing.mega.plan.desc') },
    { href: '#features', title: t('landing.mega.collaborate.title'), desc: t('landing.mega.collaborate.desc') },
    { href: '#features', title: t('landing.mega.approve.title'), desc: t('landing.mega.approve.desc') },
    { href: '#features', title: t('landing.mega.publish.title'), desc: t('landing.mega.publish.desc') },
    { href: '#features', title: t('landing.mega.storage.title'), desc: t('landing.mega.storage.desc') },
    { href: '#how', title: t('landing.mega.team.title'), desc: t('landing.mega.team.desc') },
  ];

  const features = [
    {
      tone: 'mint',
      flip: false,
      title: t('landing.feat.calendar.title'),
      bullets: [t('landing.feat.calendar.b1'), t('landing.feat.calendar.b2'), t('landing.feat.calendar.b3')],
      cta: t('landing.feat.calendar.cta'),
      alt: t('landing.feat.calendar.alt'),
      src: '/landing/calendar.png',
    },
    {
      tone: 'peach',
      flip: true,
      title: t('landing.feat.collab.title'),
      bullets: [t('landing.feat.collab.b1'), t('landing.feat.collab.b2'), t('landing.feat.collab.b3')],
      cta: t('landing.feat.collab.cta'),
      alt: t('landing.feat.collab.alt'),
      src: '/landing/deliverables.png',
    },
    {
      tone: 'lavender',
      flip: false,
      title: t('landing.feat.approve.title'),
      bullets: [t('landing.feat.approve.b1'), t('landing.feat.approve.b2'), t('landing.feat.approve.b3')],
      cta: t('landing.feat.approve.cta'),
      alt: t('landing.feat.approve.alt'),
      src: '/landing/approvals.png',
    },
    {
      tone: 'sand',
      flip: true,
      title: t('landing.feat.organize.title'),
      bullets: [t('landing.feat.organize.b1'), t('landing.feat.organize.b2'), t('landing.feat.organize.b3')],
      cta: t('landing.feat.organize.cta'),
      alt: t('landing.feat.organize.alt'),
      src: '/landing/team.png',
    },
    {
      tone: 'sky',
      flip: false,
      title: t('landing.feat.analytics.title'),
      bullets: [t('landing.feat.analytics.b1'), t('landing.feat.analytics.b2'), t('landing.feat.analytics.b3')],
      cta: t('landing.feat.analytics.cta'),
      alt: t('landing.feat.analytics.alt'),
      src: '/landing/analytics-detail.png',
    },
  ] as const;

  const how = [
    { title: t('landing.how.s1.title'), body: t('landing.how.s1.body') },
    { title: t('landing.how.s2.title'), body: t('landing.how.s2.body') },
    { title: t('landing.how.s3.title'), body: t('landing.how.s3.body') },
    { title: t('landing.how.s4.title'), body: t('landing.how.s4.body') },
  ];

  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`landing.faq.q${n}`),
    a: t(`landing.faq.a${n}`),
  }));

  const platforms = [
    { name: t('landing.platforms.facebook'), Icon: FacebookGlyph },
    { name: t('landing.platforms.instagram'), Icon: InstagramGlyph },
    { name: t('landing.platforms.linkedin'), Icon: LinkedInGlyph },
    { name: t('landing.platforms.tiktok'), Icon: TikTokGlyph },
    { name: t('landing.platforms.x'), Icon: XGlyph },
  ];

  return (
    <div className="oma-lp">
      <header className={`oma-lp-header${solid ? ' is-solid' : ''}`}>
        <div className="oma-lp-header-inner">
          <Link href="/" className="oma-lp-brand" aria-label="OMA">
            <PlxLogo sub="by IMKAN" compact />
          </Link>

          <nav className="oma-lp-nav" aria-label={t('nav.primary')}>
            <div
              className={`oma-lp-nav-item${megaOpen ? ' is-open' : ''}`}
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button
                type="button"
                className="oma-lp-nav-btn"
                aria-expanded={megaOpen}
                aria-controls={megaId}
                onClick={() => setMegaOpen((v) => !v)}
              >
                {t('landing.nav.product')}
                <span className="oma-lp-chevron" />
              </button>
              <div id={megaId} className="oma-lp-mega" role="menu">
                {megaItems.map((item) => (
                  <a key={item.title} href={item.href} role="menuitem" onClick={() => setMegaOpen(false)}>
                    <span className="oma-lp-mega-title">{item.title}</span>
                    <span className="oma-lp-mega-desc">{item.desc}</span>
                  </a>
                ))}
              </div>
            </div>
            <a className="oma-lp-nav-link" href="#features">
              {t('landing.nav.features')}
            </a>
            <a className="oma-lp-nav-link" href="#how">
              {t('landing.nav.how')}
            </a>
            <a className="oma-lp-nav-link" href="#faq">
              {t('landing.nav.faq')}
            </a>
          </nav>

          <div className="oma-lp-header-actions">
            <div className="oma-lp-lang-card" role="group" aria-label={t('landing.nav.language')}>
              <button type="button" aria-pressed={locale === 'en'} className={locale === 'en' ? 'is-active' : ''} onClick={() => switchLocale('en')}>
                EN
              </button>
              <button type="button" aria-pressed={locale === 'ar'} className={locale === 'ar' ? 'is-active' : ''} onClick={() => switchLocale('ar')}>
                عربي
              </button>
            </div>
            <Link href="/login" className="oma-lp-link-quiet">
              {t('landing.nav.login')}
            </Link>
            <Link href="/register" className="oma-lp-btn oma-lp-btn--dark oma-lp-btn--sm">
              {t('landing.nav.startFree')}
            </Link>
            <button
              type="button"
              className="oma-lp-burger"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('landing.nav.close') : t('landing.nav.menu')}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="oma-lp-burger-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className={`oma-lp-mobile${menuOpen ? ' is-open' : ''}`} hidden={!menuOpen}>
        <a href="#features" onClick={() => setMenuOpen(false)}>
          {t('landing.nav.features')}
        </a>
        <a href="#how" onClick={() => setMenuOpen(false)}>
          {t('landing.nav.how')}
        </a>
        <a href="#faq" onClick={() => setMenuOpen(false)}>
          {t('landing.nav.faq')}
        </a>
        <div className="oma-lp-mobile-actions">
          <Link href="/login" className="oma-lp-btn oma-lp-btn--ghost" onClick={() => setMenuOpen(false)}>
            {t('landing.nav.login')}
          </Link>
          <Link href="/register" className="oma-lp-btn oma-lp-btn--accent" onClick={() => setMenuOpen(false)}>
            {t('landing.nav.startFree')}
          </Link>
        </div>
      </div>

      <main id="main">
        <section className="oma-lp-hero">
          <div className="oma-lp-container oma-lp-hero-grid">
            <div>
              <span className="oma-lp-kicker">{t('landing.hero.kicker')}</span>
              <h1>{t('landing.hero.title')}</h1>
              <p className="oma-lp-hero-sub">{t('landing.hero.subtitle')}</p>
              <div className="oma-lp-hero-ctas">
                <Link href="/register" className="oma-lp-btn oma-lp-btn--accent">
                  {t('landing.hero.ctaPrimary')}
                </Link>
                <Link href="/login" className="oma-lp-btn oma-lp-btn--ghost">
                  {t('landing.hero.ctaSecondary')}
                </Link>
              </div>
            </div>
            <div className="oma-lp-hero-visual">
              <Image
                src="/landing/calendar.png"
                alt={t('landing.hero.visualAlt')}
                width={1280}
                height={800}
                priority
                sizes="(max-width: 900px) 100vw, 56vw"
              />
              <div className="oma-lp-float-card oma-lp-float-card--a" aria-hidden="true">
                ✓ {t('landing.tabs.approvals')}
              </div>
              <div className="oma-lp-float-card oma-lp-float-card--b" aria-hidden="true">
                {t('landing.tabs.calendar')}
              </div>
            </div>
          </div>
        </section>

        <section
          ref={manifesto.ref}
          className={`oma-lp-manifesto${manifesto.inView ? ' is-inview' : ''}`}
          aria-label={t('landing.manifesto.line1')}
        >
          <div className="oma-lp-container">
            <p className="oma-lp-manifesto-text">
              <span>{t('landing.manifesto.line1')} </span>
              <span>{t('landing.manifesto.line2')} </span>
              <span>{t('landing.manifesto.line3')}</span>
            </p>
          </div>
        </section>

        <section className="oma-lp-platforms" aria-labelledby="oma-lp-platforms-title">
          <div className="oma-lp-container">
            <h2 id="oma-lp-platforms-title">{t('landing.platforms.title')}</h2>
            <div className="oma-lp-platform-row">
              {platforms.map(({ name, Icon }) => (
                <span key={name} className="oma-lp-platform">
                  <Icon />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="oma-lp-tabs" id="product" aria-labelledby="oma-lp-tabs-title">
          <div className="oma-lp-container">
            <Reveal>
              <div className="oma-lp-section-head">
                <span className="oma-lp-kicker">{t('landing.tabs.kicker')}</span>
                <h2 id="oma-lp-tabs-title">{t('landing.tabs.title')}</h2>
              </div>
            </Reveal>

            <div className="oma-lp-tablist" role="tablist" aria-label={t('landing.tabs.title')}>
              {TAB_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className="oma-lp-tab"
                  aria-selected={tab === id}
                  id={`oma-lp-tab-${id}`}
                  aria-controls="oma-lp-tabpanel"
                  onClick={() => selectTab(id)}
                >
                  {t(`landing.tabs.${id}`)}
                </button>
              ))}
            </div>

            <div
              className="oma-lp-tabpanel"
              role="tabpanel"
              id="oma-lp-tabpanel"
              aria-labelledby={`oma-lp-tab-${tab}`}
            >
              <div className="oma-lp-tabpanel-copy">
                <h3>{t(tabTitleKey)}</h3>
                <ul className="oma-lp-bullets">
                  {tabBullets.map((text) => (
                    <li key={text}>
                      <BulletIcon />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="oma-lp-btn oma-lp-btn--accent">
                  {t('landing.tabs.cta')}
                </Link>
              </div>
              <div className="oma-lp-tabpanel-visual">
                <Image
                  src={TAB_IMAGES[tab].src}
                  alt={t(TAB_IMAGES[tab].altKey)}
                  width={1200}
                  height={750}
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
              </div>
            </div>
            <div key={progressKey} className="oma-lp-progress is-running" aria-hidden="true">
              <span />
            </div>
          </div>
        </section>

        <section className="oma-lp-features oma-lp-container" id="features">
          {features.map((f) => (
            <Reveal key={f.title}>
              <article
                className={`oma-lp-feature oma-lp-feature--${f.tone}${f.flip ? ' oma-lp-feature--flip' : ''}`}
              >
                <div className="oma-lp-feature-copy">
                  <h3>{f.title}</h3>
                  <ul className="oma-lp-bullets">
                    {f.bullets.map((b) => (
                      <li key={b}>
                        <BulletIcon />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="oma-lp-text-cta">
                    {f.cta}
                  </Link>
                </div>
                <div className="oma-lp-feature-visual">
                  <Image src={f.src} alt={f.alt} width={1100} height={700} loading="lazy" sizes="(max-width: 900px) 100vw, 50vw" />
                </div>
              </article>
            </Reveal>
          ))}
        </section>

        <section className="oma-lp-how" id="how" aria-labelledby="oma-lp-how-title">
          <div className="oma-lp-container">
            <Reveal>
              <div className="oma-lp-section-head">
                <span className="oma-lp-kicker">{t('landing.how.kicker')}</span>
                <h2 id="oma-lp-how-title">{t('landing.how.title')}</h2>
              </div>
            </Reveal>
            <div className="oma-lp-how-grid">
              {how.map((step, i) => (
                <Reveal key={step.title}>
                  <article className="oma-lp-how-card">
                    <div className="oma-lp-how-step">{i + 1}</div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="oma-lp-faq" id="faq" aria-labelledby="oma-lp-faq-title">
          <div className="oma-lp-container">
            <Reveal>
              <div className="oma-lp-section-head">
                <span className="oma-lp-kicker">{t('landing.faq.kicker')}</span>
                <h2 id="oma-lp-faq-title">{t('landing.faq.title')}</h2>
              </div>
            </Reveal>
            <div className="oma-lp-faq-list">
              {faqs.map((item) => (
                <details key={item.q} className="oma-lp-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="oma-lp-cta" aria-labelledby="oma-lp-cta-title">
          <div className="oma-lp-container">
            <div className="oma-lp-cta-band">
              <h2 id="oma-lp-cta-title">{t('landing.cta.title')}</h2>
              <p>{t('landing.cta.body')}</p>
              <div className="oma-lp-cta-actions">
                <Link href="/register" className="oma-lp-btn oma-lp-btn--accent">
                  {t('landing.cta.primary')}
                </Link>
                <Link href="/login" className="oma-lp-btn oma-lp-btn--ghost">
                  {t('landing.cta.secondary')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="oma-lp-footer">
        <div className="oma-lp-container oma-lp-footer-grid">
          <div className="oma-lp-footer-brand">
            <PlxLogo sub="by IMKAN" />
            <p className="oma-lp-footer-tag">{t('landing.footer.tagline')}</p>
          </div>
          <div>
            <h3>{t('landing.footer.product')}</h3>
            <ul>
              <li>
                <a href="#features">{t('landing.footer.features')}</a>
              </li>
              <li>
                <a href="#how">{t('landing.footer.how')}</a>
              </li>
              <li>
                <a href="#faq">{t('landing.footer.faq')}</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>{t('landing.footer.company')}</h3>
            <ul>
              <li>
                <Link href="/login">{t('landing.footer.login')}</Link>
              </li>
              <li>
                <Link href="/register">{t('landing.footer.signup')}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>{t('landing.footer.legal')}</h3>
            <ul>
              <li>
                <Link href="/terms">{t('landing.footer.terms')}</Link>
              </li>
              <li>
                <Link href="/privacy">{t('landing.footer.privacy')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="oma-lp-container oma-lp-footer-bottom">
          {t('landing.footer.copyright').replace('{year}', String(year))}
        </div>
      </footer>
    </div>
  );
}
