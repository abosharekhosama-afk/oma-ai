'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type LinkButtonType = 'primary' | 'default' | 'dashed' | 'link' | 'text';
type LinkButtonSize = 'small' | 'middle' | 'large';

function antBtnClass(
  type: LinkButtonType = 'primary',
  size?: LinkButtonSize,
  block?: boolean,
  danger?: boolean,
  ghost?: boolean,
  className?: string,
) {
  const parts = ['ant-btn'];
  if (type === 'primary') parts.push('ant-btn-primary');
  else if (type === 'dashed') parts.push('ant-btn-dashed');
  else if (type === 'link') parts.push('ant-btn-link');
  else if (type === 'text') parts.push('ant-btn-text');
  else parts.push('ant-btn-default');
  if (size === 'small') parts.push('ant-btn-sm');
  if (size === 'large') parts.push('ant-btn-lg');
  if (block) parts.push('ant-btn-block');
  if (danger) parts.push('ant-btn-dangerous');
  if (ghost) parts.push('ant-btn-background-ghost');
  if (className) parts.push(className);
  return parts.join(' ');
}

/**
 * Next.js Link that reuses Ant Design button classes (no nested button element).
 * Keeps CTA navigation inside @oma/ui visual grammar (R2).
 */
export function OmaLinkButton({
  href,
  type = 'primary',
  children,
  className,
  size,
  block,
  danger,
  ghost,
  disabled,
  'data-testid': testId,
}: {
  href: string;
  type?: LinkButtonType;
  children: ReactNode;
  className?: string;
  size?: LinkButtonSize;
  block?: boolean;
  danger?: boolean;
  ghost?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}) {
  const cls = antBtnClass(type, size, block, danger, ghost, className);
  if (disabled) {
    return (
      <span className={`${cls} ant-btn-disabled`} aria-disabled="true" data-testid={testId}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`oma-link-button ${cls}`} data-testid={testId}>
      {children}
    </Link>
  );
}
