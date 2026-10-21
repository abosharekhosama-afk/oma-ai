'use client';

import { Empty, Result, Skeleton as AntSkeleton } from '@oma/ui/controls';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  why,
  next,
  previous,
  action,
  demoHint: _demoHint,
}: {
  title: string;
  body?: string;
  why?: string;
  next?: string;
  previous?: ReactNode;
  action?: ReactNode;
  /** @deprecated Demo hints removed for Planable parity */
  demoHint?: ReactNode;
}) {
  return (
    <div className="oma-empty" role="status" data-testid="empty-state">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="oma-empty-body">
            <h2 className="oma-empty-title">{title}</h2>
            {why ? <p className="oma-empty-why">{why}</p> : null}
            {body ? <p className="oma-empty-desc">{body}</p> : null}
            {next ? (
              <p className="oma-empty-next">
                <strong>{next}</strong>
              </p>
            ) : null}
          </div>
        }
      >
        {previous}
        {action ? <div className="oma-empty-action">{action}</div> : null}
      </Empty>
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
      <Result status="error" title={title} subTitle={body} extra={action} />
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
      <Result status="403" title={title} subTitle={body} extra={action} />
    </div>
  );
}

/** Planable-style skeleton block — consistent height, soft pulse */
export function Skeleton({
  width = '100%',
  height = '14px',
  rounded = true,
}: {
  width?: string;
  height?: string;
  rounded?: boolean;
}) {
  return (
    <AntSkeleton.Input
      active
      size="small"
      style={{
        width,
        height,
        minWidth: 0,
        borderRadius: rounded ? 6 : 0,
      }}
      aria-hidden="true"
    />
  );
}

/** Page-level loading surface matching Planable density */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="oma-page-skeleton" role="status" aria-busy="true" aria-label="Loading">
      <div className="oma-page-skeleton-header">
        <Skeleton width="180px" height="22px" />
        <Skeleton width="280px" height="14px" />
      </div>
      <div className="oma-page-skeleton-toolbar">
        <Skeleton width="120px" height="32px" />
        <Skeleton width="120px" height="32px" />
        <Skeleton width="80px" height="32px" />
      </div>
      <div className="oma-page-skeleton-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="oma-page-skeleton-row">
            <Skeleton width="40px" height="40px" />
            <div className="oma-page-skeleton-row-text">
              <Skeleton width="40%" height="14px" />
              <Skeleton width="70%" height="12px" />
            </div>
            <Skeleton width="64px" height="24px" />
          </div>
        ))}
      </div>
    </div>
  );
}
