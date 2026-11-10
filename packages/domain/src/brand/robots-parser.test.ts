import { describe, expect, it } from 'vitest';
import { decideRobotsPath, evaluateRobotsRules, parseRobotsTxt } from './robots-parser';

const ua = 'OMA-BrandScanner/1.0 (+https://oma.ai)';

describe('robots-parser', () => {
  it('parses groups, sitemaps and crawl-delay', () => {
    const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /private
Allow: /private/ok
Crawl-delay: 2
Sitemap: https://example.test/sitemap.xml
`);
    expect(parsed.sitemaps).toEqual(['https://example.test/sitemap.xml']);
    expect(evaluateRobotsRules(parsed, '/private/secret', ua).decision).toBe('DISALLOW');
    expect(evaluateRobotsRules(parsed, '/private/ok', ua).decision).toBe('ALLOW');
    expect(evaluateRobotsRules(parsed, '/about', ua).crawlDelaySeconds).toBe(2);
  });

  it('prefers a specific user-agent group over star', () => {
    const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /

User-agent: OMA-BrandScanner
Allow: /
`);
    expect(evaluateRobotsRules(parsed, '/hidden', ua).decision).toBe('ALLOW');
  });

  it('honors wildcards, end anchors and longest-match allow ties', () => {
    const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /tmp
Allow: /tmp$
Disallow: /*.zip$
Allow: /downloads/ok.zip$
`);
    expect(evaluateRobotsRules(parsed, '/tmp', ua).decision).toBe('ALLOW');
    expect(evaluateRobotsRules(parsed, '/tmp/file', ua).decision).toBe('DISALLOW');
    expect(evaluateRobotsRules(parsed, '/file.zip', ua).decision).toBe('DISALLOW');
    expect(evaluateRobotsRules(parsed, '/downloads/ok.zip', ua).decision).toBe('ALLOW');
  });

  it('treats an empty disallow as allow-all and missing robots as allow', () => {
    const parsed = parseRobotsTxt('User-agent: *\nDisallow:\n');
    expect(evaluateRobotsRules(parsed, '/anything', ua).decision).toBe('ALLOW');
    expect(decideRobotsPath({ availability: 'missing' }, '/', ua).decision).toBe('ALLOW');
    expect(decideRobotsPath({ availability: 'unavailable' }, '/', ua).decision).toBe('DISALLOW');
  });
});
