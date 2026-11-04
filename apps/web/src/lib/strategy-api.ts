import { api } from './api';
import { mapLimit } from './map-limit';

export type ApiStrategyListItem = {
  id: string;
  name: string;
  status: string;
  updated_at?: string;
};

export async function listStrategiesForBrand(brandId: string): Promise<ApiStrategyListItem[]> {
  const res = await api<{ data: ApiStrategyListItem[] }>(
    `/api/v1/brands/${brandId}/strategies`,
  );
  return res.data ?? [];
}

export type ApiStrategyWithBrand = ApiStrategyListItem & { brandId: string };

export async function listStrategiesForBrands(brandIds: string[]): Promise<ApiStrategyWithBrand[]> {
  const batches = await mapLimit(brandIds, 2, async (id) => {
    const rows = await listStrategiesForBrand(id).catch(() => [] as ApiStrategyListItem[]);
    return rows.map((s) => ({ ...s, brandId: id }));
  });
  return batches.flat();
}
