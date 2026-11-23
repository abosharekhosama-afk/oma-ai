import type { InsightItem } from './brand-types';

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

function formatValuePart(value: unknown, depth = 0): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value.trim() || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatValuePart(v, depth + 1)).filter((p) => p !== '—');
    return parts.length ? parts.join(', ') : '—';
  }
  if (typeof value === 'object' && depth < 3) {
    return formatObjectLine(value as Record<string, unknown>, depth + 1);
  }
  return String(value);
}

function formatObjectLine(record: Record<string, unknown>, depth = 0): string {
  if (Array.isArray(record.profiles)) {
    return record.profiles
      .map((row) => (row && typeof row === 'object' ? formatObjectLine(row as Record<string, unknown>, depth + 1) : formatValuePart(row, depth + 1)))
      .filter((line) => line !== '—')
      .join('\n');
  }
  const network = record.network ?? record.name ?? record.platform;
  const url = record.url ?? record.href ?? record.link;
  if (network && url) return `${humanizeKey(String(network))}: ${String(url)}`;
  const entries = Object.entries(record).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '—';
  return entries
    .slice(0, 6)
    .map(([k, v]) => `${humanizeKey(k)}: ${formatValuePart(v, depth + 1)}`)
    .join(' · ');
}

/** Resolve relative API media paths for `<img src>` on the web app origin. */
export function resolvePublicAssetUrl(url: string | undefined | null): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed;
}

export function shortDisplayUrl(url: string, max = 52): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname === '/' ? '' : u.pathname;
    const raw = `${host}${path}`;
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max - 1)}…`;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

export function insightPayload(insight: Pick<InsightItem, 'text_value' | 'value_json'>): unknown {
  if (insight.value_json != null) return insight.value_json;
  const text = insight.text_value?.trim();
  if (!text) return null;
  const parsed = tryParseJson(text);
  return parsed ?? text;
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
