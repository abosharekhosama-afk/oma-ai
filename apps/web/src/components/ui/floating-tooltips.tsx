'use client';

import { useEffect } from 'react';

const GAP = 8;
const VIEWPORT_PAD = 8;
const TIP_ID = 'oma-floating-tooltip';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function positionTip(anchor: HTMLElement, tip: HTMLElement) {
  const text = anchor.getAttribute('data-tooltip')?.trim();
  if (!text) return false;
  tip.textContent = text;
  tip.hidden = false;
  tip.style.display = 'block';
  tip.style.visibility = 'hidden';
  tip.style.left = '0';
  tip.style.top = '0';

  const rect = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const tipW = tipRect.width;
  const tipH = tipRect.height;

  let placement: 'top' | 'bottom' = 'top';
  let top = rect.top - tipH - GAP;
  if (top < VIEWPORT_PAD) {
    placement = 'bottom';
    top = rect.bottom + GAP;
  }
  if (placement === 'bottom' && top + tipH > window.innerHeight - VIEWPORT_PAD) {
    const above = rect.top - tipH - GAP;
    if (above >= VIEWPORT_PAD) {
      placement = 'top';
      top = above;
    } else {
      top = clamp(top, VIEWPORT_PAD, window.innerHeight - tipH - VIEWPORT_PAD);
    }
  } else if (placement === 'top') {
    top = clamp(top, VIEWPORT_PAD, window.innerHeight - tipH - VIEWPORT_PAD);
  }

  let left = rect.left + rect.width / 2 - tipW / 2;
  left = clamp(left, VIEWPORT_PAD, window.innerWidth - tipW - VIEWPORT_PAD);

  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
  tip.style.visibility = 'visible';
  tip.dataset.placement = placement;
  return true;
}

/** Portaled `data-tooltip` hints — above all layers; flips below when clipped at the top. */
export function FloatingTooltips() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.omaFloatingTooltips = 'true';

    let tip = document.getElementById(TIP_ID) as HTMLDivElement | null;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = TIP_ID;
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }

    let active: HTMLElement | null = null;
    let raf = 0;

    const hide = () => {
      if (active) active.removeAttribute('data-tooltip-active');
      active = null;
      if (tip) tip.hidden = true;
    };

    const show = (el: HTMLElement) => {
      if (!tip || !el.getAttribute('data-tooltip')?.trim()) return;
      active = el;
      el.setAttribute('data-tooltip-active', 'true');
      positionTip(el, tip);
    };

    const reposition = () => {
      if (!active || !tip || tip.hidden) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (active) positionTip(active, tip!);
      });
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      if (!el || el === active) return;
      hide();
      show(el);
    };

    const onOut = (e: MouseEvent) => {
      if (!active) return;
      const related = e.relatedTarget as Node | null;
      if (related && active.contains(related)) return;
      const from = (e.target as Element | null)?.closest?.('[data-tooltip]');
      if (from === active) hide();
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tooltip]') as HTMLElement | null;
      if (el) {
        hide();
        show(el);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!active) return;
      const next = e.relatedTarget as Node | null;
      if (next && active.contains(next)) return;
      hide();
    };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      root.removeAttribute('data-oma-floating-tooltips');
      delete root.dataset.omaFloatingTooltips;
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      cancelAnimationFrame(raf);
      hide();
      tip?.remove();
    };
  }, []);

  return null;
}
