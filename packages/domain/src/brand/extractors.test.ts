import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boundExcerpt, extractFromHtml } from './extractors';

const fixtureRoot = join(process.cwd(), 'tests/fixtures/websites/acme');
const fixtureHtml = readFileSync(join(fixtureRoot, 'index.html'), 'utf8');

describe('extractors', () => {
  it('bounds excerpt length', () => {
    expect(boundExcerpt('x'.repeat(3000)).length).toBe(2000);
  });

  it('extracts brand name from fixture', () => {
    const r = extractFromHtml('https://acme.test/', fixtureHtml);
    expect(r.fields.find((f) => f.fieldKey === 'brand.name')?.isUnknown).toBe(false);
    expect(r.pageTitle).toBeTruthy();
  });

  it('extracts json-ld products', () => {
    const productsHtml = readFileSync(join(fixtureRoot, 'products.html'), 'utf8');
    const r = extractFromHtml('https://acme.test/products', productsHtml);
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.classification).toBe('PRODUCT');
  });

  it('extracts social, contact, languages, canonical and robots directives', () => {
    const html = `<!doctype html>
<html lang="ar">
  <head>
    <title>نور</title>
    <link rel="canonical" href="https://brand.test/" />
    <link rel="alternate" hreflang="en" href="https://brand.test/en" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="theme-color" content="#112233" />
    <meta name="robots" content="index, nofollow" />
    <meta property="og:image" content="/og.png" />
    <script type="application/ld+json">
      {
        "@type": "Organization",
        "name": "Noor",
        "email": "hello@brand.test",
        "telephone": "+970599000000",
        "address": { "streetAddress": "Al-Irsal", "addressLocality": "Ramallah" },
        "sameAs": ["https://www.instagram.com/noor", "https://x.com/noor"]
      }
    </script>
  </head>
  <body>
    <a href="https://www.facebook.com/noor">Facebook</a>
    <a href="mailto:press@brand.test">Email</a>
    <a href="/about">About</a>
    <a rel="nofollow" href="/hidden">Hidden</a>
  </body>
</html>`;
    const r = extractFromHtml('https://brand.test/home', html);
    expect(r.canonicalUrl).toBe('https://brand.test/');
    expect(r.nofollow).toBe(true);
    const social = r.fields.find((f) => f.fieldKey === 'brand.social')?.value as {
      profiles: Array<{ network: string }>;
    };
    expect(social.profiles.map((p) => p.network).sort()).toEqual(['facebook', 'instagram', 'x']);
    const contact = r.fields.find((f) => f.fieldKey === 'brand.contact')?.value as {
      emails: string[];
      phones: string[];
      addresses: string[];
    };
    expect(contact.emails).toEqual(
      expect.arrayContaining(['hello@brand.test', 'press@brand.test']),
    );
    expect(contact.phones.some((phone) => phone.includes('970599000000'))).toBe(true);
    expect(contact.addresses[0]).toContain('Ramallah');
    expect(r.fields.find((f) => f.fieldKey === 'brand.languages')?.value).toEqual(['ar', 'en']);
    expect(r.fields.find((f) => f.fieldKey === 'brand.colors')?.value).toEqual({
      theme: ['#112233'],
    });
    expect(r.links.some((link) => link.href === '/about')).toBe(true);
  });
});
