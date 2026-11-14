import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';
import { mediaViewUrl } from '../media/media.service';
import { generateCatalogProductCreative, type CatalogGenerateKind } from './catalog-generate';

function mapCatalogMedia(row: {
  id: string;
  role: string;
  sourceUrl: string | null;
  sortOrder: number;
  mediaAsset: { id: string; mime: string; name: string; status: string };
}) {
  return {
    id: row.id,
    role: row.role,
    source_url: row.sourceUrl,
    sort_order: row.sortOrder,
    mime: row.mediaAsset.mime,
    name: row.mediaAsset.name,
    status: row.mediaAsset.status,
    view_url: mediaViewUrl(row.mediaAsset.id),
    stream_url: row.mediaAsset.mime.startsWith('video/')
      ? `/api/v1/media/${row.mediaAsset.id}/stream`
      : null,
  };
}

@Injectable()
export class CatalogService {
  async generate(
    tenantId: string,
    brandId: string,
    productId: string,
    kind: CatalogGenerateKind,
    actorUserId: string,
  ) {
    const data = await generateCatalogProductCreative({
      tenantId,
      brandId,
      discoveredProductId: productId,
      kind,
      actorUserId,
    });
    return { data };
  }

  async listProductMedia(tenantId: string, brandId: string, productId: string) {
    await this.assertProduct(tenantId, brandId, productId);
    const rows = await getPrisma().catalogProductMedia.findMany({
      where: tenantWhere(tenantId, { brandId, discoveredProductId: productId }),
      include: { mediaAsset: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { data: rows.map(mapCatalogMedia) };
  }

  private async assertProduct(tenantId: string, brandId: string, productId: string) {
    const row = await getPrisma().discoveredProductService.findFirst({
      where: tenantWhere(tenantId, { id: productId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return row;
  }
}

export async function catalogMediaByProductIds(tenantId: string, productIds: string[]) {
  if (!productIds.length) return new Map<string, ReturnType<typeof mapCatalogMedia>[]>();
  const rows = await getPrisma().catalogProductMedia.findMany({
    where: { tenantId, discoveredProductId: { in: productIds } },
    include: { mediaAsset: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const out = new Map<string, ReturnType<typeof mapCatalogMedia>[]>();
  for (const row of rows) {
    const list = out.get(row.discoveredProductId) ?? [];
    list.push(mapCatalogMedia(row));
    out.set(row.discoveredProductId, list);
  }
  return out;
}
