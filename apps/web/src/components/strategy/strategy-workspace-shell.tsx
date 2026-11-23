'use client';

import type { ReactNode } from 'react';
import { BrandWorkspaceShell } from '../brand/brand-workspace-shell';

/** Strategy pages: hide duplicate brand hero and use a flat white workspace panel. */
export function StrategyWorkspaceShell({
  brandId,
  brandName,
  brandLogoUrl,
  children,
}: {
  brandId: string;
  brandName: string;
  brandLogoUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brandName}
      brandLogoUrl={brandLogoUrl}
      hideIntro
      unifiedPanelChrome
    >
      {children}
    </BrandWorkspaceShell>
  );
}
