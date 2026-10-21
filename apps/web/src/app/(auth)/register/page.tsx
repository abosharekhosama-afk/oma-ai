'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';

/** Demo: skip OMA register UI; company creation lives on select-company (Planable). */
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/select-company');
  }, [router]);
  return (
    <main id="main" className="plx-auth-page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <OmaDotsLoader label="Opening workspace" />
    </main>
  );
}
