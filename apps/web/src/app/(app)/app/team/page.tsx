'use client';

import dynamic from 'next/dynamic';
import { TableShimmer } from '../../../../components/ui/shimmer';

const Client = dynamic(() => import('./team-client'), {
  ssr: false,
  loading: () => <TableShimmer rows={5} />,
});

export default function Page() {
  return <Client />;
}
