import { describe, expect, it } from 'vitest';
import {
  deliverableHandoffChannel,
  deliverableHandoffContentType,
  deliverableHandoffMayUpdateExistingContent,
  shouldHandoffDeliverableToContent,
} from './deliverable-content-handoff';

describe('deliverable-content-handoff', () => {
  it('hands off CONTENT requests and channel-backed design work', () => {
    expect(shouldHandoffDeliverableToContent({ requestType: 'CONTENT' })).toBe(true);
    expect(shouldHandoffDeliverableToContent({ requestType: 'REVIEW' })).toBe(false);
    expect(
      shouldHandoffDeliverableToContent({ requestType: 'DESIGN', channels: ['tiktok'] }),
    ).toBe(true);
    expect(shouldHandoffDeliverableToContent({ requestType: 'DESIGN', channels: [] })).toBe(false);
  });

  it('maps channel and format defaults', () => {
    expect(deliverableHandoffChannel(['TikTok', 'instagram'])).toBe('tiktok');
    expect(deliverableHandoffChannel([])).toBe('instagram');
    expect(deliverableHandoffContentType(['reel'])).toBe('REEL');
    expect(deliverableHandoffContentType(['carousel'])).toBe('CAROUSEL');
    expect(deliverableHandoffContentType([])).toBe('POST');
  });

  it('blocks overwriting scheduled or approved calendar rows', () => {
    expect(
      deliverableHandoffMayUpdateExistingContent({
        approvalState: 'NOT_REQUESTED',
        scheduleState: 'UNSCHEDULED',
        archivedAt: null,
      }),
    ).toBe(true);
    expect(
      deliverableHandoffMayUpdateExistingContent({
        approvalState: 'APPROVED',
        scheduleState: 'UNSCHEDULED',
        archivedAt: null,
      }),
    ).toBe(false);
    expect(
      deliverableHandoffMayUpdateExistingContent({
        approvalState: 'NOT_REQUESTED',
        scheduleState: 'SCHEDULED',
        archivedAt: null,
      }),
    ).toBe(false);
  });
});