import { describe, expect, it } from 'vitest';
import { proposalFieldLabel, strategyProposalToItems } from '../../apps/web/src/lib/strategy-ai-ui';

describe('strategyProposalToItems', () => {
  it('maps v2 foundation contract to preview items', () => {
    const items = strategyProposalToItems({
      foundation: {
        goals: ['Grow awareness', 'Drive catalog sales'],
        positioning: 'Premium fragrance house',
        keyMessages: ['Authentic oud'],
      },
      organic: {
        pillars: ['Product stories'],
        channels: ['instagram'],
        formats: ['reel'],
      },
    });
    expect(items.some((i) => i.field === 'foundation.goals' && i.value.includes('awareness'))).toBe(
      true,
    );
    expect(items.find((i) => i.field === 'foundation.positioning')?.value).toContain('Premium');
    expect(items.find((i) => i.field === 'organic.pillars')?.value).toBe('Product stories');
  });

  it('maps technical field keys to human labels', () => {
    const label = proposalFieldLabel('foundation.goals', (k) =>
      k === 'strategy.foundation.goals' ? 'Goals' : k,
    );
    expect(label).toBe('Goals');
  });

  it('passes through legacy items array', () => {
    const items = strategyProposalToItems({
      items: [{ field: 'foundation.goals', value: 'Legacy goal', kind: 'proposal' }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.value).toBe('Legacy goal');
  });
});
