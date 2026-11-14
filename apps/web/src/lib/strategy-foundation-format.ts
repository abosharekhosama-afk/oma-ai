/** Normalize strategy foundation / track JSON for display and PATCH. */

export function readFoundationText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          if (typeof rec.value === 'string') return rec.value.trim();
          if (typeof rec.name === 'string') return rec.name.trim();
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.value === 'string') return rec.value.trim();
  }
  return '';
}

export function readTrackList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        return String(rec.value ?? rec.name ?? rec.label ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function trackListToText(items: unknown): string {
  return readTrackList(items).join('\n');
}

export function textToTrackList(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function textToFoundationGoals(text: string): Array<{ value: string; infoClass: string }> {
  return textToTrackList(text).map((value) => ({ value, infoClass: 'USER_AUTHORED' }));
}
