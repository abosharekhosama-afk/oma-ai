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
  'GET /api/v1/analytics': ['analytics.read'],
  'PATCH /api/v1/workspace/settings': ['tenant.manage'],
  'GET /api/v1/home': ['brand.read'],
  'GET /api/v1/activity': ['brand.read'],
  'GET /api/v1/notifications': ['notification.read'],
  'GET /api/v1/notifications/unread-count': ['notification.read'],
  'POST /api/v1/notifications/read-all': ['notification.read'],
  'POST /api/v1/notifications/:id/read': ['notification.read'],
  'GET /api/v1/jobs/:id': ['job.read'],
  'POST /api/v1/jobs/:id/cancel': ['job.read'],
  'GET /api/v1/ai/budget': ['ai.configure'],
  'POST /api/v1/ai/runs': ['ai.propose.strategy'],
  'GET /api/v1/ai/runs/:id': ['ai.propose.strategy'],
  'POST /api/v1/ai/runs/:id/cancel': ['ai.propose.strategy'],
  'POST /api/v1/ai/runs/:id/accept': ['ai.propose.strategy'],
  'POST /api/v1/ai/runs/:id/reject': ['ai.propose.strategy'],
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
  'GET /api/v1/brands/:brandId/strategies': ['strategy.read'],
  'POST /api/v1/brands/:brandId/strategies': ['strategy.create'],
  'GET /api/v1/brands/:brandId/strategies/:strategyId': ['strategy.read'],
  'PATCH /api/v1/brands/:brandId/strategies/:strategyId': ['strategy.edit'],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/archive': ['strategy.archive'],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions': ['strategy.read'],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/compare': ['strategy.compare'],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/from-approved': ['strategy.edit'],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId': ['strategy.read'],
  'PATCH /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId': ['strategy.edit'],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/link-profile': [
    'strategy.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/tracks/enablement': [
    'strategy.edit',
  ],
  'PATCH /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/organic': [
    'strategy.organic.edit',
  ],
  'PATCH /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/paid': [
    'strategy.paid.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/audiences': [
    'strategy.edit',
  ],
  'DELETE /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/audiences/:audienceId':
    ['strategy.edit'],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/competitors': [
    'strategy.edit',
  ],
  'DELETE /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/competitors/:competitorId':
    ['strategy.edit'],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/kpis': ['strategy.edit'],
  'DELETE /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/kpis/:kpiId': [
    'strategy.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/gaps': ['strategy.edit'],
  'DELETE /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/gaps/:gapId': [
    'strategy.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/evidence-links': [
    'strategy.evidence.link',
  ],
  'DELETE /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/evidence-links/:linkId':
    ['strategy.evidence.link'],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/evidence-links/:linkId': [
    'strategy.read',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/submit': [
    'strategy.submit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/approve': [
    'strategy.approve',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/request-changes': [
    'strategy.approve',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/reject': [
    'strategy.approve',
  ],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/comments': [
    'strategy.read',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/comments': [
    'strategy.comment',
  ],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/decisions': [
    'strategy.read',
  ],
  'GET /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/approval': [
    'strategy.read',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/revise': [
    'strategy.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/clone': [
    'strategy.edit',
  ],
  'POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/ai/propose': [
    'strategy.edit',
  ],
  'GET /api/v1/brands/:brandId/current-strategy': ['strategy.read'],
  'POST /api/v1/brands/:brandId/current-strategy': ['strategy.set_current'],

  'GET /api/v1/brands/:brandId/campaigns': ['campaign.read'],
  'POST /api/v1/brands/:brandId/campaigns': ['campaign.create'],
  'GET /api/v1/campaigns/:campaignId': ['campaign.read'],
  'PATCH /api/v1/campaigns/:campaignId': ['campaign.update'],
  'POST /api/v1/campaigns/:campaignId/archive': ['campaign.archive'],
  'GET /api/v1/brands/:brandId/content': ['content.read'],
  'POST /api/v1/brands/:brandId/content': ['content.create'],
  'GET /api/v1/content/:contentId': ['content.read'],
  'PATCH /api/v1/content/:contentId': ['content.update'],
  'POST /api/v1/content/:contentId/request-approval': ['content.request_approval'],
  'POST /api/v1/content/:contentId/approve': ['content.approve'],
  'POST /api/v1/content/:contentId/reject': ['content.approve'],
  'POST /api/v1/content/:contentId/mark-published': ['content.update'],
  'GET /api/v1/content/:contentId/comments': ['content.read'],
  'POST /api/v1/content/:contentId/comments': ['content.update'],
  'DELETE /api/v1/content/:contentId/comments/:commentId': ['content.update'],
  'GET /api/v1/brands/:brandId/requests': ['content.read'],
  'POST /api/v1/brands/:brandId/requests': ['content.create'],
  'GET /api/v1/requests/:requestId': ['content.read'],
  'PATCH /api/v1/requests/:requestId': ['content.update'],
  'POST /api/v1/requests/:requestId/convert-to-task': ['content.update'],
  'GET /api/v1/brands/:brandId/tasks': ['content.read'],
  'POST /api/v1/brands/:brandId/tasks': ['content.create'],
  'PATCH /api/v1/tasks/:taskId': ['content.update'],
  'POST /api/v1/tasks/:taskId/convert-to-deliverable': ['content.update'],
  'GET /api/v1/brands/:brandId/deliverables': ['deliverable.read'],
  'GET /api/v1/deliverables/:deliverableId': ['deliverable.read'],
  'PATCH /api/v1/deliverables/:deliverableId': ['deliverable.write'],
  'POST /api/v1/deliverables/:deliverableId/review': ['deliverable.read'],
  'POST /api/v1/deliverables/:deliverableId/versions': ['deliverable.version.create'],
  'POST /api/v1/deliverables/:deliverableId/annotations': ['deliverable.annotate'],
  'PATCH /api/v1/deliverable-annotations/:annotationId': ['deliverable.annotate'],
  'POST /api/v1/deliverables/:deliverableId/comments': ['deliverable.annotate'],
  'GET /api/v1/tasks/:taskId': ['task.read'],
  'POST /api/v1/tasks/:taskId/checklist': ['task.write'],
  'PATCH /api/v1/tasks/:taskId/checklist/:itemId': ['task.write'],
  'POST /api/v1/tasks/:taskId/comments': ['task.write'],

  'POST /api/v1/content/:contentId/request-changes': ['content.approve'],
  'POST /api/v1/content/:contentId/schedule': ['content.schedule'],
  'POST /api/v1/content/:contentId/unschedule': ['content.schedule'],
  'POST /api/v1/content/:contentId/archive': ['content.archive'],
  'GET /api/v1/brands/:brandId/content-preferences': ['content.read'],
  'PATCH /api/v1/brands/:brandId/content-preferences': ['content.update'],

  'GET /api/v1/brands/:brandId/day-notes': ['content.read'],
  'POST /api/v1/brands/:brandId/day-notes': ['content.update'],
  'DELETE /api/v1/brands/:brandId/day-notes/:dayKey': ['content.update'],
  'GET /api/v1/brands/:brandId/content-labels': ['content.read'],
  'POST /api/v1/brands/:brandId/content-labels': ['content.update'],
  'DELETE /api/v1/brands/:brandId/content-labels/:labelId': ['content.update'],
  'POST /api/v1/content/:contentId/labels': ['content.update'],
  'POST /api/v1/content/:contentId/visibility': ['content.update'],
  'GET /api/v1/brands/:brandId/content-templates': ['content.read'],
  'POST /api/v1/brands/:brandId/content-templates': ['content.create'],
  'DELETE /api/v1/brands/:brandId/content-templates/:templateId': ['content.update'],
  'POST /api/v1/brands/:brandId/content-templates/:templateId/use': ['content.create'],
};

function matchRequirements(method: string, path: string): string[] | null {
  const normalized = path
    .replace(/\/api\/v1\/memberships\/[^/]+\//, '/api/v1/memberships/:id/')
    .replace(/\/api\/v1\/notifications\/[^/]+\/read/, '/api/v1/notifications/:id/read')
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
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/compare/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/compare',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/from-approved/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/from-approved',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/link-profile/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/link-profile',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/tracks\/enablement/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/tracks/enablement',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/organic/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/organic',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/paid/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/paid',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/audiences\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/audiences/:audienceId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/audiences/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/audiences',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/competitors\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/competitors/:competitorId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/competitors/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/competitors',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/kpis\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/kpis/:kpiId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/kpis/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/kpis',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/gaps\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/gaps/:gapId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/gaps/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/gaps',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/evidence-links\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/evidence-links/:linkId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/evidence-links/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/evidence-links',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/submit/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/submit',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/approve/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/approve',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/request-changes/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/request-changes',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/reject/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/reject',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/comments/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/comments',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/decisions/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/decisions',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/approval/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/approval',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/revise/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/revise',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/clone/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/clone',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+\/ai\/propose/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/ai/propose',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/versions/,
      '/api/v1/brands/:brandId/strategies/:strategyId/versions',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+\/archive/,
      '/api/v1/brands/:brandId/strategies/:strategyId/archive',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/strategies\/[^/]+/,
      '/api/v1/brands/:brandId/strategies/:strategyId',
    )
    .replace(/\/api\/v1\/brands\/[^/]+\/strategies/, '/api/v1/brands/:brandId/strategies')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/day-notes\/[^/]+/,
      '/api/v1/brands/:brandId/day-notes/:dayKey',
    )
    .replace(/\/api\/v1\/brands\/[^/]+\/day-notes/, '/api/v1/brands/:brandId/day-notes')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/content-labels\/[^/]+/,
      '/api/v1/brands/:brandId/content-labels/:labelId',
    )
    .replace(/\/api\/v1\/brands\/[^/]+\/content-labels/, '/api/v1/brands/:brandId/content-labels')
    .replace(
      /\/api\/v1\/brands\/[^/]+\/content-templates\/[^/]+\/use/,
      '/api/v1/brands/:brandId/content-templates/:templateId/use',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/content-templates\/[^/]+/,
      '/api/v1/brands/:brandId/content-templates/:templateId',
    )
    .replace(
      /\/api\/v1\/brands\/[^/]+\/content-templates/,
      '/api/v1/brands/:brandId/content-templates',
    )
    .replace(/\/api\/v1\/content\/[^/]+\/labels/, '/api/v1/content/:contentId/labels')
    .replace(/\/api\/v1\/content\/[^/]+\/visibility/, '/api/v1/content/:contentId/visibility')

    .replace(
      /\/api\/v1\/brands\/[^/]+\/current-strategy/,
      '/api/v1/brands/:brandId/current-strategy',
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
      .replace(':strategyId', '[^/]+')
      .replace(':versionId', '[^/]+')
      .replace(':audienceId', '[^/]+')
      .replace(':competitorId', '[^/]+')
      .replace(':kpiId', '[^/]+')
      .replace(':gapId', '[^/]+')
      .replace(':linkId', '[^/]+')
      .replace(':insightId', '[^/]+')
      .replace(':campaignId', '[^/]+')
      .replace(':contentId', '[^/]+')
      .replace(':deliverableId', '[^/]+')
      .replace(':annotationId', '[^/]+')
      .replace(':taskId', '[^/]+')
      .replace(':itemId', '[^/]+')
      .replace(':requestId', '[^/]+')
      .replace(':commentId', '[^/]+')
      .replace(':dayKey', '[^/]+')
      .replace(':labelId', '[^/]+')
      .replace(':templateId', '[^/]+')
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
