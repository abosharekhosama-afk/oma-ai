'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '../../../components/ui/page-skeleton';

const HomeClient = dynamic(() => import('./home-client'), {
  ssr: false,
  loading: () => <PageSkeleton rows={5} label="Loading home" />,
});

export default function HomePage() {
  return <HomeClient />;
}
