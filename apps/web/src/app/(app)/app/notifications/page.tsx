'use client';

import dynamic from 'next/dynamic';
import { TableShimmer } from '../../../../components/ui/shimmer';

const Client = dynamic(() => import('./notifications-client'), {
  ssr: false,
  loading: () => <TableShimmer rows={6} avatar={false} />,
});

export default function Page() {
  return <Client />;
}
