'use client';

export function PageSkeleton({ rows = 6, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="oma-page-skeleton" role="status" aria-label={label}>
      <div className="oma-page-skeleton__header">
        <span className="oma-skeleton oma-page-skeleton__title" />
        <span className="oma-skeleton oma-page-skeleton__action" />
      </div>
      <div className="oma-page-skeleton__toolbar">
        <span className="oma-skeleton oma-page-skeleton__chip" />
        <span className="oma-skeleton oma-page-skeleton__chip" />
        <span className="oma-skeleton oma-page-skeleton__search" />
      </div>
      <div className="oma-page-skeleton__body">
        {Array.from({ length: rows }).map((_, i) => (
          <span key={i} className="oma-skeleton oma-page-skeleton__row" />
        ))}
      </div>
    </div>
  );
}

export function ContentCalSkeleton() {
  return (
    <div className="oma-content-cal-skeleton" role="status" aria-label="Loading content">
      <div className="oma-content-cal-skeleton__toolbar">
        <span className="oma-content-cal-skeleton__chip oma-skeleton" />
        <span className="oma-content-cal-skeleton__chip oma-skeleton" />
        <span className="oma-content-cal-skeleton__label oma-skeleton" />
        <span className="oma-content-cal-skeleton__spacer" />
        <span className="oma-content-cal-skeleton__btn oma-skeleton" />
      </div>
      <div className="oma-content-cal-skeleton__dows">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="oma-content-cal-skeleton__dow oma-skeleton" />
        ))}
      </div>
      <div className="oma-content-cal-skeleton__grid">
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} className="oma-content-cal-skeleton__cell">
            <span className="oma-content-cal-skeleton__daynum oma-skeleton" />
            <span className="oma-content-cal-skeleton__post oma-skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
