'use client';

import { useEffect, useState } from 'react';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';

/**
 * Demo: skip OMA register UI; company creation lives on select-company (Planable).
 * Hard navigation avoids a stuck dots loader if client routing is interrupted.
 */
export default function RegisterPage() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    try {
      document.cookie = 'oma_session=demo; path=/; max-age=604800; SameSite=Lax';
    } catch {
      /* ignore */
    }
    window.location.replace('/app/select-company');

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
        <a href="/app/select-company">Continue</a>
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
