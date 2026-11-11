import { Injectable } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import type { AuditService } from '../audit/audit.service';

const SUBJECT_MAX = 200;
const BODY_MAX = 8000;

function trimSubject(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < 3 || s.length > SUBJECT_MAX) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid subject', 400, 'errors.validation_failed');
  }
  return s;
}

function trimBody(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < 1 || s.length > BODY_MAX) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid message', 400, 'errors.validation_failed');
  }
  return s;
}

async function assertTenantMember(userId: string, tenantId: string) {
  const prisma = getPrisma();
  const m = await prisma.membership.findFirst({
    where: { userId, tenantId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!m) {
    throw new DomainError(
      'PERMISSION_DENIED',
      'Tenant membership required',
      403,
      'errors.permission_denied',
    );
  }
}

function serializeCase(row: {
  id: string;
  tenantId: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  createdBy: { id: string; name: string; email: string };
  messages?: Array<{
    id: string;
    authorUserId: string;
    authorKind: string;
    body: string;
    internal: boolean;
    createdAt: Date;
    author: { name: string };
  }>;
}) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    closed_at: row.closedAt?.toISOString() ?? null,
    created_by: {
      id: row.createdBy.id,
      name: row.createdBy.name,
      email: row.createdBy.email,
    },
    messages: row.messages
      ?.filter((m) => !m.internal)
      .map((m) => ({
        id: m.id,
        author_user_id: m.authorUserId,
        author_kind: m.authorKind,
        author_name: m.author.name,
        body: m.body,
        created_at: m.createdAt.toISOString(),
      })),
  };
}

function serializeCaseOperator(row: Parameters<typeof serializeCase>[0]) {
  const base = serializeCase(row);
  return {
    ...base,
    messages: row.messages?.map((m) => ({
      id: m.id,
      author_user_id: m.authorUserId,
      author_kind: m.authorKind,
      author_name: m.author.name,
      body: m.body,
      internal: m.internal,
      created_at: m.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class SupportCaseService {
  constructor(private readonly audit: AuditService) {}

  async createForCustomer(
    userId: string,
    tenantId: string,
    body: { subject?: unknown; message?: unknown },
    correlationId?: string,
  ) {
    if (!tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        400,
        'errors.tenant_required',
      );
    }
    await assertTenantMember(userId, tenantId);
    const subject = trimSubject(body.subject);
    const message = trimBody(body.message);
    const prisma = getPrisma();
    const caseRow = await prisma.$transaction(async (tx) => {
      const c = await tx.supportCase.create({
        data: {
          id: newId(),
          tenantId,
          createdByUserId: userId,
          subject,
          status: 'AWAITING_SUPPORT',
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
      await tx.supportCaseMessage.create({
        data: {
          id: newId(),
          caseId: c.id,
          authorUserId: userId,
          authorKind: 'customer',
          body: message,
        },
      });
      return c;
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'helpdesk.case.created',
      targetType: 'SupportCase',
      targetId: caseRow.id,
      correlationId,
    });
    return this.getForCustomer(userId, tenantId, caseRow.id);
  }

  async listForCustomer(userId: string, tenantId: string) {
    if (!tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        400,
        'errors.tenant_required',
      );
    }
    await assertTenantMember(userId, tenantId);
    const prisma = getPrisma();
    const rows = await prisma.supportCase.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return { data: rows.map((r) => serializeCase(r)) };
  }

  async getForCustomer(userId: string, tenantId: string, caseId: string) {
    if (!tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        400,
        'errors.tenant_required',
      );
    }
    await assertTenantMember(userId, tenantId);
    const prisma = getPrisma();
    const row = await prisma.supportCase.findFirst({
      where: { id: caseId, tenantId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        messages: {
          where: { internal: false },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Case not found', 404, 'errors.not_found');
    return { data: serializeCase(row) };
  }

  async replyAsCustomer(
    userId: string,
    tenantId: string,
    caseId: string,
    body: { message?: unknown },
    correlationId?: string,
  ) {
    if (!tenantId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        400,
        'errors.tenant_required',
      );
    }
    await assertTenantMember(userId, tenantId);
    const message = trimBody(body.message);
    const prisma = getPrisma();
    const existing = await prisma.supportCase.findFirst({
      where: { id: caseId, tenantId },
      select: { id: true, status: true },
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Case not found', 404, 'errors.not_found');
    if (existing.status === 'CLOSED') {
      throw new DomainError('CONFLICT_STATE', 'Case is closed', 409, 'errors.conflict_state');
    }
    await prisma.$transaction(async (tx) => {
      await tx.supportCaseMessage.create({
        data: {
          id: newId(),
          caseId,
          authorUserId: userId,
          authorKind: 'customer',
          body: message,
        },
      });
      await tx.supportCase.update({
        where: { id: caseId },
        data: { status: 'AWAITING_SUPPORT', updatedAt: new Date(), closedAt: null },
      });
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'helpdesk.case.customer_reply',
      targetType: 'SupportCase',
      targetId: caseId,
      correlationId,
    });
    return this.getForCustomer(userId, tenantId, caseId);
  }

  async listForOperator(input: { status?: string; q?: string }) {
    const prisma = getPrisma();
    const status =
      input.status &&
      ['OPEN', 'AWAITING_SUPPORT', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].includes(input.status)
        ? input.status
        : undefined;
    const q = input.q?.trim();
    const rows = await prisma.supportCase.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { subject: { contains: q, mode: 'insensitive' } },
                { id: q },
                { tenant: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    return {
      data: rows.map((r) => ({
        ...serializeCase(r),
        tenant: { id: r.tenant.id, name: r.tenant.name, slug: r.tenant.slug },
      })),
    };
  }

  async getForOperator(caseId: string) {
    const prisma = getPrisma();
    const row = await prisma.supportCase.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Case not found', 404, 'errors.not_found');
    return {
      data: {
        ...serializeCaseOperator(row),
        tenant: { id: row.tenant.id, name: row.tenant.name, slug: row.tenant.slug },
      },
    };
  }

  async replyAsOperator(
    actorUserId: string,
    caseId: string,
    body: { message?: unknown; internal?: boolean; status?: string },
    correlationId?: string,
  ) {
    const message = trimBody(body.message);
    const internal = Boolean(body.internal);
    const prisma = getPrisma();
    const existing = await prisma.supportCase.findUnique({
      where: { id: caseId },
      select: { id: true, tenantId: true, status: true },
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Case not found', 404, 'errors.not_found');

    let nextStatus = existing.status;
    if (
      body.status &&
      ['OPEN', 'AWAITING_SUPPORT', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].includes(body.status)
    ) {
      nextStatus = body.status as typeof nextStatus;
    } else if (!internal) {
      nextStatus = 'AWAITING_CUSTOMER';
    }

    const closedAt = nextStatus === 'CLOSED' || nextStatus === 'RESOLVED' ? new Date() : null;

    await prisma.$transaction(async (tx) => {
      await tx.supportCaseMessage.create({
        data: {
          id: newId(),
          caseId,
          authorUserId: actorUserId,
          authorKind: 'support',
          body: message,
          internal,
        },
      });
      await tx.supportCase.update({
        where: { id: caseId },
        data: { status: nextStatus, updatedAt: new Date(), closedAt },
      });
    });

    await this.audit.write({
      actorUserId,
      actorType: 'SUPPORT',
      tenantId: existing.tenantId,
      action: internal ? 'helpdesk.case.internal_note' : 'helpdesk.case.support_reply',
      targetType: 'SupportCase',
      targetId: caseId,
      afterRef: JSON.stringify({ status: nextStatus, internal }),
      correlationId,
    });

    return this.getForOperator(caseId);
  }
}
