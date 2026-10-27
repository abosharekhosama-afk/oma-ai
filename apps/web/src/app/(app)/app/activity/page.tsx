'use client';

import dynamic from 'next/dynamic';
import { TableShimmer } from '../../../../components/ui/shimmer';

const Client = dynamic(() => import('./activity-client'), {
  ssr: false,
  loading: () => <TableShimmer rows={8} />,
});

export default function Page() {
  return <Client />;
}
