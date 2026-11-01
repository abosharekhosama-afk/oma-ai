import type { NavIconId } from './nav-config';

type IconDrawing = { paths: string[]; circles?: Array<[number, number, number]> };

/** Lightweight, consistent outline icons for OMA navigation and shell controls. */
const drawings: Record<NavIconId, IconDrawing> = {
  home: { paths: ['M3.5 10.5 12 3.75l8.5 6.75', 'M5.5 9.5v10h5v-6h3v6h5v-10'] },
  brand: {
    paths: [
      'm12 3.5 8 4.25v8.5l-8 4.25-8-4.25v-8.5l8-4.25Z',
      'm4.25 7.9 7.75 4.2 7.75-4.2',
      'M12 12.1v8.1',
    ],
  },
  campaigns: { paths: ['M4 6h16', 'M4 12h11', 'M4 18h16'], circles: [[18, 12, 1]] },
  content: { paths: ['M6 3.75h8l4 4v12.5H6z', 'M14 3.75v4h4', 'M9 12h6', 'M9 16h6'] },
  requests: { paths: ['M6 3.75h12v16.5l-6-3.5-6 3.5z', 'M9 9h6', 'M9 12.5h6'] },
  tasks: {
    paths: [
      'm4.5 6.5 1.5 1.5 2.5-3',
      'M11 6.5h8.5',
      'm4.5 12.5 1.5 1.5 2.5-3',
      'M11 12.5h8.5',
      'm4.5 18.5 1.5 1.5 2.5-3',
      'M11 18.5h8.5',
    ],
  },
  deliverables: { paths: ['M6 3.75h8l4 4v12.5H6z', 'M14 3.75v4h4', 'M9 12h6', 'M9 16h6'] },
  reviews: {
    paths: [
      'M12 3.5 19.5 6v5.2c0 4.5-3.1 7.6-7.5 9.3-4.4-1.7-7.5-4.8-7.5-9.3V6L12 3.5Z',
      'm8.7 12 2.1 2.1 4.6-4.6',
    ],
  },
  schedule: {
    paths: [
      'M5 5.5h14v15H5z',
      'M8 3.5v4',
      'M16 3.5v4',
      'M5 9.5h14',
      'M8.5 13h.01',
      'M12 13h.01',
      'M15.5 13h.01',
      'M8.5 16.5h.01',
      'M12 16.5h.01',
    ],
  },
  analytics: { paths: ['M4 20V11', 'M10 20V5', 'M16 20v-8', 'M22 20H2'] },
  team: {
    paths: [
      'M19.5 20v-1.5a4.5 4.5 0 0 0-4.5-4.5H9a4.5 4.5 0 0 0-4.5 4.5V20',
      'M12 11a3.75 3.75 0 1 0 0-7.5A3.75 3.75 0 0 0 12 11Z',
      'M16.5 5a3.5 3.5 0 0 1 0 6.5',
    ],
  },
  activity: { paths: ['M3.5 12h4l2.5-7 4 14 2.5-7h4'] },
  settings: {
    paths: [
      'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
      'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.8.2l-.2.1-3.3-1.2-.1-.2a1.7 1.7 0 0 0-1.2-1.1h-.2l-1.2-3.3.1-.2a1.7 1.7 0 0 0-.2-1.8l-.1-.2 1.2-3.3.2-.1a1.7 1.7 0 0 0 1.1-1.2v-.2l3.3-1.2.2.1a1.7 1.7 0 0 0 1.8-.2l.2-.1 1.7 2.9-.1.2a1.7 1.7 0 0 0 .2 1.8l.1.2-.2 3.3Z',
    ],
  },
  company: {
    paths: [
      'M4 20V5.5a1 1 0 0 1 1-1h6v15.5H4Z',
      'M13 20V3.5h6a1 1 0 0 1 1 1V20h-7Z',
      'M7 8h1',
      'M7 11.5h1',
      'M15.5 7h1',
      'M15.5 10.5h1',
    ],
  },
  menu: { paths: ['M4 6.5h16', 'M4 12h16', 'M4 17.5h16'] },
  collapse: { paths: ['m14.5 5-7 7 7 7'] },
  search: { paths: ['M20 20l-4.5-4.5', 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z'] },
  bell: { paths: ['M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'] },
  plus: { paths: ['M12 5v14', 'M5 12h14'] },
  user: {
    paths: [
      'M19.5 20v-1.5a4.5 4.5 0 0 0-4.5-4.5H9a4.5 4.5 0 0 0-4.5 4.5V20',
      'M12 11a3.75 3.75 0 1 0 0-7.5A3.75 3.75 0 0 0 12 11Z',
    ],
  },
  filter: { paths: ['M4 6h16', 'M7 12h10', 'M10 18h4'] },
  'calendar-view': {
    paths: ['M5 5.5h14v14H5z', 'M8 3.5v4', 'M16 3.5v4', 'M5 9.5h14'],
  },
  'list-view': {
    paths: ['M8 7h12', 'M8 12h12', 'M8 17h12', 'M4 7h.01', 'M4 12h.01', 'M4 17h.01'],
  },
  'grid-view': {
    paths: ['M4.5 4.5h6.5v6.5H4.5z', 'M13 4.5h6.5v6.5H13z', 'M4.5 13h6.5v6.5H4.5z', 'M13 13h6.5v6.5H13z'],
  },
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
  const icon = drawings[name] ?? drawings.home;
  return (
    <svg
      className={className}
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon.paths.map((d, index) => (
        <path key={`path-${index}`} d={d} />
      ))}
      {icon.circles?.map(([cx, cy, r], index) => (
        <circle key={`circle-${index}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}
