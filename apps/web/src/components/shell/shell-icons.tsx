import type { NavIconId } from './nav-config';

const paths: Record<NavIconId, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z',
  brand:
    'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 2.2 5.5 2.75v2.1L12 12.8 6.5 10.05v-2.1L12 5.2Zm-5.5 6.1L12 14.1l5.5-2.8v4.35L12 18.8l-5.5-2.75V11.3Z',
  campaigns: 'M4 6h16v2H4V6Zm0 5h12v2H4v-2Zm0 5h16v2H4v-2Z',
  content:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 3v2h10V7H7Zm0 4v2h10v-2H7Zm0 4v2h7v-2H7Z',
  requests: 'M6 4h12a1 1 0 0 1 1 1v14l-4-2.5L11 19 7 16.5 4 19V5a1 1 0 0 1 2 0v.01L6 4Z',
  tasks:
    'M9 6h11v2H9V6Zm0 5h11v2H9v-2Zm0 5h11v2H9v-2ZM5 6.5 6.5 8 9 5.5 7.5 4 6.5 5 5 3.5 3.5 5 5 6.5Zm0 5L6.5 13 9 10.5 7.5 9 6.5 10 5 8.5 3.5 10 5 11.5Zm0 5L6.5 18 9 15.5 7.5 14 6.5 15 5 13.5 3.5 15 5 16.5Z',
  deliverables:
    'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 1.5V9h4.5L14 4.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z',
  reviews:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-1 3h2v5h-2V8Zm0 6h2v2h-2v-2Z',
  schedule:
    'M7 3h2v2h6V3h2v2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V3Zm12 7H5v9h14v-9Z',
  analytics: 'M4 19h16v2H4v-2Zm2-2V9h2v8H6Zm5 0V5h2v12h-2Zm5 0v-5h2v5h-2Z',
  team: 'M9 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM4.5 19c0-2.5 2.2-4.5 4.5-4.5h1c2.3 0 4.5 2 4.5 4.5V20H4.5v-1Zm10.2-4.2c.8-.4 1.7-.6 2.6-.6h.4c1.8 0 3.3 1.4 3.3 3.3V20h-4.5v-1.1c0-1.1-.4-2.1-1-3Z',
  activity: 'M4 12h3l2-6 4 12 2-6h5',
  settings:
    'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.1 2.8-.9-1.6 1.2-1.5-1.7-1.7-1.5 1.2-1.6-.9L14.5 4h-5l-.2 2.8-1.6.9-1.5-1.2-1.7 1.7 1.2 1.5-.9 1.6L3 12.5v5l2.8.2.9 1.6-1.2 1.5 1.7 1.7 1.5-1.2 1.6.9.2 2.8h5l.2-2.8 1.6-.9 1.5 1.2 1.7-1.7-1.2-1.5.9-1.6 2.8-.2v-5l-2.8-.2Z',
  company:
    'M4 20V6a1 1 0 0 1 1-1h6v15H5a1 1 0 0 1-1-1Zm10 0V3h5a1 1 0 0 1 1 1v16h-6ZM7 8h2v2H7V8Zm0 4h2v2H7v-2Zm8-5h2v2h-2V7Zm0 4h2v2h-2v-2Z',
  menu: 'M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z',
  collapse: 'M14 6l-6 6 6 6',
  search:
    'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm7.2 10.3 2 2-1.4 1.4-2-2 1.4-1.4Z',
  bell: 'M12 3a5 5 0 0 1 5 5v3.2l1.4 2.1A1 1 0 0 1 17.6 15H6.4a1 1 0 0 1-.8-1.7L7 11.2V8a5 5 0 0 1 5-5Zm-2 14a2 2 0 0 0 4 0h-4Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c3.3 0 6 2 6 4.5V20H6v-1.5C6 16 8.7 14 12 14Z',
};

export function ShellIcon({
  name,
  size = 20,
  className,
}: {
  name: NavIconId;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] ?? paths.home} />
    </svg>
  );
}
