import { listContentForBrand } from './content-api';
import { listRequests } from './ops-api';

export type BrandPipelineHints = {
  work_request_count: number;
  content_count: number;
};

export async function loadBrandPipelineHints(brandId: string): Promise<BrandPipelineHints> {
  const [requests, content] = await Promise.all([
    listRequests(brandId).catch(() => []),
    listContentForBrand(brandId).catch(() => []),
  ]);
  return {
    work_request_count: requests.length,
    content_count: content.length,
  };
}

export function hasPlanRequestsCommitted(hints: BrandPipelineHints | null | undefined): boolean {
  return (hints?.work_request_count ?? 0) > 0;
}

export function hasBrandContent(hints: BrandPipelineHints | null | undefined): boolean {
  return (hints?.content_count ?? 0) > 0;
}
