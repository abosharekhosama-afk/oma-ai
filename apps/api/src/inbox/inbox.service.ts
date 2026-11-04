import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { classifySentiment } from './sentiment';
import { tryPlatformReply } from './platform-reply';

type Platform = 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
type ConvType = 'DIRECT_MESSAGE' | 'POST_COMMENT' | 'DARK_COMMENT' | 'MENTION';
type Status = 'UNREAD' | 'OPEN' | 'PENDING' | 'CLOSED';
type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export type ListConversationsQuery = {
  platform?: Platform;
  status?: Status;
  type?: ConvType;
  sentiment?: Sentiment;
  assignedTo?: string;
  /** when true, only unassigned */
  unassigned?: boolean;
  priority?: boolean;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
};

function previewOf(text: string, max = 140) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function parseTags(tagsJson: string | null | undefined): string[] {
  try {
    const v = JSON.parse(tagsJson || '[]');
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mapConv(c: {
  id: string;
  platform: string;
  type: string;
  status: string;
  sentiment: string | null;
  assignedToUserId: string | null;
  participantName: string | null;
  participantAvatar: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  messageCount: number;
  unreadCount: number;
  subject: string | null;
  brandId: string | null;
  priority: boolean;
  tagsJson: string;
  socialPageId: string | null;
  firstResponseAt: Date | null;
  closedAt: Date | null;
}) {
  return {
    id: c.id,
    platform: c.platform,
    type: c.type,
    status: c.status,
    sentiment: c.sentiment,
    assignedToUserId: c.assignedToUserId,
    participantName: c.participantName,
    participantAvatar: c.participantAvatar,
    lastMessageAt: c.lastMessageAt.toISOString(),
    lastMessagePreview: c.lastMessagePreview,
    messageCount: c.messageCount,
    unreadCount: c.unreadCount,
    subject: c.subject,
    brandId: c.brandId,
    priority: c.priority,
    tags: parseTags(c.tagsJson),
    socialPageId: c.socialPageId,
    firstResponseAt: c.firstResponseAt?.toISOString() ?? null,
    closedAt: c.closedAt?.toISOString() ?? null,
  };
}

export class InboxService {
  async stats(tenantId: string) {
    const base = tenantWhere(tenantId, {});
    const [total, unread, open, pending, closed, priority, unassigned] = await Promise.all([
      getPrisma().inboxConversation.count({ where: base }),
      getPrisma().inboxConversation.count({ where: tenantWhere(tenantId, { status: 'UNREAD' }) }),
      getPrisma().inboxConversation.count({ where: tenantWhere(tenantId, { status: 'OPEN' }) }),
      getPrisma().inboxConversation.count({ where: tenantWhere(tenantId, { status: 'PENDING' }) }),
      getPrisma().inboxConversation.count({ where: tenantWhere(tenantId, { status: 'CLOSED' }) }),
      getPrisma().inboxConversation.count({ where: tenantWhere(tenantId, { priority: true }) }),
      getPrisma().inboxConversation.count({
        where: tenantWhere(tenantId, { assignedToUserId: null, status: { not: 'CLOSED' } }),
      }),
    ]);
    return { total, unread, open, pending, closed, priority, unassigned };
  }

  async listConversations(tenantId: string, q: ListConversationsQuery) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 30));
    const where = tenantWhere(tenantId, {
      ...(q.platform ? { platform: q.platform } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.sentiment ? { sentiment: q.sentiment } : {}),
      ...(q.priority === true ? { priority: true } : {}),
      ...(q.unassigned ? { assignedToUserId: null } : {}),
      ...(q.assignedTo ? { assignedToUserId: q.assignedTo } : {}),
      ...(q.tag
        ? {
            tagsJson: { contains: q.tag },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { participantName: { contains: q.q, mode: 'insensitive' as const } },
              { lastMessagePreview: { contains: q.q, mode: 'insensitive' as const } },
              { subject: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    });

    const [total, rows] = await Promise.all([
      getPrisma().inboxConversation.count({ where }),
      getPrisma().inboxConversation.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { page, limit, total, items: rows.map(mapConv) };
  }

  async getConversation(tenantId: string, id: string) {
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');

    const [messages, notes] = await Promise.all([
      getPrisma().inboxMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        take: 500,
      }),
      getPrisma().inboxInternalNote.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    ]);

    if (c.unreadCount > 0 || c.status === 'UNREAD') {
      await getPrisma().inboxConversation.update({
        where: { id },
        data: {
          unreadCount: 0,
          status: c.status === 'UNREAD' ? 'OPEN' : c.status,
        },
      });
    }

    return {
      ...mapConv({ ...c, status: c.status === 'UNREAD' ? 'OPEN' : c.status }),
      participantExtId: c.participantExtId,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        senderExternalId: m.senderExternalId,
        content: m.content,
        mediaUrls: m.mediaUrlsJson ? safeJson(m.mediaUrlsJson) : [],
        createdAt: m.createdAt.toISOString(),
      })),
      notes: notes.map((n) => ({
        id: n.id,
        authorUserId: n.authorUserId,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async reply(tenantId: string, userId: string, id: string, body: { content?: string }) {
    const content = (body.content ?? '').trim();
    if (!content) {
      throw new DomainError('VALIDATION_FAILED', 'Reply content required', 400, 'errors.validation');
    }
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');

    const delivery = await tryPlatformReply({
      tenantId,
      platform: c.platform as Platform,
      brandId: c.brandId,
      socialPageId: c.socialPageId,
      externalThreadId: c.externalThreadId,
      type: c.type,
      participantExtId: c.participantExtId,
      content,
    });

    const msgId = newId();
    const now = new Date();
    await getPrisma().$transaction([
      getPrisma().inboxMessage.create({
        data: {
          id: msgId,
          tenantId,
          conversationId: id,
          externalMessageId: delivery.delivered ? delivery.externalMessageId : null,
          senderExternalId: userId,
          senderName: 'Team',
          content,
          direction: 'OUTBOUND',
          mediaUrlsJson: null,
          rawPayloadJson: JSON.stringify({
            platformDelivered: delivery.delivered,
            platformReason: delivery.delivered ? null : delivery.reason,
          }),
        },
      }),
      getPrisma().inboxConversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: previewOf(content),
          messageCount: { increment: 1 },
          status: c.status === 'CLOSED' ? 'OPEN' : c.status === 'UNREAD' ? 'OPEN' : c.status,
          firstResponseAt: c.firstResponseAt ?? now,
        },
      }),
    ]);

    return {
      id: msgId,
      externalDelivered: delivery.delivered,
      externalMessageId: delivery.delivered ? delivery.externalMessageId : null,
      note: delivery.delivered ? null : delivery.reason,
    };
  }

  async assign(tenantId: string, id: string, body: { assignedToUserId?: string | null }) {
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');
    const assignedToUserId =
      body.assignedToUserId === undefined ? c.assignedToUserId : body.assignedToUserId || null;
    const updated = await getPrisma().inboxConversation.update({
      where: { id },
      data: {
        assignedToUserId,
        status: c.status === 'UNREAD' ? 'OPEN' : c.status,
      },
    });
    return { id: updated.id, assignedToUserId: updated.assignedToUserId };
  }

  async setTags(tenantId: string, id: string, body: { tags?: string[] }) {
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');
    const tags = (body.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const updated = await getPrisma().inboxConversation.update({
      where: { id },
      data: { tagsJson: JSON.stringify(tags) },
    });
    return { id: updated.id, tags };
  }

  async setPriority(tenantId: string, id: string, body: { priority?: boolean }) {
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');
    const updated = await getPrisma().inboxConversation.update({
      where: { id },
      data: { priority: Boolean(body.priority) },
    });
    return { id: updated.id, priority: updated.priority };
  }

  async addNote(tenantId: string, userId: string, id: string, body: { content?: string }) {
    const content = (body.content ?? '').trim();
    if (!content) {
      throw new DomainError('VALIDATION_FAILED', 'Note content required', 400, 'errors.validation');
    }
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');
    const noteId = newId();
    await getPrisma().inboxInternalNote.create({
      data: {
        id: noteId,
        tenantId,
        conversationId: id,
        authorUserId: userId,
        content,
      },
    });
    return { id: noteId, content, authorUserId: userId, createdAt: new Date().toISOString() };
  }

  async updateStatus(tenantId: string, id: string, status: Status) {
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');
    const updated = await getPrisma().inboxConversation.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : null,
        unreadCount: status === 'UNREAD' ? c.unreadCount : status === 'OPEN' ? 0 : c.unreadCount,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  async bulkUpdate(
    tenantId: string,
    body: {
      ids?: string[];
      status?: Status;
      assignedToUserId?: string | null;
      priority?: boolean;
    },
  ) {
    const ids = (body.ids ?? []).filter(Boolean).slice(0, 100);
    if (!ids.length) {
      throw new DomainError('VALIDATION_FAILED', 'ids required', 400, 'errors.validation');
    }
    const data: Record<string, unknown> = {};
    if (body.status) {
      data.status = body.status;
      data.closedAt = body.status === 'CLOSED' ? new Date() : null;
    }
    if (body.assignedToUserId !== undefined) data.assignedToUserId = body.assignedToUserId;
    if (body.priority !== undefined) data.priority = body.priority;
    if (!Object.keys(data).length) {
      throw new DomainError('VALIDATION_FAILED', 'No update fields', 400, 'errors.validation');
    }
    const result = await getPrisma().inboxConversation.updateMany({
      where: tenantWhere(tenantId, { id: { in: ids } }),
      data,
    });
    return { updated: result.count };
  }

  /** Upsert used by webhook worker after parsing platform payloads. */
  async ingestInbound(input: {
    tenantId: string;
    brandId?: string | null;
    platform: Platform;
    externalThreadId: string;
    type: ConvType;
    externalMessageId?: string | null;
    senderExternalId: string;
    senderName: string;
    senderAvatar?: string | null;
    content: string;
    mediaUrls?: string[];
    rawPayloadJson?: string | null;
  }) {
    const sentiment = classifySentiment(input.content);
    const prisma = getPrisma();
    const existing = await prisma.inboxConversation.findUnique({
      where: {
        tenantId_platform_externalThreadId: {
          tenantId: input.tenantId,
          platform: input.platform,
          externalThreadId: input.externalThreadId,
        },
      },
    });

    const convId = existing?.id ?? newId();
    const priority = sentiment === 'NEGATIVE';
    if (!existing) {
      await prisma.inboxConversation.create({
        data: {
          id: convId,
          tenantId: input.tenantId,
          brandId: input.brandId ?? null,
          platform: input.platform,
          externalThreadId: input.externalThreadId,
          type: input.type,
          status: 'UNREAD',
          sentiment,
          priority,
          participantName: input.senderName,
          participantAvatar: input.senderAvatar ?? null,
          participantExtId: input.senderExternalId,
          lastMessageAt: new Date(),
          lastMessagePreview: previewOf(input.content),
          messageCount: 0,
          unreadCount: 0,
        },
      });
    }

    if (input.externalMessageId) {
      const dup = await prisma.inboxMessage.findFirst({
        where: { conversationId: convId, externalMessageId: input.externalMessageId },
        select: { id: true },
      });
      if (dup) return { conversationId: convId, messageId: dup.id, duplicate: true };
    }

    const messageId = newId();
    await prisma.$transaction([
      prisma.inboxMessage.create({
        data: {
          id: messageId,
          tenantId: input.tenantId,
          conversationId: convId,
          externalMessageId: input.externalMessageId ?? null,
          senderExternalId: input.senderExternalId,
          senderName: input.senderName,
          senderAvatar: input.senderAvatar ?? null,
          content: input.content,
          mediaUrlsJson: input.mediaUrls?.length ? JSON.stringify(input.mediaUrls) : null,
          direction: 'INBOUND',
          rawPayloadJson: input.rawPayloadJson ?? null,
        },
      }),
      prisma.inboxConversation.update({
        where: { id: convId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: previewOf(input.content),
          messageCount: { increment: 1 },
          unreadCount: { increment: 1 },
          sentiment,
          priority: existing?.priority || priority,
          status: existing?.status === 'CLOSED' ? 'UNREAD' : existing?.status ?? 'UNREAD',
          participantName: input.senderName,
          participantAvatar: input.senderAvatar ?? null,
        },
      }),
    ]);

    return { conversationId: convId, messageId, duplicate: false, sentiment };
  }
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export const inboxService = new InboxService();
