import type { MetadataRoute } from 'next';
import {
  PUBLIC_INDEXABLE_PATHS,
  absolutePublicUrl,
  publicSiteIndexable,
  resolvePublicSiteUrl,
} from '../lib/public-site';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!publicSiteIndexable()) {
    return [];
  }

  const base = resolvePublicSiteUrl();
  const now = new Date();

  return PUBLIC_INDEXABLE_PATHS.map((path) => {
    const changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] =
      path === '/' ? 'weekly' : 'monthly';
    return {
      url: absolutePublicUrl(path === '/' ? '/' : path),
      lastModified: now,
      changeFrequency,
      priority: path === '/' ? 1 : path === '/login' || path === '/register' ? 0.6 : 0.4,
      alternates: {
        languages: {
          en: absolutePublicUrl(path === '/' ? '/' : path),
          ar: absolutePublicUrl(path === '/' ? '/' : path),
        },
      },
    };
  }).filter((entry) => entry.url.startsWith(base.origin));
}
