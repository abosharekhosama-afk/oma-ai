import { describe, expect, it } from 'vitest';
import {
  parseWorkDriveWebhookPayload,
  signWorkDriveWebhook,
  verifyWorkDriveWebhookSignature,
  webhookActionFor,
  webhookTimestampFresh,
} from '@oma/domain';

describe('WorkDrive webhook verification', () => {
  const secret = 'whsec_test';
  const raw = JSON.stringify({
    id: 'evt_1',
    type: 'file.trashed',
    created_at: new Date().toISOString(),
    data: { fileId: 'file-1' },
  });

  it('accepts HMAC-SHA256 over timestamp.rawBody and rejects a bad signature', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `sha256=${signWorkDriveWebhook(secret, ts, raw)}`;
    expect(verifyWorkDriveWebhookSignature(secret, ts, raw, sig)).toBe(true);
    expect(verifyWorkDriveWebhookSignature(secret, ts, raw, 'sha256=deadbeef')).toBe(false);
    expect(verifyWorkDriveWebhookSignature(secret, ts, `${raw} `, sig)).toBe(false);
  });

  it('enforces timestamp tolerance', () => {
    const now = Date.parse('2026-11-09T18:00:00+02:00');
    expect(webhookTimestampFresh(String(now / 1000), now, 300)).toBe(true);
    expect(webhookTimestampFresh(String(now / 1000 - 400), now, 300)).toBe(false);
    expect(webhookTimestampFresh('nope', now, 300)).toBe(false);
  });

  it('parses the event envelope and maps handlers, including idempotent identity via event id', () => {
    const parsed = parseWorkDriveWebhookPayload(JSON.parse(raw), 'file.trashed');
    expect(parsed).toEqual({
      eventId: 'evt_1',
      type: 'file.trashed',
      createdAt: expect.any(String),
      data: { fileId: 'file-1' },
    });
    expect(webhookActionFor(parsed!)).toEqual({ type: 'mark_missing', fileId: 'file-1' });
    expect(
      webhookActionFor({
        eventId: 'evt_2',
        type: 'file.restored',
        createdAt: null,
        data: { fileId: 'file-1' },
      }),
    ).toEqual({ type: 'mark_restored', fileId: 'file-1' });
    expect(
      webhookActionFor({
        eventId: 'evt_3',
        type: 'integration_key.revoked',
        createdAt: null,
        data: { keyId: 'k1', prefix: 'wdk_abc' },
      }),
    ).toEqual({ type: 'key_revoked', keyId: 'k1', prefix: 'wdk_abc' });
    expect(
      webhookActionFor({
        eventId: 'evt_4',
        type: 'storage.quota_exceeded',
        createdAt: null,
        data: {},
      }),
    ).toEqual({ type: 'quota_exceeded' });
    expect(
      webhookActionFor({
        eventId: 'evt_5',
        type: 'storage.quota_near_limit',
        createdAt: null,
        data: {},
      }),
    ).toEqual({ type: 'noop' });
  });
});
