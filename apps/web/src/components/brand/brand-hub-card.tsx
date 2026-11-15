'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  href: string;
  title: string;
  description?: string;
  /** Use `ltr` for URLs/codes inside RTL layouts. */
  descriptionDir?: 'ltr' | 'rtl' | 'auto';
  meta?: ReactNode;
  /** Optional real-data body (stat rows, chips) between description and footer. */
  children?: ReactNode;
  foot?: ReactNode;
  testId?: string;
};

/** Social / listening-style surface card for brand workspace hubs. */
export function BrandHubCard({
  href,
  title,
  description,
  descriptionDir,
  meta,
  children,
  foot,
  testId,
}: Props) {
  return (
    <Link
      href={href}
      className="oma-plx-listening-card oma-plx-brand-hub-card"
      data-testid={testId}
    >
      <div className="oma-plx-listening-card__top oma-plx-brand-hub-card__top">
        <div className="oma-plx-listening-card__author-text">
          <div className="oma-plx-listening-card__name-row">
            <strong className="oma-plx-brand-hub-card__title">{title}</strong>
            {meta ? <span className="oma-plx-brand-hub-card__meta">{meta}</span> : null}
          </div>
          {description ? (
            <p
              className={`oma-plx-listening-card__excerpt oma-muted${
                descriptionDir === 'ltr' ? ' oma-ltr' : ''
              }`}
              dir={descriptionDir}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="oma-plx-brand-hub-card__body">{children}</div> : null}
      {foot ? (
        <div className="oma-plx-listening-card__foot oma-plx-brand-hub-card__foot">
          <span>{foot}</span>
          <span className="oma-plx-brand-hub-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      ) : null}
    </Link>
  );
}
