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
