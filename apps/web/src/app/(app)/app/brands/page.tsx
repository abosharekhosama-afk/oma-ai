'use client';

import dynamic from 'next/dynamic';
import { BrandsShimmer } from '../../../../components/ui/screen-shimmer';

const Client = dynamic(() => import('./brands-client'), {
  ssr: false,
  loading: () => <BrandsShimmer />,
});

export default function Page() {
  return <Client />;
}
