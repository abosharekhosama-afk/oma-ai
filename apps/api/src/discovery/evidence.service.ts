import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';

@Injectable()
export class EvidenceService {
  async get(tenantId: string, brandId: string, evidenceId: string) {
    const evidence = await getPrisma().evidenceExcerpt.findFirst({
      where: tenantWhere(tenantId, { id: evidenceId, brandId }),
    });
    if (!evidence) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    // An excerpt is only as live as the connector that produced its scan.
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: evidence.scanAttemptId }),
      select: { connectorMode: true },
    });
    return {
      data: {
        id: evidence.id,
        connector_mode: scan?.connectorMode ?? 'NOT_CONFIGURED',
        source_url: evidence.sourceUrl,
        canonical_url: evidence.canonicalUrl,
        page_title: evidence.pageTitle,
        fetched_at: evidence.fetchedAt.toISOString(),
        excerpt_text: evidence.excerptText,
        content_hash: evidence.contentHash,
        extraction_method: evidence.extractionMethod,
        scan_attempt_id: evidence.scanAttemptId,
        discovered_page_id: evidence.discoveredPageId,
      },
    };
  }
}
