'use client';

import Image from 'next/image';
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
import { SHOT_SIZES, type ShotId } from './landing-shots';
import {
  FacebookGlyph,
  InstagramGlyph,
  LinkedInGlyph,
  TikTokGlyph,
  XGlyph,
} from './platform-icons';
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
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
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

function Chip({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'blue' | 'gray';
  children: ReactNode;
}) {
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

/** A real screenshot of the OMA app, framed like a product card. */
function Shot({
  id,
  locale,
  c,
  priority = false,
  sizes,
}: {
  id: ShotId;
  locale: 'ar' | 'en';
  c: LandingCopy;
  priority?: boolean;
  sizes: string;
}) {
  const [w, h] = SHOT_SIZES[id][locale];
  return (
    <figure className={`oma-pl-shot oma-pl-shot--${id}`}>
      <Image
        src={`/landing/real/${id}-${locale}.webp`}
        alt={c.shots[id]}
        width={w}
        height={h}
        sizes={sizes}
        priority={priority}
        unoptimized
        draggable={false}
      />
    </figure>
  );
}

const SPLIT_SHOT: Record<string, ShotId> = {
  comments: 'comments',
  approvals: 'approvals',
  channels: 'composer',
  drive: 'drive',
};
const WORKFLOW_IDS = ['requests', 'tasks', 'deliverables'] as const;
type WorkflowId = (typeof WORKFLOW_IDS)[number];
const BENTO_SHOT: Partial<Record<string, ShotId>> = {
  analytics: 'analytics',
  roles: 'team',
  notify: 'notifications',
};
const SPLIT_SIZES = '(max-width: 767px) 100vw, 720px';

/* ─────────────────────────── Page ─────────────────────────── */

export function LandingPage() {
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const c = LANDING_COPY[locale];
  const router = useRouter();
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<ViewId>('calendar');
  const [flow, setFlow] = useState<WorkflowId>('requests');
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
      `${v(L.social_accounts ?? L.social_channels)} ${c.pricing.social}`,
      `${v(L.seats)} ${c.pricing.seats}`,
      `${v(L.scheduled_posts_per_month ?? L.posts_per_month)} ${c.pricing.posts}`,
      `${v(L.ai_credits_per_month ?? L.ai_runs_per_month)} ${c.pricing.credits}`,
      `${v(L.listening_keywords)} ${c.pricing.keywords}`,
      `${v(L.mentions_per_month)} ${c.pricing.mentions}`,
    ];
    return lines;
  };

  return (
    <div
      className={`oma-pl-root ${jakarta.variable}`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      data-testid="landing-page"
    >
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
            <button
              type="button"
              className="oma-pl-nav__lang"
              onClick={switchLocale}
              data-testid="landing-lang"
            >
              {c.nav.lang}
            </button>
            <span className="oma-pl-nav__sep" aria-hidden="true" />
            <Link href="/login" className="oma-pl-nav__login" data-testid="landing-login">
              {c.nav.login}
            </Link>
            <Link
              href="/register"
              className="oma-pl-btn oma-pl-btn--dark"
              data-testid="landing-signup"
            >
              {c.nav.start}
            </Link>
          </div>
          <button
            type="button"
            className="oma-pl-burger"
            aria-label={menuOpen ? c.nav.close : c.nav.menu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
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
              <Shot
                id="hero"
                locale={locale}
                c={c}
                priority
                sizes="(max-width: 767px) 100vw, 760px"
              />
            </div>
          </div>
        </section>

        {/* CHANNELS (social proof strip) */}
        <section className="oma-pl-channels" aria-label={c.channels}>
          <p>{c.channels}</p>
          <div className="oma-pl-marquee">
            <div className="oma-pl-marquee__track">
              {[...CHANNELS, ...CHANNELS, ...CHANNELS].map(({ id, name, Icon }, i) => (
                <span
                  key={`${id}-${i}`}
                  className="oma-pl-marquee__item"
                  aria-hidden={i >= CHANNELS.length}
                >
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
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  className={view === id ? 'is-on' : ''}
                  onClick={() => setView(id)}
                >
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
                <Shot id={`view-${view}`} locale={locale} c={c} sizes={SPLIT_SIZES} />
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
                      {SPLIT_SHOT[s.id] ? (
                        <Shot id={SPLIT_SHOT[s.id]!} locale={locale} c={c} sizes={SPLIT_SIZES} />
                      ) : null}
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
            <div className="oma-pl-tabs oma-pl-tabs--flow" role="tablist">
              {WORKFLOW_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={flow === id}
                  className={flow === id ? 'is-on' : ''}
                  onClick={() => setFlow(id)}
                >
                  {c.workflowTabs[id]}
                </button>
              ))}
            </div>
            <div className="oma-pl-flow" role="tabpanel" key={flow}>
              <Shot id={flow} locale={locale} c={c} sizes="(max-width: 767px) 100vw, 1024px" />
            </div>
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
              {(Object.keys(c.bento.items) as (keyof LandingCopy['bento']['items'])[]).map(
                (k, i) => (
                  <div
                    key={k}
                    className={`oma-pl-bento__card oma-pl-bento__card--${k}${BENTO_SHOT[k] ? ' has-shot' : ''}`}
                    data-i={i}
                  >
                    <h3>{c.bento.items[k]}</h3>
                    {BENTO_SHOT[k] ? (
                      <Shot
                        id={BENTO_SHOT[k]!}
                        locale={locale}
                        c={c}
                        sizes="(max-width: 767px) 100vw, 560px"
                      />
                    ) : (
                      <span className="oma-pl-bento__art" aria-hidden="true">
                        {k === 'campaigns' ? (
                          <>
                            <Chip tone="gray">{c.mock.draft}</Chip>
                            <Chip tone="amber">{c.mock.inReview}</Chip>
                            <Chip tone="green">{c.mock.approved}</Chip>
                          </>
                        ) : null}
                        {k === 'ai' ? <span className="oma-pl-ai">✦ {c.mock.caption}</span> : null}
                        {k === 'composer' ? (
                          <ChannelDots ids={['tiktok', 'instagram', 'facebook', 'linkedin', 'x']} />
                        ) : null}
                      </span>
                    )}
                  </div>
                ),
              )}
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
              <button
                type="button"
                className={!yearly ? 'is-on' : ''}
                aria-pressed={!yearly}
                onClick={() => setYearly(false)}
              >
                {c.pricing.monthly}
              </button>
              <button
                type="button"
                className={yearly ? 'is-on' : ''}
                aria-pressed={yearly}
                onClick={() => setYearly(true)}
              >
                {c.pricing.yearly}
              </button>
            </div>
            <div className="oma-pl-plans">
              {PLAN_CODES.map((code) => {
                const p = PLAN_CATALOG[code];
                const price = yearly ? p.priceYearlyPerMonthUsd : p.priceMonthlyUsd;
                const featured = code === 'pro';
                return (
                  <div
                    key={code}
                    className={`oma-pl-plan${featured ? ' is-featured' : ''}`}
                    data-testid={`landing-plan-${code}`}
                  >
                    {featured ? (
                      <span className="oma-pl-plan__badge">{c.pricing.popular}</span>
                    ) : null}
                    <h3>{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                    <p className="oma-pl-plan__desc">
                      {locale === 'ar' ? p.descriptionAr : p.descriptionEn}
                    </p>
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
                    <Link
                      href="/register"
                      className={`oma-pl-btn ${featured ? 'oma-pl-btn--green' : 'oma-pl-btn--outline'}`}
                    >
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
                <button
                  type="button"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
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
