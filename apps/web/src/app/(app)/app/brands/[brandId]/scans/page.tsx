import { redirect } from 'next/navigation';

/**
 * Production prefetches this segment because the scan nav lives under it.
 * There is no index screen; the scan action is the new-scan route.
 */
export default async function BrandScansIndex({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  redirect(`/app/brands/${brandId}/scans/new`);
}
