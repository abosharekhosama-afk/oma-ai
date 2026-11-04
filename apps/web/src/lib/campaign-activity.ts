import type { ActivityItem } from './activity-api';

/** Events tied to this campaign, its posts, tasks, or deliverables. */
export function filterActivityForCampaign(
  items: ActivityItem[],
  campaignId: string,
  related: { contentIds: string[]; taskIds: string[]; deliverableIds: string[] },
): ActivityItem[] {
  const contentSet = new Set(related.contentIds);
  const taskSet = new Set(related.taskIds);
  const deliverableSet = new Set(related.deliverableIds);
  const campPath = `/app/campaigns/${encodeURIComponent(campaignId)}`;

  return items.filter((item) => {
    const t = item.target;
    if (!t?.href) return false;
    if (t.type === 'campaign' && t.href.includes(campPath)) return true;
    if (t.type === 'content') {
      const m = t.href.match(/[?&]item=([^&]+)/);
      if (m && contentSet.has(decodeURIComponent(m[1]))) return true;
    }
    if (t.type === 'task') {
      const m = t.href.match(/[?&]task=([^&]+)/);
      if (m && taskSet.has(decodeURIComponent(m[1]))) return true;
    }
    if (t.type === 'deliverable') {
      const m = t.href.match(/\/deliverables\/([^/?]+)/);
      if (m && deliverableSet.has(m[1])) return true;
    }
    return false;
  });
}
