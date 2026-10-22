'use client';

import { OmaDotsLoader } from './oma-dots-loader';

/** Compact dots loader pinned to the top of the content area (tab transitions). */
export function OmaTopLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="oma-top-loader" role="status" aria-label={label} data-testid="oma-top-loader">
      <OmaDotsLoader label={label} />
    </div>
  );
}
