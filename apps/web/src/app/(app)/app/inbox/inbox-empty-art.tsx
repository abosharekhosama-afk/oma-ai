/** Planable-style empty illustration (envelope + speech bubbles). */
export function InboxAllDoneIllustration() {
  return (
    <svg
      className="oma-plx-inbox-all-done-art"
      viewBox="0 0 200 160"
      width={200}
      height={160}
      aria-hidden
    >
      <defs>
        <linearGradient id="oma-inbox-env" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#bfdbfe" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="132" rx="72" ry="8" fill="#e5e7eb" opacity="0.5" />
      <path
        d="M40 72 L100 108 L160 72 L160 120 Q160 132 148 132 H52 Q40 132 40 120 Z"
        fill="url(#oma-inbox-env)"
        stroke="#93c5fd"
        strokeWidth="1.5"
      />
      <path d="M40 72 L100 96 L160 72" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      <rect x="118" y="28" width="36" height="24" rx="8" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1.2" />
      <path d="M124 40 h24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
      <rect x="72" y="16" width="32" height="22" rx="7" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2" />
      <circle cx="88" cy="27" r="2" fill="#60a5fa" />
      <rect x="46" y="36" width="28" height="20" rx="6" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.2" />
    </svg>
  );
}

export function InboxListEmptyState({
  status,
  onGoToOpen,
  t,
}: {
  status: 'OPEN' | 'PENDING' | 'CLOSED';
  onGoToOpen: () => void;
  t: (key: string) => string;
}) {
  const title = t('inbox.empty.allDone') || 'All done';
  const body =
    status === 'PENDING'
      ? t('inbox.empty.laterBody') || "Move conversations to 'Later' to easily revisit them."
      : status === 'CLOSED'
        ? t('inbox.empty.doneBody') || 'Resolved conversations live here when you mark them done.'
        : t('inbox.empty.openBody') || 'New comments and DMs will appear here when they arrive.';

  return (
    <div className="oma-plx-inbox-list-empty" role="status">
      <strong>{title}</strong>
      <p>{body}</p>
      {status !== 'OPEN' ? (
        <button type="button" className="oma-plx-inbox-link-btn" onClick={onGoToOpen}>
          {t('inbox.empty.goToOpen') || 'Go to open'}
        </button>
      ) : null}
    </div>
  );
}

export function InboxPaneAllDone({ t }: { t: (key: string) => string }) {
  return (
    <div className="oma-plx-inbox-pane-all-done" role="status">
      <InboxAllDoneIllustration />
      <p>{t('inbox.empty.allDone') || 'All done'}</p>
    </div>
  );
}
