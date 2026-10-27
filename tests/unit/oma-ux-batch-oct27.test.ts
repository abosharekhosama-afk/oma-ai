import { describe, expect, it } from 'vitest';
import { notificationAllowed, WorkDriveClient, type FetchLike } from '@oma/domain';

const KEY = `wdk_0123456789ab_${'K'.repeat(43)}`;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

describe('notificationAllowed', () => {
  it('defaults to on, honours per-type off and the mute-all switch', () => {
    expect(notificationAllowed(null, 'task.assigned')).toBe(true);
    expect(notificationAllowed('not json', 'task.assigned')).toBe(true);
    expect(notificationAllowed('{"notifications":{"task.assigned":false}}', 'task.assigned')).toBe(
      false,
    );
    expect(
      notificationAllowed('{"notifications":{"task.assigned":false}}', 'review.requested'),
    ).toBe(true);
    expect(notificationAllowed('{"notifications":{"all":false}}', 'social.disconnected')).toBe(
      false,
    );
  });
});

describe('WorkDrive direct upload (browser PUT)', () => {
  it('requestUpload retries a name conflict and never returns the key', async () => {
    const names: string[] = [];
    const fn: FetchLike = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (String(_url).endsWith('/files/upload-complete')) return json({ file_id: 'f2' }, 201);
      names.push(body.name);
      if (names.length === 1) return json({ error: { code: 'conflict', message: 'exists' } }, 409);
      return json(
        { upload_url: 'https://o.example.com/put?token=t', upload_id: 'u2', file_id: 'f2' },
        201,
      );
    };
    const c = new WorkDriveClient('https://wd.example.com', KEY, fn);
    const r = await c.requestUpload({
      folderId: 'd',
      name: 'cut.mp4',
      mimeType: 'video/mp4',
      size: 9,
      sha256: 'a'.repeat(64),
    });
    expect(names).toEqual(['cut.mp4', 'cut (2).mp4']);
    expect(r).toEqual({
      uploadUrl: 'https://o.example.com/put?token=t',
      uploadId: 'u2',
      fileId: 'f2',
      name: 'cut (2).mp4',
    });
    expect(JSON.stringify(r)).not.toContain('wdk_');
    expect(await c.completeUpload('u2')).toEqual({ fileId: 'f2' });
  });
});
