import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { charsetFromContentType, decodeTextBytes } from './html-charset';

describe('html-charset', () => {
  it('reads charset from content-type', () => {
    expect(charsetFromContentType('text/html; charset=windows-1256')).toBe('windows-1256');
  });

  it('decodes windows-1256 arabic html', () => {
    const html = '<html><head><meta charset="windows-1256"></head><body>مرحبا</body></html>';
    const bytes = iconv.encode(html, 'windows-1256');
    const decoded = decodeTextBytes(bytes, 'text/html');
    expect(decoded).toContain('مرحبا');
  });

  it('falls back to utf-8', () => {
    expect(decodeTextBytes(Buffer.from('hello', 'utf8'), 'text/plain')).toBe('hello');
  });
});
