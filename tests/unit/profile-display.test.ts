import { describe, expect, it } from 'vitest';
import { formatInsightText, stripHtmlForExcerpt } from '../../apps/web/src/lib/profile-display';

describe('formatInsightText', () => {
  it('formats social profiles object without object Object', () => {
    const raw = JSON.stringify({
      profiles: [
        { network: 'instagram', url: 'https://instagram.com/brand' },
        { network: 'whatsapp', url: 'https://wa.me/1' },
      ],
    });
    const out = formatInsightText(raw);
    expect(out).not.toContain('[object Object]');
    expect(out).toContain('Instagram');
  });

  it('formats JSON social account rows', () => {
    const raw = JSON.stringify([
      { network: 'whatsapp', url: 'https://api.whatsapp.com/send' },
      { network: 'instagram', url: 'https://instagram.com/brand' },
    ]);
    const out = formatInsightText(raw);
    expect(out).toContain('Whatsapp');
    expect(out).toContain('Instagram');
  });

  it('strips HTML for evidence excerpt', () => {
    const html = '<!DOCTYPE html><html><body><p>Hello brand</p></body></html>';
    expect(stripHtmlForExcerpt(html)).toBe('Hello brand');
  });
});
