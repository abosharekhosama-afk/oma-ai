'use client';

import { useEffect, useState } from 'react';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';

/**
 * Demo: skip OMA login UI and enter the product immediately.
 * Uses hard navigation (location.replace) so we never sit on this page with dots
 * while client-side router.replace is blocked by a middleware redirect loop.
 */
export default function LoginPage() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    // Soft cookie so any residual client checks see a session marker (not httpOnly).
    try {
      document.cookie = 'oma_session=demo; path=/; max-age=604800; SameSite=Lax';
    } catch {
      /* ignore */
    }
    window.location.replace('/app');

    const t = window.setTimeout(() => setStuck(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  if (stuck) {
    return (
      <main
        id="main"
        className="plx-auth-page"
        style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 12 }}
      >
        <p style={{ margin: 0 }}>Unable to open workspace automatically.</p>
        <a href="/app">Continue to app</a>
      </main>
    );
  }

  return (
    <main
      id="main"
      className="plx-auth-page"
      style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}
    >
      <OmaDotsLoader label="Opening workspace" />
    </main>
  );
}
