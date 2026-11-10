import type { RobotsDecision } from '../ports/website-connector.port';

export type RobotsRule = {
  type: 'allow' | 'disallow';
  pattern: string;
};

export type RobotsGroup = {
  userAgents: string[];
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
};

export type ParsedRobots = {
  groups: RobotsGroup[];
  sitemaps: string[];
};

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^+\-?.]/g, '\\$&');
}

export function robotsPatternToRegExp(pattern: string): RegExp {
  let source = pattern;
  let anchoredEnd = false;
  if (source.endsWith('$')) {
    anchoredEnd = true;
    source = source.slice(0, -1);
  }
  const body = source.split('*').map(escapeRegex).join('.*');
  return new RegExp(`^${body}${anchoredEnd ? '$' : ''}`);
}

export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let currentAgents: string[] = [];
  let current: RobotsGroup | null = null;
  let pendingAgents = true;

  const flush = () => {
    if (current && current.userAgents.length > 0) groups.push(current);
    current = null;
    currentAgents = [];
    pendingAgents = true;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const stripped = rawLine.replace(/\s*#.*$/, '').trim();
    if (!stripped) continue;
    const colon = stripped.indexOf(':');
    if (colon < 1) continue;
    const field = stripped.slice(0, colon).trim().toLowerCase();
    const value = stripped.slice(colon + 1).trim();

    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      if (!agent) continue;
      if (!pendingAgents) flush();
      currentAgents.push(agent);
      current = current ?? { userAgents: currentAgents, rules: [], crawlDelaySeconds: null };
      current.userAgents = currentAgents;
      pendingAgents = true;
      continue;
    }
    if (!current) continue;
    pendingAgents = false;
    if (field === 'disallow') {
      current.rules.push({ type: 'disallow', pattern: value });
      continue;
    }
    if (field === 'allow') {
      if (value) current.rules.push({ type: 'allow', pattern: value });
      continue;
    }
    if (field === 'crawl-delay') {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) current.crawlDelaySeconds = delay;
    }
  }
  flush();
  return { groups, sitemaps };
}

function normalizeProductToken(userAgent: string): string {
  const token = userAgent.trim().split(/[/\s]/)[0]?.toLowerCase() ?? '*';
  return token.startsWith('oma-brandscanner') ? 'oma-brandscanner' : token;
}

function selectGroup(parsed: ParsedRobots, userAgent: string): RobotsGroup | null {
  const token = normalizeProductToken(userAgent);
  let specific: RobotsGroup | null = null;
  let wildcard: RobotsGroup | null = null;
  for (const group of parsed.groups) {
    if (group.userAgents.includes(token)) specific = group;
    if (group.userAgents.includes('*')) wildcard = group;
  }
  return specific ?? wildcard;
}

export function evaluateRobotsRules(
  parsed: ParsedRobots,
  pathAndQuery: string,
  userAgent: string,
): { decision: RobotsDecision; crawlDelaySeconds: number | null } {
  const group = selectGroup(parsed, userAgent);
  if (!group) return { decision: 'ALLOW', crawlDelaySeconds: null };
  const target = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  let best: { type: 'allow' | 'disallow'; length: number } | null = null;
  for (const rule of group.rules) {
    if (!rule.pattern) {
      if (rule.type === 'disallow') continue;
    }
    try {
      if (!robotsPatternToRegExp(rule.pattern).test(target)) continue;
    } catch {
      continue;
    }
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.type === 'allow')) {
      best = { type: rule.type, length };
    }
  }
  if (!best) return { decision: 'ALLOW', crawlDelaySeconds: group.crawlDelaySeconds };
  return {
    decision: best.type === 'allow' ? 'ALLOW' : 'DISALLOW',
    crawlDelaySeconds: group.crawlDelaySeconds,
  };
}

export type CachedRobots =
  | { availability: 'ok'; parsed: ParsedRobots }
  | { availability: 'missing' }
  | { availability: 'unavailable' };

export function decideRobotsPath(
  cached: CachedRobots,
  pathAndQuery: string,
  userAgent: string,
): { decision: RobotsDecision; crawlDelaySeconds: number | null; sitemaps: string[] } {
  if (cached.availability === 'missing') {
    return { decision: 'ALLOW', crawlDelaySeconds: null, sitemaps: [] };
  }
  if (cached.availability === 'unavailable') {
    return { decision: 'DISALLOW', crawlDelaySeconds: null, sitemaps: [] };
  }
  const evaluated = evaluateRobotsRules(cached.parsed, pathAndQuery, userAgent);
  return { ...evaluated, sitemaps: cached.parsed.sitemaps };
}
