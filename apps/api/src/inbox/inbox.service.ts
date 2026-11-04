import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { classifySentiment } from './sentiment';

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
  page?: number;
  limit?: number;
};

function previewOf(text: string, max = 140) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export class InboxService {
  async listConversations(tenantId: string, q: ListConversationsQuery) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 30));
    const where = tenantWhere(tenantId, {
      ...(q.platform ? { platform: q.platform } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.sentiment ? { sentiment: q.sentiment } : {}),
      ...(q.assignedTo ? { assignedToUserId: q.assignedTo } : {}),
    });

    const [total, rows] = await Promise.all([
      getPrisma().inboxConversation.count({ where }),
      getPrisma().inboxConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((c) => ({
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
      })),
    };
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

    // Mark open / clear unread when viewed
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
      id: c.id,
      platform: c.platform,
      type: c.type,
      status: c.status === 'UNREAD' ? 'OPEN' : c.status,
      sentiment: c.sentiment,
      assignedToUserId: c.assignedToUserId,
      participantName: c.participantName,
      participantAvatar: c.participantAvatar,
      participantExtId: c.participantExtId,
      subject: c.subject,
      brandId: c.brandId,
      messageCount: c.messageCount,
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
      throw new DomainError('VALIDATION', 'Reply content required', 400, 'errors.validation');
    }
    const c = await getPrisma().inboxConversation.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!c) throw new DomainError('NOT_FOUND', 'Conversation not found', 404, 'errors.not_found');

    // Platform delivery is gated on real OAuth tokens; record outbound locally and
    // surface a honest flag when external send is not yet wired for this platform.
    const externalDelivered = false;

    const msgId = newId();
    await getPrisma().$transaction([
      getPrisma().inboxMessage.create({
        data: {
          id: msgId,
          tenantId,
          conversationId: id,
          senderExternalId: userId,
          senderName: 'Team',
          content,
          direction: 'OUTBOUND',
          mediaUrlsJson: null,
        },
      }),
      getPrisma().inboxConversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: previewOf(content),
          messageCount: { increment: 1 },
          status: c.status === 'CLOSED' ? 'OPEN' : c.status === 'UNREAD' ? 'OPEN' : c.status,
        },
      }),
    ]);

    return {
      id: msgId,
      externalDelivered,
      note: externalDelivered
        ? null
        : 'Outbound stored locally. Connect platform OAuth + Graph/TikTok APIs to deliver externally.',
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
        status: c.status === 'UNREAD' ? 'OPEN' : c.status === 'PENDING' ? 'PENDING' : c.status,
      },
    });
    return { id: updated.id, assignedToUserId: updated.assignedToUserId };
  }

  async addNote(tenantId: string, userId: string, id: string, body: { content?: string }) {
    const content = (body.content ?? '').trim();
    if (!content) {
      throw new DomainError('VALIDATION', 'Note content required', 400, 'errors.validation');
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
      data: { status },
    });
    return { id: updated.id, status: updated.status };
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
