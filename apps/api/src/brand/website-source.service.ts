import { Injectable } from '@nestjs/common';
import {
  DomainError,
  assertNormalizedUrl,
  assertSsrfAllowed,
  isBrandFixtureConnectorEnabled,
  newId,
  refusingWebsiteConnector,
  createFixtureWebsiteConnector,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { getPrisma, tenantWhere } from '@oma/db';
import { AuditService } from '../audit/audit.service';
import { BrandService } from './brand.service';

function resolveWebsiteConnector(): WebsiteConnectorPort {
  if (isBrandFixtureConnectorEnabled()) {
    return createFixtureWebsiteConnector();
  }
  return refusingWebsiteConnector;
}

@Injectable()
export class WebsiteSourceService {
  private readonly connector = resolveWebsiteConnector();

  constructor(
    private readonly audit: AuditService,
    private readonly brands: BrandService,
  ) {}

  async connect(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: { url: string; authorization_attested: boolean; version: number },
    correlationId?: string,
  ) {
    if (!input.authorization_attested) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Attestation required',
        400,
        'errors.validation_failed',
      );
    }
    const brand = await this.brands.assertBrandMutable(tenantId, brandId);
    if (brand.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    const { normalizedUrl, host } = assertNormalizedUrl(input.url);
    assertSsrfAllowed(host);

    const validation = await this.connector.validateSource({ url: normalizedUrl });
    if (!validation.ok) {
      throw new DomainError(
        'VALIDATION_FAILED',
        validation.reason ?? 'Invalid source',
        400,
        'errors.validation_failed',
      );
    }

    const prisma = getPrisma();
    const existing = brand.primaryWebsiteSourceId
      ? await prisma.websiteSource.findFirst({
          where: { id: brand.primaryWebsiteSourceId, tenantId },
        })
      : null;

    const sourceRevision = (existing?.sourceRevision ?? 0) + 1;
    const source = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.websiteSource.update({
          where: { id: existing.id },
          data: { replacedAt: new Date() },
        });
      }
      const created = await tx.websiteSource.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          normalizedUrl,
          host,
          attestationAcceptedAt: new Date(),
          attestedByUserId: actorUserId,
          validationStatus: 'VALID',
          sourceRevision,
        },
      });
      await tx.brandWorkspace.update({
        where: { id: brandId },
        data: {
          primaryWebsiteSourceId: created.id,
          status: brand.status === 'DRAFT' ? 'READY_TO_SCAN' : brand.status,
          version: { increment: 1 },
        },
      });
      return created;
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: existing ? 'brand.website.replaced' : 'brand.website.connected',
      targetType: 'WebsiteSource',
      targetId: source.id,
      correlationId,
    });

    return {
      data: {
        website_source_id: source.id,
        normalized_url: source.normalizedUrl,
        validation_status: source.validationStatus,
        brand_status: existing ? brand.status : 'READY_TO_SCAN',
        source_revision: source.sourceRevision,
      },
    };
  }

  async get(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!brand.primaryWebsiteSourceId) {
      throw new DomainError(
        'WEBSITE_NOT_CONNECTED',
        'No website connected',
        409,
        'errors.website_not_connected',
      );
    }
    const source = await getPrisma().websiteSource.findFirst({
      where: tenantWhere(tenantId, { id: brand.primaryWebsiteSourceId }),
    });
    if (!source) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return {
      data: {
        website_source_id: source.id,
        normalized_url: source.normalizedUrl,
        host: source.host,
        validation_status: source.validationStatus,
        source_revision: source.sourceRevision,
        attestation_accepted_at: source.attestationAcceptedAt.toISOString(),
      },
    };
  }
}
