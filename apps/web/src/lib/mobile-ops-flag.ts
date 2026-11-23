export const MOBILE_OPS_ATTR = 'data-oma-ops-mobile';
export const MOBILE_OPS_VALUE = 'v1';

export function applyMobileOpsFlag(root: HTMLElement = document.documentElement): void {
  if (typeof window === 'undefined') return;
  const narrow = window.matchMedia('(max-width: 767px)').matches;
  if (narrow) root.setAttribute(MOBILE_OPS_ATTR, MOBILE_OPS_VALUE);
  else root.removeAttribute(MOBILE_OPS_ATTR);
}
