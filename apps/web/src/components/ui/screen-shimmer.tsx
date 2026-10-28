'use client';

/**
 * Screen shimmers — ONE loading skeleton per screen.
 *
 * Each skeleton mirrors the real layout of its screen (same page wrapper, header, toolbar,
 * cards, columns, media blocks), and the SAME component is used by:
 *   1. the membership route gate (first paint, before the workspace session resolves),
 *   2. the route's `dynamic()` / Suspense fallback (while the page chunk downloads),
 *   3. the client component while its data request is in flight.
 * So a screen never flashes an "old" generic skeleton followed by a "new" one: the user sees a
 * single continuous shimmer that is replaced by the real content in place.
 *
 * All bones share one synchronized light sweep (`.oma-shim`, states.css) — RTL aware and
 * static under `prefers-reduced-motion`.
 */

import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useT } from '../../lib/use-locale';

const noopSubscribe = () => () => undefined;

/**
 * Read a browser-only preference (URL / storage) without a hydration mismatch: the server and
 * the hydration pass use `fallback`, the client then renders the stored value immediately.
 */
function useClientPref<T>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => fallback);
}

type BoneProps = {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** A single shimmering placeholder block. */
export function Bone({ w, h = 12, r, className, style }: BoneProps) {
  return (
    <span
      aria-hidden="true"
      className={['oma-shim', className].filter(Boolean).join(' ')}
      style={{
        inlineSize: typeof w === 'number' ? `${w}px` : w,
        blockSize: typeof h === 'number' ? `${h}px` : h,
        borderRadius: typeof r === 'number' ? `${r}px` : r,
        ...style,
      }}
    />
  );
}

function ShimmerRoot({
  screen,
  className,
  children,
  label,
}: {
  screen: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const t = useT();
  return (
    <div
      className={['oma-shim-screen', className].filter(Boolean).join(' ')}
      data-shimmer={screen}
      data-testid={`${screen}-shimmer`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="oma-sr-only">{label ?? t('common.loading')}</span>
      {children}
    </div>
  );
}

/** Page title + subtitle placeholder in the shared `PageHeader` geometry. */
function HeaderBones({ title = 180, sub = 340, kicker = false }: { title?: number; sub?: number; kicker?: boolean }) {
  return (
    <header className="oma-page-header oma-page-header-stack oma-shim-header" aria-hidden="true">
      <div className="oma-shim-header__copy">
        {kicker ? <Bone w={72} h={12} /> : null}
        <Bone w={title} h={24} r={6} />
        <Bone w={sub} h={14} />
      </div>
    </header>
  );
}

function TabBones({ widths }: { widths: number[] }) {
  return (
    <div className="oma-shim-tabs" aria-hidden="true">
      {widths.map((w, i) => (
        <Bone key={i} w={w} h={30} r={8} className={i === 0 ? 'oma-shim--strong' : undefined} />
      ))}
    </div>
  );
}

/**
 * `page`: the whole screen (route gate / chunk fallback — nothing real is on screen yet).
 * `body`: only the data area, rendered by the screen itself under its real header/toolbar while
 * the data request is in flight, so the header never shimmers twice.
 */
export type ShimmerPart = 'page' | 'body';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* -------------------------------------------------------------------------------------------- */
/* Content calendar (calendar / feed / grid / list)                                             */
/* -------------------------------------------------------------------------------------------- */

export type ContentShimmerView = 'calendar' | 'feed' | 'grid' | 'list';

const CONTENT_VIEW_KEY = 'oma-demo-content-view';

/** Same view the content page will open with (URL → session pref → calendar). */
export function initialContentShimmerView(): ContentShimmerView {
  if (typeof window === 'undefined') return 'calendar';
  const ok = (v: string | null): v is ContentShimmerView =>
    v === 'calendar' || v === 'feed' || v === 'grid' || v === 'list';
  try {
    const url = new URLSearchParams(window.location.search).get('view');
    if (ok(url)) return url;
    const stored = window.sessionStorage.getItem(CONTENT_VIEW_KEY);
    if (ok(stored)) return stored;
  } catch {
    /* private mode */
  }
  return 'calendar';
}

/** Cells that hold a post card in the calendar shimmer (stable, looks like a real plan). */
const CAL_POSTS = new Set([2, 4, 8, 12, 15, 17, 22, 26, 29, 31]);

/**
 * `embedded`: rendered inside the content page's own `.oma-content-plan` wrapper (data loading);
 * otherwise the shimmer carries that wrapper itself so the shell drops its padding the same way.
 */
export function ContentShimmer({ view, embedded = false }: { view?: ContentShimmerView; embedded?: boolean }) {
  const pref = useClientPref(initialContentShimmerView, 'calendar');
  const v = view ?? pref;
  return (
    <ShimmerRoot
      screen="content"
      className={
        embedded ? 'oma-shim-content' : 'oma-stack oma-content-plan oma-content-plan--tight oma-shim-content'
      }
    >
      {v === 'calendar' ? <ContentCalendarBones /> : null}
      {v === 'feed' ? <ContentFeedBones /> : null}
      {v === 'grid' ? <ContentGridBones /> : null}
      {v === 'list' ? <ContentListBones /> : null}
    </ShimmerRoot>
  );
}

function ContentCalendarBones() {
  return (
    <div className="oma-shim-cal" data-view="calendar">
      <div className="oma-shim-cal__main">
        <div className="oma-shim-cal__toolbar">
          <div className="oma-shim-row">
            <Bone w={122} h={30} r={8} />
            <Bone w={20} h={20} r={6} />
            <Bone w={20} h={20} r={6} />
            <Bone w={86} h={18} r={6} />
            <Bone w={54} h={26} r={6} />
          </div>
          <div className="oma-shim-row">
            <Bone w={132} h={16} />
            <Bone w={30} h={30} r={8} />
            <Bone w={88} h={30} r={8} />
          </div>
        </div>
        <div className="oma-shim-cal__dow">
          {range(7).map((i) => (
            <Bone key={i} w={28} h={8} />
          ))}
        </div>
        <div className="oma-shim-cal__grid">
          {range(35).map((i) => (
            <div key={i} className="oma-shim-cal__cell">
              <Bone w={16} h={11} />
              {CAL_POSTS.has(i) ? (
                <div className="oma-shim-cal__post">
                  <div className="oma-shim-row">
                    <Bone w={12} h={12} r={3} />
                    <Bone w={44} h={9} />
                  </div>
                  <Bone className="oma-shim-cal__media" r={6} />
                  <Bone w="80%" h={9} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <aside className="oma-shim-cal__saved">
        <div className="oma-shim-row oma-shim-row--between">
          <Bone w={52} h={16} />
          <Bone w={20} h={20} r={6} />
        </div>
        <div className="oma-shim-cal__saved-empty">
          <Bone w={90} h={72} r={14} />
          <Bone w={128} h={14} />
          <Bone w={180} h={10} />
          <Bone w={150} h={10} />
          <Bone w={124} h={32} r={8} />
        </div>
      </aside>
    </div>
  );
}

function StoriesBones({ count = 6 }: { count?: number }) {
  return (
    <div className="oma-shim-stories">
      <Bone w={56} h={12} />
      <div className="oma-shim-stories__row">
        {range(count).map((i) => (
          <Bone key={i} className="oma-shim-stories__item" r={10} />
        ))}
      </div>
    </div>
  );
}

function ContentFeedBones() {
  return (
    <div className="oma-shim-feed" data-view="feed">
      <StoriesBones count={8} />
      {range(3).map((i) => (
        <section key={i} className="oma-shim-feed__item">
          <div className="oma-shim-feed__rail">
            <Bone w={28} h={28} r={999} />
            <Bone w={28} h={28} r={999} />
          </div>
          <article className="oma-shim-feed__post">
            <div className="oma-shim-row">
              <Bone w={36} h={36} r={999} />
              <div className="oma-shim-stack">
                <Bone w={140} h={12} />
                <Bone w={90} h={10} />
              </div>
            </div>
            <Bone w="92%" h={11} />
            <Bone w="64%" h={11} />
            <Bone className="oma-shim-feed__media" r={8} />
            <div className="oma-shim-row">
              <Bone w={60} h={12} />
              <Bone w={60} h={12} />
              <Bone w={60} h={12} />
            </div>
          </article>
          <aside className="oma-shim-feed__comments">
            <Bone w="100%" h={34} r={8} />
            <Bone w={120} h={11} />
          </aside>
        </section>
      ))}
    </div>
  );
}

function ContentGridBones() {
  return (
    <div className="oma-shim-pvgrid" data-view="grid">
      <StoriesBones count={4} />
      <div className="oma-shim-pvgrid__tiles">
        {range(9).map((i) => (
          <Bone key={i} className="oma-shim-pvgrid__tile" r={0} />
        ))}
      </div>
    </div>
  );
}

function ContentListBones() {
  return (
    <div className="oma-shim-plist" data-view="list">
      <div className="oma-shim-plist__head">
        <div className="oma-shim-row">
          <Bone w={14} h={14} r={3} />
          <Bone w={84} h={12} />
        </div>
        <Bone w={88} h={12} />
      </div>
      {range(7).map((i) => (
        <div key={i} className="oma-shim-plist__row">
          <Bone w={14} h={14} r={3} />
          <Bone w={40} h={40} r={6} />
          <div className="oma-shim-stack">
            <Bone w={i % 2 ? '62%' : '78%'} h={12} />
            <Bone w="44%" h={10} />
          </div>
          <Bone w={56} h={20} r={999} />
          <Bone w={130} h={12} />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Tasks board                                                                                  */
/* -------------------------------------------------------------------------------------------- */

const KB_COLUMNS = [2, 1, 3, 2, 1];

function readTasksView(): 'board' | 'list' {
  try {
    const url = new URLSearchParams(window.location.search).get('view');
    const raw = url === 'board' || url === 'list' ? url : window.localStorage.getItem('oma.tasks.defaultView');
    return raw === 'list' ? 'list' : 'board';
  } catch {
    return 'board';
  }
}

export function TasksShimmer({ view, part = 'page' }: { view?: 'board' | 'list'; part?: ShimmerPart }) {
  const pref = useClientPref(readTasksView, 'board');
  const v = view ?? pref;
  const page = part === 'page';
  return (
    <ShimmerRoot screen="tasks" className={page ? 'oma-tasks-page oma-shim-tasks' : 'oma-shim-tasks oma-shim-part'}>
      {page ? <HeaderBones title={150} sub={360} /> : null}
      {page ? (
        <div className="oma-prod-strip oma-shim-strip" aria-hidden="true">
          {range(4).map((i) => (
            <div key={i} className="oma-prod-stat oma-shim-strip__stat">
              <Bone w={84} h={10} />
              <Bone w={28} h={18} r={5} />
            </div>
          ))}
        </div>
      ) : null}
      {v === 'list' ? (
        <TableBones cols={[220, 90, 110, 90, 80]} rows={7} thumb />
      ) : (
        <div className="oma-shim-kb" aria-hidden="true">
          {KB_COLUMNS.map((cards, c) => (
            <section key={c} className="oma-shim-kb__col">
              <div className="oma-shim-kb__head">
                <Bone w={8} h={8} r={999} />
                <Bone w={76} h={12} />
                <span className="oma-shim-spacer" />
                <Bone w={22} h={18} r={999} />
              </div>
              {range(cards).map((k) => (
                <article key={k} className="oma-shim-kb__card">
                  {(c + k) % 3 !== 2 ? <Bone className="oma-shim-kb__media" r={8} /> : null}
                  <Bone w="86%" h={13} />
                  <Bone w="64%" h={10} />
                  <Bone w="48%" h={10} />
                  <div className="oma-shim-row oma-shim-row--between">
                    <Bone w={64} h={18} r={999} />
                    <Bone w={24} h={24} r={999} />
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </ShimmerRoot>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Brands portfolio                                                                             */
/* -------------------------------------------------------------------------------------------- */

export function BrandsShimmer({ cards = 6, part = 'page' }: { cards?: number; part?: ShimmerPart }) {
  const grid = (
        <div className="plx-card-grid" aria-hidden="true">
          {range(cards).map((i) => (
            <article key={i} className="oma-workspace-card oma-shim-brand-card">
              <div className="oma-shim-row oma-shim-row--top">
                <Bone w={40} h={40} r={10} />
                <div className="oma-shim-stack">
                  <Bone w={i % 2 ? '58%' : '72%'} h={14} />
                  <Bone w="64%" h={11} />
                  <div className="oma-shim-row">
                    <Bone w={46} h={20} r={999} />
                    <Bone w={52} h={20} r={999} />
                    <Bone w={40} h={20} r={999} />
                  </div>
                </div>
              </div>
              <Bone w={118} h={34} r={8} className="oma-shim--strong" />
            </article>
          ))}
        </div>
  );
  if (part === 'body') {
    return (
      <ShimmerRoot screen="brands" className="oma-shim-brands oma-shim-part">
        {grid}
      </ShimmerRoot>
    );
  }
  return (
    <ShimmerRoot screen="brands" className="plx-page oma-shim-brands">
      <div className="plx-page__bar" aria-hidden="true">
        <div className="plx-page__title-block oma-shim-stack">
          <Bone w={70} h={12} />
          <Bone w={230} h={26} r={6} />
          <Bone w={360} h={13} />
        </div>
      </div>
      <div className="plx-page__body">{grid}</div>
    </ShimmerRoot>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Requests / Reviews / Deliverables                                                            */
/* -------------------------------------------------------------------------------------------- */

function TableBones({ cols, rows, thumb = false, avatar = false }: { cols: number[]; rows: number; thumb?: boolean; avatar?: boolean }) {
  return (
    <div className="oma-shim-table" aria-hidden="true">
      <div className="oma-shim-table__row oma-shim-table__row--head">
        {cols.map((w, i) => (
          <Bone key={i} w={Math.round(w * 0.45)} h={10} />
        ))}
      </div>
      {range(rows).map((r) => (
        <div key={r} className="oma-shim-table__row">
          <div className="oma-shim-row oma-shim-table__lead" style={{ flexBasis: cols[0] }}>
            {thumb ? <Bone w={44} h={44} r={8} /> : null}
            {avatar ? <Bone w={30} h={30} r={999} /> : null}
            <div className="oma-shim-stack">
              <Bone w={r % 2 ? '70%' : '86%'} h={12} />
              <Bone w="58%" h={10} />
            </div>
          </div>
          {cols.slice(1).map((w, i) => (
            <Bone key={i} w={Math.round(w * (0.5 + ((r + i) % 3) * 0.15))} h={i === 1 ? 20 : 11} r={i === 1 ? 999 : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RequestsShimmer({ part = 'page' }: { part?: ShimmerPart }) {
  const body = (
    <div className="oma-shim-body">
      <Bone w={40} h={12} />
      <TableBones cols={[300, 80, 110, 160, 70, 110, 90]} rows={6} avatar />
    </div>
  );
  if (part === 'body') {
    return (
      <ShimmerRoot screen="requests" className="oma-shim-requests oma-shim-part">
        {body}
      </ShimmerRoot>
    );
  }
  return (
    <ShimmerRoot screen="requests" className="oma-stack oma-req-page oma-shim-requests">
      <div className="oma-req-header" aria-hidden="true">
        <div className="oma-req-header__left oma-shim-stack">
          <Bone w={130} h={24} r={6} />
          <Bone w={34} h={12} />
          <Bone w={340} h={13} />
          <TabBones widths={[40, 80, 76, 88, 66, 86]} />
        </div>
      </div>
      {body}
    </ShimmerRoot>
  );
}

export function ReviewsShimmer({ part = 'page' }: { part?: ShimmerPart }) {
  const page = part === 'page';
  return (
    <ShimmerRoot
      screen="reviews"
      className={page ? 'oma-stack oma-reviews-page oma-shim-reviews' : 'oma-stack oma-shim-reviews oma-shim-part'}
    >
      {page ? (
        <header className="oma-page-header oma-page-header-stack oma-shim-header" aria-hidden="true">
          <div className="oma-shim-header__copy">
            <Bone w={120} h={24} r={6} />
            <Bone w={330} h={14} />
            <Bone w={180} h={12} />
          </div>
        </header>
      ) : null}
      <div className="oma-shim-row oma-shim-row--between oma-shim-toolbar" aria-hidden="true">
        <TabBones widths={[54, 132, 146, 156, 96]} />
        <Bone w={124} h={30} r={8} />
      </div>
      <div className="oma-shim-queue" aria-hidden="true">
        {range(5).map((i) => (
          <article key={i} className="oma-shim-queue__card">
            <Bone w={88} h={66} r={8} />
            <div className="oma-shim-stack">
              <div className="oma-shim-row oma-shim-row--between">
                <Bone w={i % 2 ? 180 : 240} h={14} />
                <Bone w={96} h={22} r={999} />
              </div>
              <div className="oma-shim-row">
                <Bone w={90} h={10} />
                <Bone w={24} h={10} />
                <Bone w={70} h={10} />
              </div>
              <Bone w={100} h={10} />
            </div>
            <Bone w={104} h={32} r={8} />
          </article>
        ))}
      </div>
    </ShimmerRoot>
  );
}

function readDeliverablesView(): 'grid' | 'list' {
  try {
    return window.localStorage.getItem('oma-demo-deliv-view') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function DeliverablesShimmer({ view, part = 'page' }: { view?: 'grid' | 'list'; part?: ShimmerPart }) {
  const pref = useClientPref(readDeliverablesView, 'grid');
  const v = view ?? pref;
  const page = part === 'page';
  return (
    <ShimmerRoot
      screen="deliverables"
      className={page ? 'oma-deliv-page oma-shim-deliverables' : 'oma-shim-deliverables oma-shim-part'}
    >
      {page ? <HeaderBones title={150} sub={380} /> : null}
      <div className="oma-shim-toolbar" aria-hidden="true">
        <TabBones widths={[40, 104, 140, 92, 82, 78]} />
      </div>
      <div className="oma-shim-body" aria-hidden="true">
        <Bone w={40} h={12} />
        {v === 'list' ? (
          <TableBones cols={[300, 90, 100, 100, 90, 70, 110]} rows={6} thumb />
        ) : (
          <div className="oma-shim-dgrid">
            {range(8).map((i) => (
              <article key={i} className="oma-shim-dgrid__card">
                <Bone className="oma-shim-dgrid__media" r={0} />
                <div className="oma-shim-stack oma-shim-dgrid__copy">
                  <Bone w={i % 2 ? '64%' : '80%'} h={13} />
                  <Bone w={60} h={20} r={999} />
                  <Bone w="70%" h={10} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </ShimmerRoot>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Route lookup (used by the membership gate before the session resolves)                      */
/* -------------------------------------------------------------------------------------------- */

/** Screen shimmer for a pathname, or null when the route uses the generic page skeleton. */
export function screenShimmerFor(pathname: string | null | undefined): ReactNode | null {
  const p = (pathname ?? '').replace(/\/+$/, '');
  if (p === '/app/content') return <ContentShimmer />;
  if (p === '/app/tasks') return <TasksShimmer />;
  if (p === '/app/brands') return <BrandsShimmer />;
  if (p === '/app/requests') return <RequestsShimmer />;
  if (p === '/app/reviews') return <ReviewsShimmer />;
  if (p === '/app/deliverables') return <DeliverablesShimmer />;
  return null;
}
