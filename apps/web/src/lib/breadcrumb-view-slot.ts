/** Planable-style path view switcher: view icon + label + caret in `#oma-content-view-slot`. */

const STROKE =
  'viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const VIEW_ICONS: Record<string, string> = {
  calendar: `<svg ${STROKE}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
  feed: `<svg ${STROKE}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  list: `<svg ${STROKE}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  grid: `<svg ${STROKE}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
  board: `<svg ${STROKE}><path d="M6 5v14"/><path d="M12 5v8"/><path d="M18 5v11"/></svg>`,
  kanban: `<svg ${STROKE}><path d="M6 5v14"/><path d="M12 5v8"/><path d="M18 5v11"/></svg>`,
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clearBreadcrumbViewSlot(el: HTMLElement) {
  el.innerHTML = '';
  el.removeAttribute('role');
  el.removeAttribute('tabindex');
  el.removeAttribute('data-testid');
  el.removeAttribute('aria-label');
  el.removeAttribute('data-view');
  el.style.cursor = '';
  el.classList.remove('oma-breadcrumb-view--interactive');
}

export function paintBreadcrumbViewSlot(el: HTMLElement, viewKey: string, label: string) {
  const key = viewKey === 'board' ? 'board' : viewKey;
  const icon = VIEW_ICONS[key] ?? VIEW_ICONS.list!;
  const caret = `<svg ${STROKE} width="12" height="12"><path d="m6 9 6 6 6-6"/></svg>`;
  el.innerHTML = `<span class="oma-breadcrumb-view-inner">${icon}<span class="oma-breadcrumb-view-label">${escapeHtml(label)}</span><span class="oma-breadcrumb-view-caret" aria-hidden="true">${caret}</span></span>`;
  el.setAttribute('data-view', viewKey);
  el.classList.add('oma-breadcrumb-view--interactive');
  el.setAttribute('aria-label', label);
}
