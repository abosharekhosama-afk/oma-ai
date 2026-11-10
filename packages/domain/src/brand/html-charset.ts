import iconv from 'iconv-lite';

const CHARSET_ALIASES: Record<string, string> = {
  utf8: 'utf-8',
  'utf-8': 'utf-8',
  'iso-8859-1': 'iso-8859-1',
  latin1: 'iso-8859-1',
  'windows-1252': 'windows-1252',
  cp1252: 'windows-1252',
  'windows-1256': 'windows-1256',
  cp1256: 'windows-1256',
  'iso-8859-6': 'iso-8859-6',
  arabic: 'windows-1256',
};

export function charsetFromContentType(contentType: string | null | undefined): string | null {
  const match = contentType?.match(/charset\s*=\s*["']?([^\s;"']+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function charsetFromHtmlBytes(bytes: Uint8Array): string | null {
  const head = Buffer.from(bytes.subarray(0, 4096)).toString('latin1');
  const named = head.match(/<meta\b[^>]*\bcharset\s*=\s*["']?\s*([^\s"'/>]+)/i);
  if (named?.[1]) return named[1].toLowerCase();
  const httpEquiv = head.match(
    /<meta\b[^>]*http-equiv\s*=\s*["']content-type["'][^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^\s"']+)/i,
  );
  if (httpEquiv?.[1]) return httpEquiv[1].toLowerCase();
  const httpEquivFlip = head.match(
    /<meta\b[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^\s"']+)[^"']*["'][^>]*http-equiv\s*=\s*["']content-type["']/i,
  );
  return httpEquivFlip?.[1]?.toLowerCase() ?? null;
}

export function resolveCharset(contentType: string | null | undefined, bytes: Uint8Array): string {
  const raw = charsetFromContentType(contentType) ?? charsetFromHtmlBytes(bytes) ?? 'utf-8';
  return CHARSET_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase();
}

export function decodeTextBytes(bytes: Uint8Array, contentType: string | null | undefined): string {
  const charset = resolveCharset(contentType, bytes);
  if (iconv.encodingExists(charset)) {
    return iconv.decode(Buffer.from(bytes), charset);
  }
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}
