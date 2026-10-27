'use client';

import dynamic from 'next/dynamic';
import { CardGridShimmer } from '../../../../components/ui/shimmer';

const Client = dynamic(() => import('./brands-client'), {
  ssr: false,
  loading: () => <CardGridShimmer />,
});

export default function Page() {
  return <Client />;
}
