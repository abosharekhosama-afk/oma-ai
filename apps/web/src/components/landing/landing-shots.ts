/** Real screenshots of the OMA app (Noor Media workspace), captured at 2x. Sizes are CSS px (natural / 2). */
export const SHOT_SIZES = {
  'analytics': { en: [740, 372], ar: [740, 372] },
  'approvals': { en: [720, 470], ar: [720, 470] },
  'comments': { en: [1024, 600], ar: [1024, 600] },
  'composer': { en: [700, 453], ar: [700, 449] },
  'deliverables': { en: [1024, 620], ar: [1024, 620] },
  'drive': { en: [760, 629], ar: [760, 629] },
  'hero': { en: [1024, 640], ar: [1024, 640] },
  'notifications': { en: [492, 540], ar: [492, 540] },
  'requests': { en: [1024, 620], ar: [1024, 620] },
  'tasks': { en: [1024, 620], ar: [1024, 620] },
  'team': { en: [720, 370], ar: [720, 370] },
  'view-calendar': { en: [1024, 640], ar: [1024, 640] },
  'view-feed': { en: [1024, 640], ar: [1024, 640] },
  'view-grid': { en: [1024, 640], ar: [1024, 640] },
  'view-list': { en: [1024, 640], ar: [1024, 640] },
} as const;

export type ShotId = keyof typeof SHOT_SIZES;
