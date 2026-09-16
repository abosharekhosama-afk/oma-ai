/** Local P3 demo media fixtures. Original OMA assets; never remote or Planable logos. */

export const P3_MEDIA = {
  static: '/demo/poster-static.svg',
  carousel1: '/demo/poster-carousel-1.svg',
  carousel2: '/demo/poster-carousel-2.svg',
  video: '/demo/video-poster.svg',
  story: '/demo/poster-story.svg',
  product: '/demo/poster-product.svg',
  campaignBanner: '/demo/poster-campaign-banner.svg',
  arabic: '/demo/poster-ar.svg',
} as const;

export const P3_MEDIA_PATHS = Object.values(P3_MEDIA);

export function previewAssetForType(
  type: 'REEL' | 'CAROUSEL' | 'STATIC' | 'STORY' | 'POST',
): string {
  switch (type) {
    case 'REEL':
      return P3_MEDIA.video;
    case 'STORY':
      return P3_MEDIA.story;
    case 'CAROUSEL':
      return P3_MEDIA.carousel1;
    case 'STATIC':
      return P3_MEDIA.static;
    default:
      return P3_MEDIA.product;
  }
}

export function isLocalDemoAsset(src: string): boolean {
  return src.startsWith('/demo/') && !/^https?:/i.test(src);
}

export function mediaAlt(title: string, channel: string, contentType: string): string {
  return `${title} · ${contentType} · ${channel}`;
}
