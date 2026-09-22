import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  why,
  next,
  previous,
  action,
  demoHint,
}: {
  title: string;
  body?: string;
  /** Why this page exists */
  why?: string;
  /** What to do next */
  next?: string;
  /** Link/control for the prior journey step when input is missing */
  previous?: ReactNode;
  action?: ReactNode;
  /** Demo-mode only hint — must already be honest copy */
  demoHint?: ReactNode;
}) {
  return (
    <div className="oma-empty" role="status" data-testid="empty-state">
      <h2>{title}</h2>
      {why ? <p className="oma-empty-why">{why}</p> : null}
      {body ? <p>{body}</p> : null}
      {next ? (
        <p className="oma-empty-next">
          <strong>{next}</strong>
        </p>
      ) : null}
      {previous}
      {demoHint}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="oma-error" role="alert">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function DeniedState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="oma-denied" role="alert">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return <span className="oma-skeleton" style={{ width, height }} aria-hidden="true" />;
}
