import { CONTENT_TYPES, type ContentType } from './states';

/** Whether approving this ops package should materialize or refresh a calendar ContentItem. */
export function shouldHandoffDeliverableToContent(input: {
  requestType?: string | null;
  channels?: string[] | null;
}): boolean {
  const type = (input.requestType ?? 'CONTENT').toUpperCase();
  if (type === 'REVIEW') return false;
  const channels = input.channels ?? [];
  if (type === 'CONTENT') return true;
  return channels.length > 0;
}

const FORMAT_TO_CONTENT_TYPE: Record<string, ContentType> = {
  post: 'POST',
  reel: 'REEL',
  carousel: 'CAROUSEL',
  static: 'STATIC',
  story: 'STORY',
};

export function deliverableHandoffChannel(channels: string[] | null | undefined): string {
  const first = (channels ?? []).map((c) => c.trim()).filter(Boolean)[0];
  if (!first) return 'instagram';
  return first.toLowerCase();
}

export function deliverableHandoffContentType(formats: string[] | null | undefined): ContentType {
  const raw = (formats ?? []).map((f) => f.trim().toLowerCase()).filter(Boolean)[0];
  if (!raw) return 'POST';
  if ((CONTENT_TYPES as readonly string[]).includes(raw.toUpperCase())) {
    return raw.toUpperCase() as ContentType;
  }
  return FORMAT_TO_CONTENT_TYPE[raw] ?? 'POST';
}

/** Content edits allowed when syncing media from a newly approved deliverable version. */
export function deliverableHandoffMayUpdateExistingContent(input: {
  approvalState: string;
  scheduleState: string;
  archivedAt: Date | null;
}): boolean {
  if (input.archivedAt) return false;
  if (input.scheduleState !== 'UNSCHEDULED') return false;
  const state = input.approvalState.toUpperCase();
  return state === 'NOT_REQUESTED' || state === 'CHANGES_REQUESTED' || state === 'REJECTED';
}