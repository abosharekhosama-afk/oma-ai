'use client';

import { ShellIcon } from '../../../../components/shell/shell-icons';

export function ScheduleBodyShimmer() {
  return (
    <div
      className="oma-plx-sched-shimmer oma-plx-sched-shimmer--fill"
      aria-busy="true"
      data-testid="demo-schedule-loading"
    >
      <div className="oma-plx-sched-shimmer__toolbar">
        <span className="oma-plx-shimmer-pill" />
        <span className="oma-plx-shimmer-pill oma-plx-shimmer-pill--wide" />
      </div>
      <div className="oma-plx-sched-shimmer__cal">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="oma-plx-sched-shimmer__col">
            <span className="oma-plx-shimmer-line" />
            <span className="oma-plx-shimmer-block" />
            <span className="oma-plx-shimmer-block oma-plx-shimmer-block--sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** @deprecated Prefer panel body + {@link ScheduleBodyShimmer} */
export function SchedulePanelShimmer() {
  return (
    <section className="oma-plx-listening-panel oma-plx-sched-panel oma-plx-sched-panel--loading">
      <ScheduleBodyShimmer />
    </section>
  );
}

export function ScheduleEmptyState({
  title,
  body,
  isAr,
}: {
  title: string;
  body: string;
  isAr: boolean;
}) {
  return (
    <div className="oma-plx-sched-empty" data-testid="demo-schedule-empty">
      <span className="oma-plx-sched-empty__icon" aria-hidden>
        <ShellIcon name="calendar-view" size={32} />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
      <p className="oma-plx-sched-empty__hint">
        {isAr
          ? 'غيّر الأسبوع أو أزل التصفية، أو أنشئ محتوى من مسوداتك.'
          : 'Change the week, clear filters, or schedule from saved drafts.'}
      </p>
    </div>
  );
}
