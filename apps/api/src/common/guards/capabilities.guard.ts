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
};

function matchRequirements(method: string, path: string): string[] | null {
  const normalized = path
    .replace(/\/api\/v1\/memberships\/[^/]+\//, '/api/v1/memberships/:id/')
    .replace(/\/api\/v1\/jobs\/[^/]+/, '/api/v1/jobs/:id');
  const key = `${method.toUpperCase()} ${normalized}`;
  // try exact and pattern keys
  for (const [k, v] of Object.entries(routeRequirements)) {
    const pattern = k.replace(':id', '[^/]+');
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
    const membership = await prisma.membership.findFirst({
      where: tenantWhere(req.oma.tenantId, { userId: req.oma.userId, status: 'ACTIVE' }),
      include: { grants: { where: { revokedAt: null } } },
    });
    if (!membership)
      throw new DomainError(
        'PERMISSION_DENIED',
        'No active membership',
        403,
        'errors.permission_denied',
      );
    const caps = membership.grants.map((g) => g.capabilityCode);
    req.oma.capabilities = caps;
    req.oma.membershipId = membership.id;
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
