import { absolutePublicUrl } from '../../lib/public-site';

export function LandingJsonLd() {
  const url = absolutePublicUrl('/');
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'OMA',
        alternateName: 'OMA AI',
        url,
        logo: absolutePublicUrl('/landing/real/hero-en.webp'),
      },
      {
        '@type': 'WebSite',
        name: 'OMA',
        url,
        inLanguage: ['en', 'ar'],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'OMA',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
