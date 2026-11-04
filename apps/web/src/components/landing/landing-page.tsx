'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLAN_CATALOG, PLAN_CODES, type PlanCode } from '@oma/domain/browser';
import { PlxLogo } from '../ui/plx-icons';
import { useLocale } from '../../lib/use-locale';
import { setLocaleCookie, updateProfile } from '../../lib/account-api';
import { useInView } from './use-inview';
import { LANDING_COPY, type LandingCopy } from './landing-copy';
import { FacebookGlyph, InstagramGlyph, LinkedInGlyph, TikTokGlyph, XGlyph } from './platform-icons';
import './landing.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-oma-pl',
  display: 'swap',
});

const VIEW_IDS = ['calendar', 'feed', 'grid', 'list'] as const;
type ViewId = (typeof VIEW_IDS)[number];

const CHANNELS = [
  { id: 'tiktok', name: 'TikTok', Icon: TikTokGlyph },
  { id: 'instagram', name: 'Instagram', Icon: InstagramGlyph },
  { id: 'facebook', name: 'Facebook', Icon: FacebookGlyph },
  { id: 'linkedin', name: 'LinkedIn', Icon: LinkedInGlyph },
  { id: 'x', name: 'X', Icon: XGlyph },
] as const;

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`oma-pl-reveal${inView ? ' is-in' : ''} ${className}`.trim()}>
      {children}
    </div>
  );
}

function Ico({ d }: { d: string }) {
  return (
    <span className="oma-pl-ico" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const ICONS = [
  'M20 6 9 17l-5-5',
  'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  'M4 6h16M4 12h10M4 18h6',
];

function Bullets({ items }: { items: readonly (readonly string[])[] }) {
  return (
    <ul className="oma-pl-bullets">
      {items.map(([strong = '', rest = ''], i) => (
        <li key={strong}>
          <Ico d={ICONS[i % ICONS.length]!} />
          <span>
            <strong>{strong}</strong>
            {rest}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Product visuals built from OMA UI patterns ───────────── */

function Chip({ tone, children }: { tone: 'green' | 'amber' | 'blue' | 'gray'; children: ReactNode }) {
  return <span className={`oma-pl-chip oma-pl-chip--${tone}`}>{children}</span>;
}

function ChannelDots({ ids }: { ids: readonly string[] }) {
  return (
    <span className="oma-pl-dots">
      {CHANNELS.filter((c) => ids.includes(c.id)).map(({ id, Icon }) => (
        <span key={id} className={`oma-pl-dot oma-pl-dot--${id}`}>
          <Icon />
        </span>
      ))}
    </span>
  );
}

function Thumb({ hue }: { hue: number }) {
  return <span className="oma-pl-thumb" style={{ ['--h' as string]: hue }} aria-hidden="true" />;
}

function PostCard({ title, ids, hue, chip }: { title: string; ids: string[]; hue: number; chip?: ReactNode }) {
  return (
    <div className="oma-pl-post">
      <span className="oma-pl-post__title">{title}</span>
      <ChannelDots ids={ids} />
      <Thumb hue={hue} />
      {chip}
    </div>
  );
}

function AppFrame({ c, children, active }: { c: LandingCopy; children: ReactNode; active: string }) {
  const side = [c.mock.search, c.mock.content, c.mock.approvals, c.mock.campaigns, c.mock.analytics, c.mock.drive];
  return (
    <div className="oma-pl-app" aria-hidden="true">
      <aside className="oma-pl-app__side">
        <span className="oma-pl-app__brand">
          <PlxLogo sub={null} compact />
        </span>
        {side.map((s) => (
          <span key={s} className={`oma-pl-app__nav${s === active ? ' is-on' : ''}`}>
            {s}
          </span>
        ))}
        <span className="oma-pl-app__sec">{c.mock.brands}</span>
        {CHANNELS.slice(0, 4).map(({ id, name, Icon }) => (
          <span key={id} className="oma-pl-app__nav">
            <span className={`oma-pl-dot oma-pl-dot--${id}`}>
              <Icon />
            </span>
            {name}
          </span>
        ))}
      </aside>
      <div className="oma-pl-app__main">{children}</div>
    </div>
  );
}

function CalendarMock({ c, menu = false }: { c: LandingCopy; menu?: boolean }) {
  const days = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  return (
    <AppFrame c={c} active={c.mock.content}>
      <div className="oma-pl-app__bar">
        <span>
          {c.mock.content} / <b>{c.mock.calendar}</b>
        </span>
        <span className="oma-pl-seg">
          <span className="is-on">{c.mock.week}</span>
          <span>{c.mock.month}</span>
        </span>
      </div>
      <div className="oma-pl-cal">
        {days.map((d, i) => (
          <div key={d} className="oma-pl-cal__cell">
            <span className="oma-pl-cal__num">{d}</span>
            {i === 0 ? <PostCard title={c.mock.post1} ids={['tiktok', 'instagram']} hue={28} chip={<Chip tone="green">{c.mock.approved}</Chip>} /> : null}
            {i === 1 ? <PostCard title={c.mock.post2} ids={['instagram']} hue={200} chip={<Chip tone="amber">{c.mock.inReview}</Chip>} /> : null}
            {i === 3 ? <PostCard title={c.mock.post3} ids={['linkedin', 'x']} hue={140} chip={<Chip tone="blue">{c.mock.scheduled}</Chip>} /> : null}
            {i === 6 ? <PostCard title={c.mock.post4} ids={['facebook', 'tiktok']} hue={330} chip={<Chip tone="gray">{c.mock.draft}</Chip>} /> : null}
          </div>
        ))}
      </div>
      {menu ? (
        <div className="oma-pl-menu">
          <span>✓ {c.mock.approve}</span>
          <span>◷ {c.mock.schedule}</span>
          <span>↺ {c.mock.requestChanges}</span>
        </div>
      ) : null}
    </AppFrame>
  );
}

function FeedMock({ c }: { c: LandingCopy }) {
  return (
    <div className="oma-pl-feed" aria-hidden="true">
      <div className="oma-pl-phone">
        <div className="oma-pl-phone__head">
          <span className="oma-pl-dot oma-pl-dot--tiktok"><TikTokGlyph /></span>
          <b>OMA</b>
          <Chip tone="amber">{c.mock.inReview}</Chip>
        </div>
        <Thumb hue={12} />
        <p>{c.mock.caption}</p>
      </div>
      <div className="oma-pl-bubble">
        <b>@{c.mock.level2}</b> {c.mock.comment}
      </div>
      <div className="oma-pl-bubble oma-pl-bubble--2">
        <b>@{c.mock.level1}</b> {c.mock.reply}
      </div>
    </div>
  );
}

function GridMock() {
  const hues = [20, 200, 140, 330, 45, 260, 170, 0, 90];
  return (
    <div className="oma-pl-grid" aria-hidden="true">
      {hues.map((h) => (
        <Thumb key={h} hue={h} />
      ))}
    </div>
  );
}

function ListMock({ c }: { c: LandingCopy }) {
  const rows: [string, string[], ReactNode][] = [
    [c.mock.post1, ['tiktok', 'instagram'], <Chip key="a" tone="green">{c.mock.approved}</Chip>],
    [c.mock.post2, ['instagram'], <Chip key="b" tone="amber">{c.mock.inReview}</Chip>],
    [c.mock.post3, ['linkedin', 'x'], <Chip key="c" tone="blue">{c.mock.scheduled}</Chip>],
    [c.mock.post4, ['facebook'], <Chip key="d" tone="gray">{c.mock.draft}</Chip>],
  ];
  return (
    <div className="oma-pl-list" aria-hidden="true">
      {rows.map(([t, ids, chip], i) => (
        <div key={t} className="oma-pl-list__row">
          <Thumb hue={i * 70 + 20} />
          <b>{t}</b>
          <ChannelDots ids={ids} />
          {chip}
        </div>
      ))}
    </div>
  );
}

function SplitVisual({ id, c }: { id: string; c: LandingCopy }) {
  if (id === 'comments') return <FeedMock c={c} />;
  if (id === 'approvals') {
    const steps = [c.mock.level1, c.mock.level2, c.mock.level3];
    return (
      <div className="oma-pl-chain" aria-hidden="true">
        {steps.map((s, i) => (
          <div key={s} className="oma-pl-chain__step" data-done={i < 2 ? 'true' : 'false'}>
            <span className="oma-pl-chain__dot">{i < 2 ? '✓' : i + 1}</span>
            <span>{s}</span>
            <Chip tone={i < 2 ? 'green' : 'amber'}>{i < 2 ? c.mock.approved : c.mock.inReview}</Chip>
          </div>
        ))}
      </div>
    );
  }
  if (id === 'channels') {
    return (
      <div className="oma-pl-chan" aria-hidden="true">
        {CHANNELS.map(({ id: cid, name, Icon }, i) => (
          <div key={cid} className="oma-pl-chan__card">
            <span className={`oma-pl-dot oma-pl-dot--${cid}`}>
              <Icon />
            </span>
            <b>{name}</b>
            <Thumb hue={i * 60 + 10} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="oma-pl-drive" aria-hidden="true">
      {[
        [c.mock.images, 128, 210],
        [c.mock.videos, 42, 10],
        [c.mock.docs, 17, 140],
      ].map(([n, count, h]) => (
        <div key={String(n)} className="oma-pl-drive__folder">
          <span className="oma-pl-drive__tab" style={{ ['--h' as string]: h }} />
          <b>{n}</b>
          <span>
            {count} {c.mock.files}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export function LandingPage() {
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const c = LANDING_COPY[locale];
  const router = useRouter();
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<ViewId>('calendar');
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const manifestoRef = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 8);
      const el = manifestoRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        setProgress(p);
      }
    };
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

  const switchLocale = useCallback(() => {
    const next = locale === 'ar' ? 'en' : 'ar';
    setLocaleCookie(next);
    void updateProfile({ preferredLocale: next }).catch(() => undefined);
    router.refresh();
  }, [locale, router]);

  const words = c.manifesto.rest.split(' ');
  const lit = Math.round(progress * words.length);
  const year = new Date().getFullYear();
  const navLinks = [
    ['#features', c.nav.features],
    ['#workflow', c.nav.workflow],
    ['#pricing', c.nav.pricing],
    ['#faq', c.nav.faq],
  ] as const;

  const fmtNum = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en').format(n);
  const planLines = (code: PlanCode) => {
    const p = PLAN_CATALOG[code];
    const L = p.limits;
    const v = (n: number | null) => (n == null ? c.pricing.unlimited : fmtNum(n));
    const lines = [
      `${v(L.brands)} ${c.pricing.brands}`,
      `${v(L.seats)} ${c.pricing.seats}`,
      L.posts_total != null ? `${fmtNum(L.posts_total)} ${c.pricing.postsTotal}` : `${v(L.posts_per_month)} ${c.pricing.posts}`,
      `${fmtNum(Math.round(Number(L.storage_bytes ?? 0) / 1024 ** 3))} ${c.pricing.storage}`,
      `${fmtNum(Number(L.approval_level ?? 1))} ${Number(L.approval_level ?? 1) > 1 ? c.pricing.levels : c.pricing.level}`,
    ];
    return lines;
  };

  return (
    <div className={`oma-pl-root ${jakarta.variable}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} data-testid="landing-page">
      {/* NAV */}
      <header className={`oma-pl-nav${stuck ? ' is-stuck' : ''}`}>
        <div className="oma-pl-wrap oma-pl-nav__in">
          <Link href="/" className="oma-pl-logo" aria-label="OMA">
            <PlxLogo sub="by IMKAN" />
          </Link>
          <nav className="oma-pl-nav__links" aria-label={c.nav.menu}>
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className="oma-pl-nav__end">
            <button type="button" className="oma-pl-nav__lang" onClick={switchLocale} data-testid="landing-lang">
              {c.nav.lang}
            </button>
            <span className="oma-pl-nav__sep" aria-hidden="true" />
            <Link href="/login" className="oma-pl-nav__login" data-testid="landing-login">
              {c.nav.login}
            </Link>
            <Link href="/register" className="oma-pl-btn oma-pl-btn--dark" data-testid="landing-signup">
              {c.nav.start}
            </Link>
          </div>
          <button type="button" className="oma-pl-burger" aria-label={menuOpen ? c.nav.close : c.nav.menu} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </div>
        {menuOpen ? (
          <div className="oma-pl-sheet">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <button type="button" onClick={switchLocale}>
              {c.nav.lang}
            </button>
            <Link href="/login" className="oma-pl-btn oma-pl-btn--outline">
              {c.nav.login}
            </Link>
            <Link href="/register" className="oma-pl-btn oma-pl-btn--green">
              {c.nav.start}
            </Link>
          </div>
        ) : null}
      </header>

      <main>
        {/* HERO */}
        <section className="oma-pl-hero">
          <div className="oma-pl-wrap oma-pl-hero__in">
            <div className="oma-pl-hero__copy">
              <h1>{c.hero.title}</h1>
              <p>{c.hero.sub}</p>
              <div className="oma-pl-hero__ctas">
                <Link href="/register" className="oma-pl-btn oma-pl-btn--green oma-pl-btn--lg">
                  {c.hero.primary}
                </Link>
                <Link href="/login" className="oma-pl-btn oma-pl-btn--outline oma-pl-btn--lg">
                  {c.hero.secondary}
                </Link>
              </div>
            </div>
            <div className="oma-pl-hero__visual">
              <span className="oma-pl-hero__glow" aria-hidden="true" />
              <CalendarMock c={c} menu />
            </div>
          </div>
        </section>

        {/* CHANNELS (social proof strip) */}
        <section className="oma-pl-channels" aria-label={c.channels}>
          <p>{c.channels}</p>
          <div className="oma-pl-marquee">
            <div className="oma-pl-marquee__track">
              {[...CHANNELS, ...CHANNELS, ...CHANNELS].map(({ id, name, Icon }, i) => (
                <span key={`${id}-${i}`} className="oma-pl-marquee__item" aria-hidden={i >= CHANNELS.length}>
                  <Icon />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* MANIFESTO */}
        <section className="oma-pl-manifesto">
          <div className="oma-pl-wrap">
            <p ref={manifestoRef}>
              <span className="is-lit">{c.manifesto.lead} </span>
              {words.map((w, i) => (
                <span key={i} className={i < lit ? 'is-lit' : ''}>
                  {w}{' '}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* VIEWS */}
        <section className="oma-pl-sec" id="features">
          <div className="oma-pl-wrap">
            <Reveal>
              <h2 className="oma-pl-h2 oma-pl-center">{c.views.title}</h2>
            </Reveal>
            <div className="oma-pl-tabs" role="tablist">
              {VIEW_IDS.map((id) => (
                <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'is-on' : ''} onClick={() => setView(id)}>
                  {c.views.tabs[id]}
                </button>
              ))}
            </div>
            <div className="oma-pl-split oma-pl-split--mint oma-pl-split--views" role="tabpanel">
              <div className="oma-pl-split__panel">
                <h3>{c.views[view].h}</h3>
                <Bullets items={c.views[view].b} />
              </div>
              <div className="oma-pl-split__visual" key={view}>
                {view === 'calendar' ? <CalendarMock c={c} /> : null}
                {view === 'feed' ? <FeedMock c={c} /> : null}
                {view === 'grid' ? <GridMock /> : null}
                {view === 'list' ? <ListMock c={c} /> : null}
              </div>
            </div>
            <div className="oma-pl-center oma-pl-mt">
              <Link href="/register" className="oma-pl-btn oma-pl-btn--green oma-pl-btn--lg">
                {c.views.cta}
              </Link>
            </div>
          </div>
        </section>

        {/* FEEDBACK + SPLITS */}
        <section className="oma-pl-sec">
          <div className="oma-pl-wrap">
            <Reveal>
              <h2 className="oma-pl-h2 oma-pl-h2--xl oma-pl-center">{c.feedbackTitle}</h2>
            </Reveal>
            <div className="oma-pl-splits">
              {c.split.map((s, i) => (
                <Reveal key={s.id}>
                  <div className={`oma-pl-split oma-pl-split--${s.tone}${i % 2 ? ' is-flip' : ''}`}>
                    <div className="oma-pl-split__panel">
                      <h3>{s.h}</h3>
                      <Bullets items={s.b} />
                      <Link href="/register" className="oma-pl-link">
                        {c.splitCta}
                      </Link>
                    </div>
                    <div className="oma-pl-split__visual">
                      <SplitVisual id={s.id} c={c} />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="oma-pl-sec" id="workflow">
          <div className="oma-pl-wrap">
            <Reveal>
              <h2 className="oma-pl-h2 oma-pl-center">{c.workflow.title}</h2>
              <p className="oma-pl-lede oma-pl-center">{c.workflow.sub}</p>
            </Reveal>
            <ol className="oma-pl-steps">
              {c.workflow.steps.map(([h, p], i) => (
                <li key={h}>
                  <span className="oma-pl-steps__n">{fmtNum(i + 1)}</span>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* HELP */}
        <section className="oma-pl-help">
          <span className="oma-pl-help__ico" aria-hidden="true">
            <PlxLogo sub={null} compact />
          </span>
          <h2 className="oma-pl-h2">{c.help.title}</h2>
          <p className="oma-pl-lede">{c.help.sub}</p>
          <Link href="/register" className="oma-pl-btn oma-pl-btn--green oma-pl-btn--lg">
            {c.help.cta}
          </Link>
        </section>

        {/* BENTO */}
        <section className="oma-pl-sec">
          <div className="oma-pl-wrap">
            <Reveal>
              <h2 className="oma-pl-h2 oma-pl-center">{c.bento.title}</h2>
            </Reveal>
            <div className="oma-pl-bento">
              {(Object.keys(c.bento.items) as (keyof LandingCopy['bento']['items'])[]).map((k, i) => (
                <div key={k} className={`oma-pl-bento__card oma-pl-bento__card--${k}`} data-i={i}>
                  <h3>{c.bento.items[k]}</h3>
                  <span className="oma-pl-bento__art" aria-hidden="true">
                    {k === 'campaigns' ? (
                      <>
                        <Chip tone="gray">{c.mock.draft}</Chip>
                        <Chip tone="amber">{c.mock.inReview}</Chip>
                        <Chip tone="green">{c.mock.approved}</Chip>
                      </>
                    ) : null}
                    {k === 'ai' ? <span className="oma-pl-ai">✦ {c.mock.caption}</span> : null}
                    {k === 'composer' ? <ChannelDots ids={['tiktok', 'instagram', 'facebook', 'linkedin', 'x']} /> : null}
                    {k === 'analytics' ? (
                      <span className="oma-pl-bars">
                        {[40, 64, 52, 80, 70, 92].map((h, j) => (
                          <i key={j} style={{ height: `${h}%` }} />
                        ))}
                      </span>
                    ) : null}
                    {k === 'roles' ? (
                      <span className="oma-pl-roles">
                        {['M', 'E', 'A', 'V'].map((r) => (
                          <i key={r}>{r}</i>
                        ))}
                      </span>
                    ) : null}
                    {k === 'notify' ? <span className="oma-pl-ai">● {c.mock.approve}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* USE CASES (in place of testimonials) */}
        <section className="oma-pl-sec">
          <div className="oma-pl-wrap oma-pl-cases">
            <h2 className="oma-pl-h2">{c.useCases.title}</h2>
            <div className="oma-pl-cases__row">
              {c.useCases.items.map(([h, p]) => (
                <article key={h} className="oma-pl-case">
                  <h3>{h}</h3>
                  <p>{p}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="oma-pl-sec" id="pricing">
          <div className="oma-pl-wrap">
            <h2 className="oma-pl-h2 oma-pl-center">{c.pricing.title}</h2>
            <p className="oma-pl-lede oma-pl-center">{c.pricing.sub}</p>
            <div className="oma-pl-tabs oma-pl-tabs--sm" role="group">
              <button type="button" className={!yearly ? 'is-on' : ''} aria-pressed={!yearly} onClick={() => setYearly(false)}>
                {c.pricing.monthly}
              </button>
              <button type="button" className={yearly ? 'is-on' : ''} aria-pressed={yearly} onClick={() => setYearly(true)}>
                {c.pricing.yearly}
              </button>
            </div>
            <div className="oma-pl-plans">
              {PLAN_CODES.map((code) => {
                const p = PLAN_CATALOG[code];
                const price = yearly ? p.priceYearlyPerMonthUsd : p.priceMonthlyUsd;
                const featured = code === 'pro';
                return (
                  <div key={code} className={`oma-pl-plan${featured ? ' is-featured' : ''}`} data-testid={`landing-plan-${code}`}>
                    {featured ? <span className="oma-pl-plan__badge">{c.pricing.popular}</span> : null}
                    <h3>{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                    <p className="oma-pl-plan__desc">{locale === 'ar' ? p.descriptionAr : p.descriptionEn}</p>
                    <p className="oma-pl-plan__price">
                      {price == null ? (
                        c.pricing.contact
                      ) : (
                        <>
                          <b dir="ltr">${fmtNum(price)}</b>
                          <span>{c.pricing.perMonth}</span>
                        </>
                      )}
                    </p>
                    <ul>
                      {planLines(code).map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <Link href="/register" className={`oma-pl-btn ${featured ? 'oma-pl-btn--green' : 'oma-pl-btn--outline'}`}>
                      {price == null ? c.pricing.ctaContact : c.pricing.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="oma-pl-note oma-pl-center">{c.pricing.note}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="oma-pl-sec" id="faq">
          <div className="oma-pl-wrap oma-pl-faq">
            <h2 className="oma-pl-h2 oma-pl-center">{c.faq.title}</h2>
            {c.faq.items.map(([q, a], i) => (
              <div key={q} className={`oma-pl-faq__item${openFaq === i ? ' is-open' : ''}`}>
                <button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{q}</span>
                  <span className="oma-pl-faq__plus" aria-hidden="true" />
                </button>
                <div className="oma-pl-faq__a" hidden={openFaq !== i}>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FINAL CTA + FOOTER */}
      <footer className="oma-pl-dark">
        <div className="oma-pl-wrap oma-pl-final">
          <h2>{c.final.title}</h2>
          <p>{c.final.sub}</p>
          <div className="oma-pl-hero__ctas oma-pl-center-row">
            <Link href="/register" className="oma-pl-btn oma-pl-btn--mint oma-pl-btn--lg">
              {c.final.primary}
            </Link>
            <Link href="/login" className="oma-pl-btn oma-pl-btn--ghost oma-pl-btn--lg">
              {c.final.secondary}
            </Link>
          </div>
        </div>
        <div className="oma-pl-wrap oma-pl-foot">
          <div className="oma-pl-foot__top">
            <PlxLogo sub="by IMKAN" />
            <span>{c.footer.tagline}</span>
          </div>
          <div className="oma-pl-foot__cols">
            <div>
              <h4>{c.footer.product}</h4>
              {navLinks.map(([href, label]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
            </div>
            <div>
              <h4>{c.footer.account}</h4>
              <Link href="/login">{c.nav.login}</Link>
              <Link href="/register">{c.footer.signup}</Link>
              <Link href="/forgot-password">{c.footer.reset}</Link>
            </div>
            <div>
              <h4>{c.footer.language}</h4>
              <button type="button" onClick={switchLocale}>
                {c.nav.lang}
              </button>
            </div>
          </div>
          <p className="oma-pl-foot__copy">
            © {year} OMA by IMKAN. {c.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  );
}
