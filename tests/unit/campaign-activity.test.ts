import { describe, expect, it } from 'vitest';
import { filterActivityForCampaign } from '../../apps/web/src/lib/campaign-activity';
import type { ActivityItem } from '../../apps/web/src/lib/activity-api';

const base = (partial: Partial<ActivityItem>): ActivityItem => ({
  id: '1',
  at: new Date().toISOString(),
  action: 'content.updated',
  category: 'content',
  title: 'Updated',
  summary: 'Post updated',
  actor_name: 'Alex',
  ...partial,
});

describe('filterActivityForCampaign', () => {
  it('keeps campaign targets and related content', () => {
    const campId = 'camp-1';
    const contentId = 'post-9';
    const items = [
      base({
        id: 'a',
        target: {
          type: 'campaign',
          name: { en: 'Summer', ar: 'Summer' },
          href: `/app/campaigns/${campId}`,
        },
      }),
      base({
        id: 'b',
        target: {
          type: 'content',
          name: { en: 'Post', ar: 'Post' },
          href: `/app/content?item=${contentId}`,
        },
      }),
      base({
        id: 'c',
        target: {
          type: 'brand',
          name: { en: 'Brand', ar: 'Brand' },
          href: '/app/brands/x',
        },
      }),
    ];
    const out = filterActivityForCampaign(items, campId, {
      contentIds: [contentId],
      taskIds: [],
      deliverableIds: [],
    });
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
