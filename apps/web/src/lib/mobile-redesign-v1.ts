/** Breakpoint for native mobile redesign (DEC-017 / no document zoom). */
export const MOBILE_REDESIGN_MAX_WIDTH = 767;

export const MOBILE_REDESIGN_ATTR = 'data-oma-mobile-redesign';
export const MOBILE_REDESIGN_VALUE = 'v1';

export function isMobileRedesignViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${MOBILE_REDESIGN_MAX_WIDTH}px)`).matches;
}

export function applyMobileRedesignFlag(root: HTMLElement = document.documentElement): void {
  if (isMobileRedesignViewport()) {
    root.setAttribute(MOBILE_REDESIGN_ATTR, MOBILE_REDESIGN_VALUE);
  } else {
    root.removeAttribute(MOBILE_REDESIGN_ATTR);
  }
}

export type MobileRedesignWorkspace = 'home' | 'content' | 'requests' | 'tasks' | 'deliverables';

export function resolveMobileRedesignWorkspace(pathname: string): MobileRedesignWorkspace | null {
  if (pathname === '/app' || pathname === '/app/') return 'home';
  if (
    pathname === '/app/content' ||
    pathname.startsWith('/app/content/') ||
    pathname === '/app/approvals' ||
    pathname.startsWith('/app/approvals/')
  ) {
    return 'content';
  }
  if (pathname === '/app/requests' || pathname.startsWith('/app/requests/')) return 'requests';
  if (pathname === '/app/tasks' || pathname.startsWith('/app/tasks/')) return 'tasks';
  if (pathname === '/app/deliverables' || pathname.startsWith('/app/deliverables/')) {
    return 'deliverables';
  }
  return null;
}
