import { describe, expect, it } from 'vitest';
import {
  buildPublishStatusView,
  formatScheduleWhen,
  publishTargetStateLabelKey,
} from '../../apps/web/src/lib/publish-status';

describe('buildPublishStatusView', () => {
  it('shows published timeline with link', () => {
    const v = buildPublishStatusView(
      {
        scheduleState: 'SCHEDULED',
        scheduledAt: '2026-10-30T11:59:00.000Z',
        publishState: 'PUBLISHED',
        workerPickedAt: '2026-10-30T12:00:00.000Z',
        publishedAt: '2026-10-30T12:00:05.000Z',
        externalPostUrl: 'https://www.tiktok.com/@brand',
        socialPageId: 'p1',
      },
      'en',
    );
    expect(v?.stateLabelKey).toContain('published');
    expect(v?.steps.some((s) => s.key === 'published' && s.done)).toBe(true);
    expect(v?.externalUrl).toContain('tiktok');
  });

  it('humanizes failed publish', () => {
    const v = buildPublishStatusView(
      {
        scheduleState: 'SCHEDULED',
        publishState: 'FAILED',
        publishError:
          'tiktok: video.publish is not authorized for this app. Enable Direct Post after TikTok approval, then reconnect the account.',
        socialPageId: 'p1',
      },
      'ar',
    );
    expect(v?.stateLabelKey).toContain('failed');
    expect(v?.errorHuman || '').toMatch(/صلاحية|Direct Post/);
  });

  it('labels partial rollup', () => {
    const v = buildPublishStatusView(
      {
        scheduleState: 'SCHEDULED',
        publishRollupState: 'PARTIAL',
        socialPageIds: ['p1', 'p2'],
      },
      'en',
    );
    expect(v?.stateLabelKey).toContain('partial');
  });

  it('maps per-target states', () => {
    expect(publishTargetStateLabelKey('PUBLISHED')).toContain('published');
    expect(publishTargetStateLabelKey('FAILED')).toContain('failed');
    expect(publishTargetStateLabelKey('QUEUED')).toContain('queued');
  });

  it('formats timezone', () => {
    const s = formatScheduleWhen('2026-10-30T11:59:00.000Z', 'Asia/Dubai', 'en');
    expect(s.length).toBeGreaterThan(5);
  });
});
