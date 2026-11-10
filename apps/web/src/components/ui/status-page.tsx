'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PlxLogo } from './plx-icons';

/**
 * Full-viewport status shell (404 / 500 / 403 / offline / expired session).
 * Portaled to document.body so nested notFound() / error boundaries escape
 * the authenticated AppShell (sidebar, header, drawers).
 */
export function StatusPage({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const node = (
    <div className="oma-status-page" data-testid="status-page" role="presentation">
      <div className="oma-status-page__inner">
        <div className="oma-status-page__brand">
          <PlxLogo sub="AI" />
        </div>
        {children}
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
