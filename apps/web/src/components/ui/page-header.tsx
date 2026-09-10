import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  meta,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="oma-page-header oma-page-header-stack">
      <div>
        {kicker ? <p className="oma-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="oma-muted oma-lead">{description}</p> : null}
        {meta ? <div className="oma-chip-row">{meta}</div> : null}
      </div>
      {actions ? <div className="oma-page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  priority = false,
  labelledBy,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  priority?: boolean;
  labelledBy?: string;
}) {
  const id = labelledBy ?? `panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section
      className={priority ? 'oma-panel oma-panel--priority' : 'oma-panel'}
      aria-labelledby={id}
    >
      <div className="oma-panel-head">
        <div>
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
