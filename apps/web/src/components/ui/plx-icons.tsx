import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const stroke = (p: P): P => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
});

export function PlxLogo({
  sub = 'by IMKAN',
  compact = false,
}: {
  sub?: string | null;
  compact?: boolean;
}) {
  return (
    <span className={compact ? 'plx-logo plx-logo--compact' : 'plx-logo'}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="3" y="3" width="11" height="11" rx="3.5" fill="#5CC98E" />
        <rect x="16" y="3" width="11" height="11" rx="3.5" fill="#4C8DFF" />
        <rect x="3" y="16" width="11" height="11" rx="3.5" fill="#FFB547" />
        <rect x="16" y="16" width="11" height="11" rx="3.5" fill="#A66CFF" />
      </svg>
      <span className="plx-logo-word">oma</span>
      {sub ? <span className="plx-logo-sub">{sub}</span> : null}
    </span>
  );
}

export const GoogleIcon = (p: P) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" {...p}>
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
    />
  </svg>
);

export const FacebookIcon = (p: P) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" {...p}>
    <circle cx="9" cy="9" r="9" fill="#1877F2" />
    <path
      fill="#fff"
      d="M11.4 9.2h-1.7V15H7.2V9.2H5.8V7h1.4V5.7c0-1.4.7-2.7 2.6-2.7h1.6v2h-1c-.6 0-.7.3-.7.7V7h1.7l-.2 2.2z"
    />
  </svg>
);

export const LockIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="4" y="10" width="16" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const EyeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const EyeOffIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 4l16 16" />
    <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.9A16 16 0 0 0 2 12s3.5 6 10 6c1.5 0 2.9-.3 4-.9" />
  </svg>
);

export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill={filled ? '#FFB547' : 'none'}
    stroke={filled ? '#FFB547' : 'currentColor'}
    strokeWidth="1.8"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    <path d="M12 2.8l2.8 6 6.5 1-4.7 4.4 1.2 6.5L12 17.7l-5.8 3 1.2-6.5L2.7 9.8l6.5-1z" />
  </svg>
);

export const MoreIcon = (p: P) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
export const BellIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
export const HelpIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.3-2.8 3.8" />
    <circle cx="12" cy="17.4" r="0.4" fill="currentColor" />
  </svg>
);
export const PlusIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const UserPlusIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </svg>
);
export const UsersIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
  </svg>
);
export const ChevronDownIcon = (p: P) => (
  <svg {...stroke(p)} width="14" height="14">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
export const ImageIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
export const LinkIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);
export const EnvelopeIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="2" y="4" width="20" height="16" rx="2.5" />
    <path d="M22 7l-10 6L2 7" />
  </svg>
);
export const ClockIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
export const TagIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M20.6 13.4L11 3.8A2 2 0 0 0 9.6 3H4a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.8z" />
    <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
  </svg>
);
export const SettingsIcon = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 1-2.9h.1a1.7 1.7 0 0 0 .3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1-1 2.9h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const BriefcaseIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="2" y="7" width="20" height="14" rx="2.5" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
export const CheckSquareIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
export const TrashIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
export const CrownIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 17l1.5-9L9 12l3-7 3 7 4.5-4L21 17z" />
    <path d="M5 21h14" />
  </svg>
);
export const ChartIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);
export const CardIcon = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);
export const PencilIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </svg>
);
export const SparkleIcon = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" />
    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </svg>
);
