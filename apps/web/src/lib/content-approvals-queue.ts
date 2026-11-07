import type { ContentCommentDto, ContentRowExtra } from './content-api';

export type ApprovalSection = 'awaiting' | 'feedback' | 'approved';

export type ApprovalQueueBuckets = Record<ApprovalSection, ContentRowExtra[]>;

/** Planable My approvals: awaiting · feedback left · approved. */
export function bucketContentApprovals(
  items: ContentRowExtra[],
  opts: {
    userId: string | null;
    commentsByContentId: Map<string, ContentCommentDto[]>;
  },
): ApprovalQueueBuckets {
  const buckets: ApprovalQueueBuckets = { awaiting: [], feedback: [], approved: [] };
  const { userId, commentsByContentId } = opts;

  for (const item of items) {
    const state = item.approvalState || 'NOT_REQUESTED';
    if (state === 'NOT_REQUESTED') continue;

    if (state === 'APPROVED') {
      buckets.approved.push(item);
      continue;
    }

    const comments = commentsByContentId.get(item.id) ?? [];
    const userLeftFeedback =
      Boolean(userId) && comments.some((c) => c.author_user_id === userId && !c.resolved_at);

    if (state === 'PENDING' || state === 'PARTIALLY_APPROVED') {
      buckets.awaiting.push(item);
      if (userLeftFeedback) buckets.feedback.push(item);
      continue;
    }

    if (userLeftFeedback && state !== 'APPROVED') {
      buckets.feedback.push(item);
    }
  }

  const byDate = (a: ContentRowExtra, b: ContentRowExtra) =>
    (b.scheduledAt ?? b.plannedAt ?? b.id).localeCompare(a.scheduledAt ?? a.plannedAt ?? a.id);

  for (const key of Object.keys(buckets) as ApprovalSection[]) {
    buckets[key].sort(byDate);
  }
  return buckets;
}

export function approvalQueueTotal(buckets: ApprovalQueueBuckets): number {
  return buckets.awaiting.length + buckets.feedback.length;
}

export function commentCountFor(contentId: string, map: Map<string, ContentCommentDto[]>): number {
  return map.get(contentId)?.filter((c) => !c.resolved_at).length ?? 0;
}
