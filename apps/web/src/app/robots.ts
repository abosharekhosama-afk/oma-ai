import type { MetadataRoute } from 'next';
import { absolutePublicUrl, publicSiteIndexable } from '../lib/public-site';

export default function robots(): MetadataRoute.Robots {
  if (!publicSiteIndexable()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/invite', '/reset-password', '/forgot-password'],
      },
    ],
    sitemap: absolutePublicUrl('/sitemap.xml'),
  };
}
