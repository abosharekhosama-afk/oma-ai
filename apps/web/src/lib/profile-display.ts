function humanizeKey(key: string) {
  return key
    .replace(/[_.]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function tryParseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function formatObjectLine(record: Record<string, unknown>): string {
  const network = record.network ?? record.name ?? record.platform;
  const url = record.url ?? record.href ?? record.link;
  if (network && url) return `${humanizeKey(String(network))}: ${String(url)}`;
  const entries = Object.entries(record).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '—';
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`)
    .join(' · ');
}

/** Human-readable profile insight / field text (JSON social rows, nested objects). */
export function formatInsightText(raw: string | null | undefined): string {
  if (raw == null) return '—';
  const text = String(raw).trim();
  if (!text) return '—';
  const parsed = tryParseJson(text);
  if (parsed == null) return text;
  if (Array.isArray(parsed)) {
    const lines = parsed
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return formatObjectLine(item as Record<string, unknown>);
        }
        return String(item ?? '').trim();
      })
      .filter((line) => line && line !== '—');
    return lines.length ? lines.join('\n') : text;
  }
  if (typeof parsed === 'object') {
    const rec = parsed as Record<string, unknown>;
    if (Array.isArray(rec.theme)) {
      return `Colors: ${rec.theme.map(String).join(', ')}`;
    }
    if (Array.isArray(rec.colors)) {
      return `Colors: ${rec.colors.map(String).join(', ')}`;
    }
    return formatObjectLine(rec);
  }
  return String(parsed);
}

export function stripHtmlForExcerpt(raw: string, maxLen = 2400): string {
  const looksHtml = /<!DOCTYPE|<html|<\/?[a-z][\s\S]*>/i.test(raw);
  let text = raw;
  if (looksHtml) {
    text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
