'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type BrandPlxSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
  actions?: ReactNode;
};

/** Social/listening-style section shell for brand evidence & intelligence pages. */
export function BrandPlxSection({
  title,
  description,
  children,
  testId,
  actions,
}: BrandPlxSectionProps) {
  return (
    <section className="oma-plx-listening-panel oma-plx-brand-section" data-testid={testId}>
      <header className="oma-plx-listening-panel__head oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{title}</h3>
          {description ? (
            <p className="oma-muted oma-plx-brand-section__desc">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="oma-plx-brand-section__actions">{actions}</div> : null}
      </header>
      <div className="oma-plx-brand-section__body">{children}</div>
    </section>
  );
}

type StatProps = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function BrandPlxStatGrid({ stats, testId }: { stats: StatProps[]; testId?: string }) {
  return (
    <dl className="oma-plx-brand-stat-grid" data-testid={testId}>
      {stats.map((stat) => (
        <div key={stat.label} className="oma-plx-listening-card oma-plx-brand-stat-card">
          <dt className="oma-plx-brand-stat-card__label">{stat.label}</dt>
          <dd className="oma-plx-brand-stat-card__value">{stat.value}</dd>
          {stat.hint ? (
            <p className="oma-muted oma-plx-brand-stat-card__hint">{stat.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

type RowProps = {
  title: string;
  meta?: ReactNode;
  description?: string;
  href?: string;
  foot?: ReactNode;
  onClick?: () => void;
  testId?: string;
};

export function BrandPlxDataRow({
  title,
  meta,
  description,
  href,
  foot,
  onClick,
  testId,
}: RowProps) {
  const className = 'oma-plx-listening-card oma-plx-brand-data-row';
  const inner = (
    <>
      <div className="oma-plx-listening-card__top">
        <div className="oma-plx-listening-card__author-text">
          <div className="oma-plx-listening-card__name-row">
            <strong>{title}</strong>
            {meta ? <span className="oma-plx-brand-data-row__meta">{meta}</span> : null}
          </div>
          {description ? <p className="oma-muted">{description}</p> : null}
        </div>
      </div>
      {foot ? <div className="oma-plx-listening-card__foot">{foot}</div> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} data-testid={testId}>
        {inner}
      </Link>
    );
  }
  return (
    <div
      className={className}
      data-testid={testId}
      role={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      {inner}
    </div>
  );
}
