import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDirectPostPermalink } from '../../apps/web/src/lib/publish-status';

describe('Preview modal channel rail, Schedule direct post link, Sidebar tree stem, Competitors & Shimmers', () => {
  it('upgrades TikTok profile-only URLs to direct post permalinks when externalPostId is available', () => {
    expect(
      resolveDirectPostPermalink('https://www.tiktok.com/@juscosoda', {
        externalPostId: '7391827361928371',
        network: 'tiktok',
        contentType: 'REEL',
      }),
    ).toBe('https://www.tiktok.com/@juscosoda/video/7391827361928371');

    expect(
      resolveDirectPostPermalink('https://www.tiktok.com/@juscosoda', {
        externalPostId: '7391827361928372',
        network: 'tiktok',
        contentType: 'CAROUSEL',
      }),
    ).toBe('https://www.tiktok.com/@juscosoda/photo/7391827361928372');

    expect(
      resolveDirectPostPermalink(null, {
        externalPostId: '1234567890',
        network: 'facebook',
      }),
    ).toBe('https://www.facebook.com/1234567890');
  });

  it('wires Schedule Open post link to /app/content?open= and renders clickable platform circle in Content preview', () => {
    const scheduleClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/schedule/schedule-client.tsx'),
      'utf8',
    );
    expect(scheduleClient).toContain('/app/content?open=${selected.contentId}');

    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).toContain('content-preview-open-platform');
    expect(contentClient).toContain('oma-pv-modal-status-circle--net');
  });

  it('includes Planable submenu tree stem CSS, Competitors mentions feed, and Approvals/Listening shimmers', () => {
    const analyticsCss = readFileSync(
      resolve('apps/web/src/styles/analytics-planable.css'),
      'utf8',
    );
    expect(analyticsCss).toContain('.oma-nav-sublist > li::before');
    expect(analyticsCss).toContain('.oma-nav-sublist > li::after');

    const competitorsView = readFileSync(
      resolve('apps/web/src/app/(app)/app/listening/listening-competitors-view.tsx'),
      'utf8',
    );
    expect(competitorsView).toContain('listening-competitor-mentions');
    expect(competitorsView).toContain('ListeningCompetitorsShimmer');

    const shimmerFile = readFileSync(
      resolve('apps/web/src/components/ui/screen-shimmer.tsx'),
      'utf8',
    );
    expect(shimmerFile).toContain('export function ApprovalsShimmer');
    expect(shimmerFile).toContain('export function ListeningCompetitorsShimmer');
    expect(shimmerFile).toContain('export function ListeningShimmer');
  });
});
