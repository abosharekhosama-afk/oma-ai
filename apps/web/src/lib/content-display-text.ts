import { isRawId } from './demo/stage3-content';
import type { DemoLocaleCopy } from './demo/use-demo-api';

/** Prefer active locale, then the other; never surface raw ids as copy. */
export function resolveLocaleCopy(
  copy: DemoLocaleCopy | null | undefined,
  locale: string,
): string {
  if (!copy) return '';
  const ar = locale.toLowerCase().startsWith('ar');
  const primary = (ar ? copy.ar : copy.en)?.trim() ?? '';
  const secondary = (ar ? copy.en : copy.ar)?.trim() ?? '';
  for (const value of [primary, secondary]) {
    if (value && !isRawId(value)) return value;
  }
  return '';
}

export function contentTitleText(
  title: DemoLocaleCopy | undefined,
  caption: DemoLocaleCopy | null | undefined,
  locale: string,
  untitled: string,
): string {
  const fromTitle = resolveLocaleCopy(title, locale);
  if (fromTitle) return fromTitle;
  const fromCaption = resolveLocaleCopy(caption ?? undefined, locale);
  if (fromCaption) return fromCaption;
  return untitled;
}

export function contentBodyText(
  title: DemoLocaleCopy | undefined,
  caption: DemoLocaleCopy | null | undefined,
  locale: string,
  emptyHint: string,
): string {
  const fromCaption = resolveLocaleCopy(caption ?? undefined, locale);
  if (fromCaption) return fromCaption;
  const fromTitle = resolveLocaleCopy(title, locale);
  if (fromTitle) return fromTitle;
  return emptyHint;
}

export function displayContentLabels(labels: string[] | undefined): string[] {
  return (labels ?? []).filter((l) => Boolean(l?.trim()) && !isRawId(l));
}
