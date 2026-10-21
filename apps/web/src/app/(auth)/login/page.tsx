'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';

/** Demo: skip OMA login UI and enter the product immediately. */
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app');
  }, [router]);
  return (
    <main id="main" className="plx-auth-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <OmaDotsLoader label="Opening workspace" />
    </main>
  );
}
