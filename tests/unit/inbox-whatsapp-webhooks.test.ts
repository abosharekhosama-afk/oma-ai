import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  detectMetaObject,
  eventIdFromPayload,
  metaSignatureOk,
} from '../../apps/api/src/webhooks/verify';
import {
  parseInboxWebhook,
  parseLinkedIn,
  parseTikTok,
  parseWhatsApp,
} from '../../apps/worker/src/inbox/parse-webhooks';
import { socialReadiness, SOCIAL_NETWORKS } from '@oma/domain';

describe('WhatsApp + webhook readiness', () => {
  it('lists WhatsApp as a first-class network with inbox and no feed publish', () => {
    expect(SOCIAL_NETWORKS).toContain('whatsapp');
    const ready = socialReadiness({
      META_APP_ID: 'app',
      META_APP_SECRET: 'sec',
      SOCIAL_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    const wa = ready.find((n) => n.network === 'whatsapp');
    expect(wa?.available).toBe(true);
    expect(wa?.inbox).toBe(true);
    expect(wa?.feed_publish).toBe(false);
    expect(wa?.webhooks).toBe(true);
  });

  it('parses Cloud API inbound text messages', () => {
    const parsed = parseWhatsApp({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PHONE' },
                contacts: [{ wa_id: '9665', profile: { name: 'Sara' } }],
                messages: [{ from: '9665', id: 'wamid.1', type: 'text', text: { body: 'مرحبا' } }],
              },
            },
          ],
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      platform: 'WHATSAPP',
      type: 'DIRECT_MESSAGE',
      senderName: 'Sara',
      content: 'مرحبا',
      externalThreadId: 'PHONE:9665',
    });
  });

  it('routes Meta objects to FB, IG, or WhatsApp', () => {
    expect(detectMetaObject({ object: 'whatsapp_business_account' })).toBe('WHATSAPP');
    expect(detectMetaObject({ object: 'instagram' })).toBe('META_IG');
    expect(detectMetaObject({ object: 'page' })).toBe('META_FB');
    expect(parseInboxWebhook('X', { data: { id: '1', text: 'hi', author_id: 'u' } })[0]?.type).toBe(
      'MENTION',
    );
  });

  it('rejects Meta webhooks when the app secret is set but the signature is missing or wrong', () => {
    const raw = Buffer.from('{"object":"page"}');
    const secret = 'app-secret';
    expect(metaSignatureOk(raw, undefined, secret).ok).toBe(false);
    const good = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(metaSignatureOk(raw, good, secret).ok).toBe(true);
    expect(eventIdFromPayload('META_FB', { entry: [{ id: 'p1', time: 9 }] })).toBe('META_FB:p1:9');
  });

  it('parses TikTok and LinkedIn comment webhooks', () => {
    const tt = parseTikTok({
      event: 'comment.create',
      comment_id: 'c1',
      video_id: 'v1',
      content: 'nice',
      user_openid: 'u1',
      nickname: 'Ada',
    });
    expect(tt[0]).toMatchObject({
      platform: 'TIKTOK',
      type: 'POST_COMMENT',
      content: 'nice',
      senderName: 'Ada',
    });
    const li = parseLinkedIn({
      eventType: 'COMMENT_ON_SHARE',
      commentary: 'great post',
      commentUrn: 'urn:li:comment:1',
      actor: 'urn:li:person:2',
      originalShare: 'urn:li:share:3',
    });
    expect(li[0]).toMatchObject({
      platform: 'LINKEDIN',
      type: 'POST_COMMENT',
      content: 'great post',
    });
    expect(
      parseInboxWebhook('TIKTOK', { events: [{ text: 'fallback', threadId: 't' }] })[0]?.content,
    ).toBe('fallback');
  });
});
