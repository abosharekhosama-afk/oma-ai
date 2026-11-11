import { describe, expect, it } from 'vitest';
import { DomainError } from '@oma/domain';

describe('support case validation', () => {
  it('documents status enum for operator filters', () => {
    const statuses = ['OPEN', 'AWAITING_SUPPORT', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
    expect(statuses).toContain('AWAITING_SUPPORT');
  });

  it('DomainError includes helpdesk conflict code', () => {
    const err = new DomainError('CONFLICT_STATE', 'closed', 409, 'errors.conflict_state');
    expect(err.code).toBe('CONFLICT_STATE');
  });
});
