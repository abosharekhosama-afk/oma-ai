'use client';

import { Tooltip as AntTooltip } from '@oma/ui/controls';
import type { ReactNode } from 'react';

export function Tooltip({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return <AntTooltip title={label}>{children}</AntTooltip>;
}
