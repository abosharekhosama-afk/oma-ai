'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';

type BaseProps = {
  'aria-label': string;
  title?: string;
  'data-testid'?: string;
  'data-active'?: 'true' | 'false';
  className?: string;
  children: ReactNode;
  badge?: number;
};

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps | 'children'> & {
    href?: undefined;
  };

type LinkProps = BaseProps & {
  href: string;
  onClick?: () => void;
};

const baseClass = 'oma-icon-action';

function mergeClass(extra?: string) {
  return extra ? `${baseClass} ${extra}` : baseClass;
}

export const OmaIconAction = forwardRef<HTMLButtonElement, ButtonProps | LinkProps>(
  function OmaIconAction(props, ref) {
    const { className, children, badge, title } = props;
    const ariaLabel = props['aria-label'];
    const common = {
      className: mergeClass(className),
      'aria-label': ariaLabel,
      title: title ?? ariaLabel,
      'data-testid': props['data-testid'],
      'data-active': props['data-active'],
    };

    const badgeNode =
      badge != null && badge > 0 ? (
        <span className="oma-icon-action__badge" aria-hidden>
          {badge}
        </span>
      ) : null;

    if ('href' in props && props.href) {
      const { href, onClick } = props;
      return (
        <Link href={href} {...common} onClick={onClick}>
          {children}
          {badgeNode}
        </Link>
      );
    }

    const { onClick, type = 'button', disabled, ...buttonRest } = props as ButtonProps;
    return (
      <button
        ref={ref}
        type={type}
        {...common}
        {...buttonRest}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
        {badgeNode}
      </button>
    );
  },
);
