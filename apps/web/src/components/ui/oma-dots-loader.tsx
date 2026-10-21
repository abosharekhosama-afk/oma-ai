import './oma-dots-loader.css';

/** Unified Planable-style loading element: three bouncing dots. */
export function OmaDotsLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="oma-dots" role="status" aria-label={label} data-testid="oma-dots-loader">
      <span className="oma-dots-dot" />
      <span className="oma-dots-dot" />
      <span className="oma-dots-dot" />
    </span>
  );
}

/** White veil + centered dots, used over workspace cards while activating. */
export function OmaDotsLoaderOverlay({ label }: { label?: string }) {
  return (
    <span className="oma-dots-overlay" aria-hidden="false">
      <OmaDotsLoader label={label} />
    </span>
  );
}
