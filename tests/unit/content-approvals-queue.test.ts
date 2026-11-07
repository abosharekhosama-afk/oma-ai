import { describe, expect, it } from 'vitest';
import { bucketContentApprovals } from '../../apps/web/src/lib/content-approvals-queue';
import type { ContentCommentDto, ContentRowExtra } from '../../apps/web/src/lib/content-api';

function row(id: string, approvalState: string): ContentRowExtra {
  return {
    id,
    brandId: 'b1',
    campaignId: '',
    title: { en: id, ar: id },
    track: 'ORGANIC',
    channel: 'Instagram',
    contentType: 'POST',
    status: 'DRAFT',
    approvalState: approvalState as ContentRowExtra['approvalState'],
    scheduledAt: null,
    assignee: '',
    previewAsset: '',
    deliverableId: null,
  } as ContentRowExtra;
}

describe('bucketContentApprovals', () => {
  it('splits awaiting, feedback, and approved sections', () => {
    const comments = new Map<string, ContentCommentDto[]>([
      [
        'c2',
        [
          {
            id: 'cm1',
            author_user_id: 'user-1',
            body: { en: 'note', ar: 'note' },
            at: new Date().toISOString(),
          },
        ],
      ],
    ]);
    const buckets = bucketContentApprovals(
      [row('c1', 'PENDING'), row('c2', 'PARTIALLY_APPROVED'), row('c3', 'APPROVED')],
      { userId: 'user-1', commentsByContentId: comments },
    );
    expect(buckets.awaiting.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
    expect(buckets.feedback.map((r) => r.id)).toEqual(['c2']);
    expect(buckets.approved.map((r) => r.id)).toEqual(['c3']);
  });
});
