import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError, hasCapability } from '@oma/domain';
import { getPrisma, tenantWhere } from '@oma/db';
import type { Request } from 'express';

const routeRequirements: Record<string, string[]> = {
  'POST /api/v1/tenants/current/invitations': ['membership.invite'],
  'POST /api/v1/memberships/:id/suspend': ['membership.manage'],
  'POST /api/v1/memberships/:id/remove': ['membership.manage'],
  'POST /api/v1/memberships/:id/capabilities': ['capability.assign'],
  'POST /api/v1/memberships/:id/profiles': ['capability.assign'],
  'GET /api/v1/audit-events': ['audit.read'],
  'GET /api/v1/notifications': ['notification.read'],
  'GET /api/v1/jobs/:id': ['job.read'],
  'POST /api/v1/jobs/:id/cancel': ['job.read'],
  'GET /api/v1/brands': ['brand.read'],
  'POST /api/v1/brands': ['brand.create'],
  'GET /api/v1/brands/:brandId': ['brand.read'],
  'PATCH /api/v1/brands/:brandId': ['brand.create'],
  'POST /api/v1/brands/:brandId/archive': ['brand.archive'],
  'POST /api/v1/brands/:brandId/website': ['brand.website.connect'],
  'GET /api/v1/brands/:brandId/website': ['brand.read'],
  'POST /api/v1/brands/:brandId/scans': ['brand.scan.control'],
  'GET /api/v1/brands/:brandId/scans': ['brand.read'],
  'GET /api/v1/brands/:brandId/scans/:scanId': ['brand.read'],
  'POST /api/v1/brands/:brandId/scans/:scanId/cancel': ['brand.scan.control'],
  'POST /api/v1/brands/:brandId/scans/:scanId/retry': ['brand.scan.control'],
  'GET /api/v1/brands/:brandId/scans/:scanId/pages': ['brand.read'],
  'GET /api/v1/brands/:brandId/scans/:scanId/products': ['brand.read'],
  'GET /api/v1/brands/:brandId/scans/:scanId/evidence': ['brand.read'],
  'GET /api/v1/brands/:brandId/evidence/:evidenceId': ['brand.read'],
  'GET /api/v1/brands/:brandId/profiles': ['brand.read'],
  'GET /api/v1/brands/:brandId/profiles/:versionId': ['brand.read'],
  'GET /api/v1/brands/:brandId/profiles/:versionId/compare': ['brand.read'],
  'PATCH /api/v1/brands/:brandId/profiles/:versionId': ['brand.insight.edit'],
  'POST /api/v1/brands/:brandId/profiles/:versionId/approve': ['brand.version.approve'],
  'POST /api/v1/brands/:brandId/profiles/:versionId/reject': ['brand.version.approve'],
  'POST /api/v1/brands/:brandId/insights/:insightId/accept': ['brand.insight.decide'],
  'POST /api/v1/brands/:brandId/insights/:insightId/reject': ['brand.insight.decide'],
};

function matchRequirements(method: string, path: string): string[] | null {
  const normalized = path
    .replace(/\/api\/v1\/memberships\/[^/]+\//, '/api/v1/memberships/:id/')
    .replace(/\/api\/v1\/jobs\/[^/]+/, '/api/v1/jobs/:id')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/scans\/[^/]+\/cancel/,
      '/api/v1/brands/:brandId/scans/:scanId/cancel',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/scans\/[^/]+\/retry/,
      '/api/v1/brands/:brandId/scans/:scanId/retry',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/scans\/[^/]+\/pages/,
      '/api/v1/brands/:brandId/scans/:scanId/pages',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/scans\/[^/]+\/products/,
      '/api/v1/brands/:brandId/scans/:scanId/products',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/scans\/[^/]+\/evidence/,
      '/api/v1/brands/:brandId/scans/:scanId/evidence',
    )
    .replace(/\/api\/v1\/brands\/[^/]+\/scans\/[^/]+/, '/api/v1/brands/:brandId/scans/:scanId')
    .replace(/\/api\/v1\/brands\/[^/]+\/scans/, '/api/v1/brands/:brandId/scans')
    .replace(/\/api\/v1\/brands\/[^/]+\/website/, '/api/v1/brands/:brandId/website')
    .replace(/\/api\/v1\/brands\/[^/]+\/archive/, '/api/v1/brands/:brandId/archive')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/profiles\/[^/]+\/compare/,
      '/api/v1/brands/:brandId/profiles/:versionId/compare',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/profiles\/[^/]+\/approve/,
      '/api/v1/brands/:brandId/profiles/:versionId/approve',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/profiles\/[^/]+\/reject/,
      '/api/v1/brands/:brandId/profiles/:versionId/reject',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/profiles\/[^/]+/,
      '/api/v1/brands/:brandId/profiles/:versionId',
    )
    .replace(/\/api\/v1\/brands\/[^/]+\/profiles/, '/api/v1/brands/:brandId/profiles')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/insights\/[^/]+\/accept/,
      '/api/v1/brands/:brandId/insights/:insightId/accept',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/insights\/[^/]+\/reject/,
      '/api/v1/brands/:brandId/insights/:insightId/reject',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/evidence\/[^/]+/,
      '/api/v1/brands/:brandId/evidence/:evidenceId',
    )
    .replace(/\/api\/v1\/brands\/[^/]+/, '/api/v1/brands/:brandId');
  const key = `${method.toUpperCase()} ${normalized}`;
  for (const [k, v] of Object.entries(routeRequirements)) {
    const pattern = k
      .replace(':id', '[^/]+')
      .replace(':brandId', '[^/]+')
      .replace(':scanId', '[^/]+')
      .replace(':versionId', '[^/]+')
      .replace(':insightId', '[^/]+')
      .replace(':evidenceId', '[^/]+');
    if (
      new RegExp('^' + pattern.replace(/\//g, '\\/') + '$').test(`${method.toUpperCase()} ${path}`)
    )
      return v;
    if (k === key) return v;
  }
  return routeRequirements[`${method.toUpperCase()} ${path}`] ?? null;
}

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const required = matchRequirements(req.method, req.path);
    if (!required || required.length === 0) return true;
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    if (!req.oma.tenantId)
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        409,
        'errors.tenant_required',
      );

    const prisma = getPrisma();
    // A user may hold more than one ACTIVE membership row in a tenant, so the
    // effective capability set is the union across those rows.
    const memberships = await prisma.membership.findMany({
      where: tenantWhere(req.oma.tenantId, { userId: req.oma.userId, status: 'ACTIVE' }),
      include: { grants: { where: { revokedAt: null } } },
      orderBy: { createdAt: 'asc' },
    });
    const primary = memberships[0];
    if (!primary)
      throw new DomainError(
        'PERMISSION_DENIED',
        'No active membership',
        403,
        'errors.permission_denied',
      );
    const caps = [...new Set(memberships.flatMap((m) => m.grants.map((g) => g.capabilityCode)))];
    req.oma.capabilities = caps;
    req.oma.membershipId = primary.id;
    if (!hasCapability(caps, required)) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Missing capability',
        403,
        'errors.permission_denied',
      );
    }
    return true;
  }
}
