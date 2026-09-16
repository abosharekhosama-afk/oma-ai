import type { ContentViewMode } from './stage3-content';

const CONTENT_VIEW_KEY = 'oma-demo-content-view';
const CAMPAIGN_LAYOUT_KEY = 'oma-demo-campaign-layout';

export const CONTENT_VIEW_MODES: ContentViewMode[] = ['calendar', 'feed', 'grid', 'list'];

export function isContentViewMode(value: string): value is ContentViewMode {
  return (CONTENT_VIEW_MODES as string[]).includes(value);
}

export function hasContentViewPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.sessionStorage.getItem(CONTENT_VIEW_KEY));
  } catch {
    return false;
  }
}

export function readContentViewPref(): ContentViewMode {
  if (typeof window === 'undefined') return 'calendar';
  try {
    const raw = window.sessionStorage.getItem(CONTENT_VIEW_KEY);
    if (raw && isContentViewMode(raw)) return raw;
  } catch {
    /* private mode */
  }
  return 'calendar';
}

export function writeContentViewPref(view: ContentViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CONTENT_VIEW_KEY, view);
  } catch {
    /* private mode */
  }
}

export type CampaignLayout = 'portfolio' | 'list';

export function readCampaignLayoutPref(): CampaignLayout {
  if (typeof window === 'undefined') return 'portfolio';
  try {
    const raw = window.sessionStorage.getItem(CAMPAIGN_LAYOUT_KEY);
    if (raw === 'portfolio' || raw === 'list') return raw;
    if (raw === 'table') return 'list';
  } catch {
    /* private mode */
  }
  return 'portfolio';
}

export function writeCampaignLayoutPref(layout: CampaignLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CAMPAIGN_LAYOUT_KEY, layout);
  } catch {
    /* private mode */
  }
}
