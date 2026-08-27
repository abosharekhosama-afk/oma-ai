export type RobotsDecision = 'ALLOW' | 'DISALLOW' | 'UNKNOWN';

export function evaluateRobotsPath(path: string): RobotsDecision {
  if (path.includes('/private') || path.includes('/admin')) return 'DISALLOW';
  return 'ALLOW';
}
