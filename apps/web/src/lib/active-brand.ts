import { useEffect, useRef, useState } from 'react';

/**
 * Active brand scope for work surfaces (content, deliverables, tasks, requests, campaigns).
 * Source of truth: `?brand=<id>` in the URL, persisted to localStorage so it survives
 * navigation. `null` means "All brands".
 */
export const ACTIVE_BRAND_STORAGE_KEY = 'oma.activeBrandId';
export const ACTIVE_BRAND_EVENT = 'oma:active-brand-change';

export function getActiveBrandId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('brand');
    if (fromUrl !== null) {
      const v = fromUrl.trim();
      if (v && v !== 'all') window.localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, v);
      else window.localStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
      return v && v !== 'all' ? v : null;
    }
    return window.localStorage.getItem(ACTIVE_BRAND_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Set (or clear with null) the active brand; keeps `?brand=` in sync and notifies listeners. */
export function setActiveBrandId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('brand', id);
    else url.searchParams.delete('brand');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_BRAND_EVENT, { detail: { id } }));
}

/** Restrict a brand list to the active brand (falls back to all if the id is unknown). */
export function scopeBrands<T extends { id: string }>(
  brands: T[],
  activeId = getActiveBrandId(),
): T[] {
  if (!activeId) return brands;
  const hit = brands.filter((b) => b.id === activeId);
  return hit.length ? hit : brands;
}

export function useActiveBrandId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(getActiveBrandId());
    const on = () => setId(getActiveBrandId());
    window.addEventListener(ACTIVE_BRAND_EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(ACTIVE_BRAND_EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return id;
}

/** Re-run a loader whenever the active brand changes (not on first mount). */
export function useReloadOnBrandChange(reload: () => unknown): void {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const on = () => void ref.current();
    window.addEventListener(ACTIVE_BRAND_EVENT, on);
    return () => window.removeEventListener(ACTIVE_BRAND_EVENT, on);
  }, []);
}

const BRAND_SCOPED_PREFIXES = [
  '/app/content',
  '/app/deliverables',
  '/app/tasks',
  '/app/requests',
  '/app/campaigns',
  '/app/reviews',
  '/app/schedule',
  '/app/analytics',
];

export function isBrandScopedPath(pathname: string): boolean {
  return BRAND_SCOPED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Header/rail switcher action. On brand-scoped work surfaces the page re-scopes in place
 * (data reloads via ACTIVE_BRAND_EVENT); elsewhere it opens the brand's page.
 */
export function selectBrand(id: string | null): void {
  setActiveBrandId(id);
  if (typeof window === 'undefined') return;
  if (isBrandScopedPath(window.location.pathname)) return;
  window.location.assign(id ? `/app/brands/${id}` : '/app/brands');
}

/** Label/active brand for switchers: the selected brand, or the only brand, or null (all). */
export function resolveActiveBrand<T extends { id: string }>(
  brands: T[],
  activeId: string | null,
): T | null {
  if (activeId) return brands.find((b) => b.id === activeId) ?? null;
  return brands.length === 1 ? (brands[0] ?? null) : null;
}
