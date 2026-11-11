import { describe, expect, it } from 'vitest';
import { SupportService } from '../../apps/api/src/platform/support.service';

describe('SupportService.lookup validation', () => {
  const svc = new SupportService(
    { write: async () => ({}) } as never,
    { createSessionForUser: async () => ({}) } as never,
  );

  it('rejects overly short queries', async () => {
    await expect(svc.lookup({ q: 'a' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
