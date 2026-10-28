import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  kindFromMime,
  kindFromUrl,
  mediaIdFromUrl,
  versionMime,
  videoUrlFor,
} from '../../apps/web/src/components/content/media-surface';
import { mediaPlaybackUrl } from '../../apps/api/src/media/media.service';

const read = (p: string) => readFileSync(p, 'utf8');
const ID = '01M61PH333ZABJP6TGGXVD9SJF';

describe('video media in cards', () => {
  it('detects video from mime, url and the stream route', () => {
    expect(kindFromMime('video/mp4')).toBe('video');
    expect(kindFromMime('image/png')).toBe('image');
    expect(kindFromMime(null)).toBeNull();
    expect(kindFromUrl('https://cdn.example.com/a/clip.MP4?sig=1')).toBe('video');
    expect(kindFromUrl('https://cdn.example.com/a/photo.webp')).toBe('image');
    expect(kindFromUrl(`/api/v1/media/${ID}/stream`)).toBe('video');
    expect(kindFromUrl('data:video/webm;base64,AAAA')).toBe('video');
    // Legacy `/view` URLs carry no kind — resolved from the asset record instead.
    expect(kindFromUrl(`/api/v1/media/${ID}/view`)).toBeNull();
  });

  it('plays videos through the Range-capable stream route', () => {
    expect(mediaIdFromUrl(`/api/v1/media/${ID}/view`)).toBe(ID);
    expect(videoUrlFor(`/api/v1/media/${ID}/view`)).toBe(`/api/v1/media/${ID}/stream`);
    expect(mediaPlaybackUrl(ID, 'video/mp4')).toBe(`/api/v1/media/${ID}/stream`);
    expect(mediaPlaybackUrl(ID, 'image/jpeg')).toBe(`/api/v1/media/${ID}/view`);
    expect(versionMime({ mediaMime: 'video/quicktime' })).toBe('video/quicktime');
  });

  it('cards render previews through MediaSurface, not a bare <img>', () => {
    for (const f of [
      'apps/web/src/components/content/content-card.tsx',
      'apps/web/src/components/content/planable-views.tsx',
      'apps/web/src/components/home/home-view.tsx',
    ]) {
      expect(read(f), f).toMatch(/MediaSurface/);
    }
  });
});

describe('one shimmer per screen', () => {
  it('route gate and screens share the screen shimmers', () => {
    expect(read('apps/web/src/components/shell/membership-route-gate.tsx')).toMatch(/screenShimmerFor/);
    const screens: Array<[string, string]> = [
      ['apps/web/src/app/(app)/app/content/content-client.tsx', 'ContentShimmer'],
      ['apps/web/src/app/(app)/app/tasks/tasks-client.tsx', 'TasksShimmer'],
      ['apps/web/src/app/(app)/app/tasks/page.tsx', 'TasksShimmer'],
      ['apps/web/src/app/(app)/app/brands/brands-client.tsx', 'BrandsShimmer'],
      ['apps/web/src/app/(app)/app/brands/page.tsx', 'BrandsShimmer'],
      ['apps/web/src/app/(app)/app/requests/page.tsx', 'RequestsShimmer'],
      ['apps/web/src/app/(app)/app/reviews/page.tsx', 'ReviewsShimmer'],
      ['apps/web/src/app/(app)/app/deliverables/page.tsx', 'DeliverablesShimmer'],
    ];
    for (const [f, c] of screens) expect(read(f), f).toMatch(new RegExp(c));
  });

  it('only one .oma-skeleton definition remains', () => {
    const states = read('apps/web/src/styles/states.css');
    expect(states.match(/@keyframes oma-shimmer-sweep/g)?.length).toBe(1);
    expect(read('packages/ui/src/primitives.css')).not.toMatch(/^\.oma-skeleton\s*\{/m);
  });
});
