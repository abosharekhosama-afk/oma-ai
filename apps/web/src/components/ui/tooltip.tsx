'use client';

import { useId, useState, type ReactNode } from 'react';

export function Tooltip({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  if (disabled) return <>{children}</>;

  return (
    <span
      className="oma-tooltip-anchor"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span role="tooltip" id={id} className="oma-tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
