'use client';

/**
 * Loading shimmer shared by every screen. Uses the same light sweep as the Home screen
 * (`.oma-skeleton`, see styles/states.css) with shapes that match each layout.
 */
function Bar({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <span
      className="oma-skeleton oma-shimmer-bar"
      style={{ width: w, height: h, minHeight: h, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

// Kept free of the i18n bundle so route-level loading states stay tiny; the label follows <html lang>.
function loadingLabel() {
  if (typeof document === 'undefined') return 'Loading';
  return document.documentElement.lang?.startsWith('ar') ? 'جارٍ التحميل' : 'Loading';
}

function Status({ children, kind }: { children: React.ReactNode; kind: string }) {
  return (
    <div
      className={`oma-shimmer oma-shimmer--${kind}`}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel()}
    >
      {children}
    </div>
  );
}

/** Table / list screens (team, activity, requests, reviews, deliverables). */
export function TableShimmer({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <Status kind="table">
      <div className="oma-shimmer-row oma-shimmer-row--head">
        <Bar w="22%" h={12} />
        <Bar w="14%" h={12} />
        <Bar w="14%" h={12} />
        <Bar w="12%" h={12} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="oma-shimmer-row">
          {avatar ? <Bar w={28} h={28} r={14} /> : null}
          <span className="oma-shimmer-stack">
            <Bar w="60%" h={14} />
            <Bar w="35%" h={10} />
          </span>
          <Bar w="14%" h={20} r={10} />
          <Bar w="12%" h={14} />
        </div>
      ))}
    </Status>
  );
}

/** Kanban-like boards (tasks). */
export function BoardShimmer({ columns = 4 }: { columns?: number }) {
  return (
    <Status kind="board">
      {Array.from({ length: columns }, (_, c) => (
        <div key={c} className="oma-shimmer-col">
          <Bar w="50%" h={14} />
          {Array.from({ length: 3 - (c % 2) }, (_, i) => (
            <Bar key={i} h={72} r={8} />
          ))}
        </div>
      ))}
    </Status>
  );
}

/** Detail screens: title, meta line, then a main column and a side column. */
export function DetailShimmer() {
  return (
    <Status kind="detail">
      <Bar w="36%" h={24} />
      <Bar w="22%" h={12} />
      <div className="oma-shimmer-detail">
        <div className="oma-shimmer-stack">
          <Bar h={180} r={10} />
          <Bar w="90%" />
          <Bar w="75%" />
          <Bar w="80%" />
        </div>
        <div className="oma-shimmer-stack">
          <Bar h={56} r={8} />
          <Bar h={56} r={8} />
          <Bar h={56} r={8} />
        </div>
      </div>
    </Status>
  );
}

/** Card grids (workspaces, brands). */
export function CardGridShimmer({ cards = 6 }: { cards?: number }) {
  return (
    <Status kind="cards">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="oma-shimmer-card">
          <span className="oma-shimmer-row oma-shimmer-row--flat">
            <Bar w={36} h={36} r={18} />
            <span className="oma-shimmer-stack">
              <Bar w="70%" />
              <Bar w="40%" h={10} />
            </span>
          </span>
          <Bar h={10} w="90%" />
        </div>
      ))}
    </Status>
  );
}
