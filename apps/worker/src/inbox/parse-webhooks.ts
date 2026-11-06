import { newId } from '@oma/domain';

export type InboxPlatform = 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN' | 'X' | 'WHATSAPP';

export type ParsedInbound = {
  tenantId?: string;
  platform: InboxPlatform;
  externalThreadId: string;
  type: 'DIRECT_MESSAGE' | 'POST_COMMENT' | 'DARK_COMMENT' | 'MENTION';
  externalMessageId?: string;
  senderExternalId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  mediaUrls?: string[];
  pageExternalId?: string;
};

export function parseMeta(raw: unknown, platform: 'META_FB' | 'META_IG'): ParsedInbound[] {
  const out: ParsedInbound[] = [];
  if (!raw || typeof raw !== 'object') return out;
  const body = raw as {
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: {
          mid?: string;
          text?: string;
          attachments?: Array<{ payload?: { url?: string } }>;
        };
      }>;
      changes?: Array<{
        field?: string;
        value?: {
          from?: { id?: string; username?: string };
          media?: { id?: string };
          text?: string;
          id?: string;
          comment_id?: string;
          post_id?: string;
          parent_id?: string;
        };
      }>;
    }>;
  };
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const text = m.message?.text ?? '';
      const mid = m.message?.mid;
      const sender = m.sender?.id ?? 'unknown';
      if (!text && !m.message?.attachments?.length) continue;
      out.push({
        platform,
        pageExternalId: entry.id,
        externalThreadId: `${entry.id ?? 'page'}:${sender}`,
        type: 'DIRECT_MESSAGE',
        externalMessageId: mid,
        senderExternalId: sender,
        senderName: sender,
        content: text || '[media]',
        mediaUrls: (m.message?.attachments ?? [])
          .map((a) => a.payload?.url)
          .filter(Boolean) as string[],
      });
    }
    for (const ch of entry.changes ?? []) {
      const v = ch.value;
      if (!v) continue;
      const text = v.text ?? '';
      const fromId = v.from?.id ?? 'unknown';
      const fromName = v.from?.username ?? fromId;
      const isDark = ch.field === 'comments' && !v.parent_id && platform === 'META_IG';
      out.push({
        platform,
        pageExternalId: entry.id,
        externalThreadId: String(v.post_id ?? v.media?.id ?? v.id ?? entry.id ?? 'thread'),
        type: isDark ? 'DARK_COMMENT' : ch.field === 'mentions' ? 'MENTION' : 'POST_COMMENT',
        externalMessageId: v.comment_id ?? v.id,
        senderExternalId: fromId,
        senderName: fromName,
        content: text || '[comment]',
      });
    }
  }
  return out;
}

export function parseWhatsApp(raw: unknown): ParsedInbound[] {
  const out: ParsedInbound[] = [];
  if (!raw || typeof raw !== 'object') return out;
  const body = raw as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
            image?: { id?: string; caption?: string };
            video?: { id?: string; caption?: string };
            audio?: { id?: string };
            document?: { caption?: string };
          }>;
        };
      }>;
    }>;
  };
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      const v = ch.value;
      if (!v) continue;
      const phoneId = v.metadata?.phone_number_id ?? entry.id ?? 'wa';
      const names = new Map(
        (v.contacts ?? []).map((c) => [c.wa_id ?? '', c.profile?.name ?? c.wa_id ?? '']),
      );
      for (const m of v.messages ?? []) {
        const from = m.from ?? 'unknown';
        const caption =
          m.text?.body ||
          m.image?.caption ||
          m.video?.caption ||
          m.document?.caption ||
          (m.type && m.type !== 'text' ? `[${m.type}]` : '');
        out.push({
          platform: 'WHATSAPP',
          pageExternalId: phoneId,
          externalThreadId: `${phoneId}:${from}`,
          type: 'DIRECT_MESSAGE',
          externalMessageId: m.id,
          senderExternalId: from,
          senderName: names.get(from) || from,
          content: caption || '[message]',
        });
      }
    }
  }
  return out;
}

export function parseX(raw: unknown): ParsedInbound[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as {
    direct_message_events?: Array<{
      id?: string;
      message_create?: {
        sender_id?: string;
        message_data?: { text?: string };
      };
    }>;
    tweet_create_events?: Array<{
      id_str?: string;
      user?: { id_str?: string; screen_name?: string };
      text?: string;
      in_reply_to_status_id_str?: string;
    }>;
    data?: { id?: string; text?: string; author_id?: string };
    includes?: { users?: Array<{ id?: string; name?: string; username?: string }> };
  };
  const out: ParsedInbound[] = [];
  for (const dm of o.direct_message_events ?? []) {
    const sender = dm.message_create?.sender_id ?? 'unknown';
    out.push({
      platform: 'X',
      externalThreadId: `x-dm:${sender}`,
      type: 'DIRECT_MESSAGE',
      externalMessageId: dm.id,
      senderExternalId: sender,
      senderName: sender,
      content: dm.message_create?.message_data?.text ?? '',
    });
  }
  for (const tw of o.tweet_create_events ?? []) {
    out.push({
      platform: 'X',
      externalThreadId: tw.in_reply_to_status_id_str ?? tw.id_str ?? newId(),
      type: tw.in_reply_to_status_id_str ? 'POST_COMMENT' : 'MENTION',
      externalMessageId: tw.id_str,
      senderExternalId: tw.user?.id_str ?? 'unknown',
      senderName: tw.user?.screen_name ?? 'X user',
      content: tw.text ?? '',
    });
  }
  if (o.data?.id && o.data.text) {
    const author = o.includes?.users?.find((u) => u.id === o.data?.author_id);
    out.push({
      platform: 'X',
      externalThreadId: o.data.id,
      type: 'MENTION',
      externalMessageId: o.data.id,
      senderExternalId: o.data.author_id ?? 'unknown',
      senderName: author?.username ?? author?.name ?? 'X user',
      content: o.data.text,
    });
  }
  return out;
}

export function parseTikTok(raw: unknown): ParsedInbound[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as {
    event?: string;
    type?: string;
    comment_id?: string;
    video_id?: string;
    content?: string;
    user_openid?: string;
    nickname?: string;
    data?: {
      comment_id?: string;
      video_id?: string;
      text?: string;
      content?: string;
      user_id?: string;
      user_openid?: string;
      user_nickname?: string;
      comment?: {
        id?: string;
        text?: string;
        video_id?: string;
        user_id?: string;
        user_nickname?: string;
      };
    };
  };
  const comment = o.data?.comment;
  const text = comment?.text || o.data?.text || o.data?.content || o.content || '';
  const messageId = comment?.id || o.data?.comment_id || o.comment_id;
  const videoId = comment?.video_id || o.data?.video_id || o.video_id;
  const sender = comment?.user_id || o.data?.user_id || o.data?.user_openid || o.user_openid;
  if (!text && !messageId) return [];
  return [
    {
      platform: 'TIKTOK',
      pageExternalId: videoId,
      externalThreadId: String(videoId ?? messageId ?? 'tiktok'),
      type: 'POST_COMMENT',
      externalMessageId: messageId,
      senderExternalId: String(sender ?? 'unknown'),
      senderName: comment?.user_nickname || o.data?.user_nickname || o.nickname || 'TikTok user',
      content: text || '[comment]',
    },
  ];
}

export function parseLinkedIn(raw: unknown): ParsedInbound[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as {
    eventType?: string;
    commentary?: string;
    commentUrn?: string;
    actor?: string;
    originalShare?: string;
    commentsOn?: string;
    notifications?: Array<{
      id?: string;
      commentary?: string;
      actor?: string;
      entity?: string;
    }>;
  };
  const rows = o.notifications?.length
    ? o.notifications
    : o.commentUrn || o.commentary
      ? [
          {
            id: o.commentUrn,
            commentary: o.commentary,
            actor: o.actor,
            entity: o.originalShare || o.commentsOn,
          },
        ]
      : [];
  return rows
    .filter((n) => n.commentary || n.id)
    .map((n) => ({
      platform: 'LINKEDIN' as const,
      pageExternalId: n.entity,
      externalThreadId: String(n.entity ?? n.id ?? 'linkedin'),
      type: 'POST_COMMENT' as const,
      externalMessageId: n.id,
      senderExternalId: n.actor ?? 'unknown',
      senderName: n.actor ?? 'LinkedIn user',
      content: n.commentary || '[comment]',
    }));
}

export function parseGeneric(raw: unknown, platform: InboxPlatform): ParsedInbound[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as {
    tenantId?: string;
    events?: Array<{
      threadId?: string;
      messageId?: string;
      type?: string;
      senderId?: string;
      senderName?: string;
      text?: string;
    }>;
  };
  return (o.events ?? []).map((e) => ({
    tenantId: o.tenantId,
    platform,
    externalThreadId: e.threadId ?? e.messageId ?? newId(),
    type: (e.type as ParsedInbound['type']) || 'DIRECT_MESSAGE',
    externalMessageId: e.messageId,
    senderExternalId: e.senderId ?? 'unknown',
    senderName: e.senderName ?? e.senderId ?? 'Unknown',
    content: e.text ?? '',
  }));
}

export function parseInboxWebhook(platform: InboxPlatform, raw: unknown): ParsedInbound[] {
  if (platform === 'META_FB' || platform === 'META_IG') return parseMeta(raw, platform);
  if (platform === 'WHATSAPP') return parseWhatsApp(raw);
  if (platform === 'X') {
    const x = parseX(raw);
    return x.length ? x : parseGeneric(raw, platform);
  }
  if (platform === 'TIKTOK') {
    const tt = parseTikTok(raw);
    return tt.length ? tt : parseGeneric(raw, platform);
  }
  if (platform === 'LINKEDIN') {
    const li = parseLinkedIn(raw);
    return li.length ? li : parseGeneric(raw, platform);
  }
  return parseGeneric(raw, platform);
}
