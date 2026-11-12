import { describe, expect, it } from 'vitest';
import { groupProposalItems } from '../../apps/web/src/lib/strategy-ai-ui';

describe('groupProposalItems', () => {
  it('groups by field prefix', () => {
    const map = groupProposalItems([
      { field: 'foundation.goals', value: 'Grow awareness' },
      { field: 'organic.pillars', value: 'Education' },
      { field: 'foundation.positioning', value: 'Premium play' },
    ]);
    expect(map.get('foundation')?.length).toBe(2);
    expect(map.get('organic')?.length).toBe(1);
  });
});
