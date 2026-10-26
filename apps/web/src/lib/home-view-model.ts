import type { HomeChecklistStep, HomeWeekItem } from './home-api';
import type { ActivityItem } from './activity-api';
import type { AppNotification } from './notifications-api';

export type Greeting = 'morning' | 'afternoon' | 'evening';

/** Time-of-day greeting bucket (local hour). */
export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/** First name for the greeting; falls back to the full trimmed name. */
export function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n.split(/\s+/)[0] ?? n;
}

/** YYYY-MM-DD in the viewer's local time zone. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type WeekDay = { key: string; date: Date; isToday: boolean; items: HomeWeekItem[] };

/** Seven consecutive local days starting today, each with its scheduled posts (time-sorted). */
export function bucketWeek(items: HomeWeekItem[], now: Date): WeekDay[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: localDayKey(date), date, isToday: i === 0, items: [] };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const item of [...items].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))) {
    byKey.get(localDayKey(new Date(item.scheduled_at)))?.items.push(item);
  }
  return days;
}

export type SetupProgress = { done: number; total: number; complete: boolean };

export function setupProgress(steps: HomeChecklistStep[] | undefined): SetupProgress {
  const list = steps ?? [];
  const done = list.filter((s) => s.done).length;
  return { done, total: list.length, complete: list.length > 0 && done === list.length };
}

/** Setup card shows only while incomplete and not dismissed by this user. */
export function shouldShowSetup(steps: HomeChecklistStep[] | undefined, dismissed: boolean): boolean {
  const p = setupProgress(steps);
  return !dismissed && p.total > 0 && !p.complete;
}

export type HomeComment = {
  id: string;
  type: string;
  href: string | null;
  at: string;
  unread: boolean;
  actor: string | null;
  context: { en: string; ar: string } | null;
  body: { en: string; ar: string } | null;
};

const isCommentType = (type: string) => /(^|\.)(comment|mention(ed)?)$/.test(type) || type.includes('mention');

/**
 * Comments/mentions for Home: comment/mention notifications, enriched with the
 * matching activity entry (same deep link) for author and snippet.
 */
export function mapComments(
  notifications: AppNotification[],
  activity: ActivityItem[],
  limit = 4,
): HomeComment[] {
  const commentActivity = activity.filter((a) => a.target?.snippet_kind === 'comment');
  return notifications
    .filter((n) => isCommentType(n.type))
    .slice(0, limit)
    .map((n) => {
      const match = commentActivity.find((a) => a.target?.href === n.deepLinkPath) ?? null;
      return {
        id: n.id,
        type: n.type,
        href: n.deepLinkPath || null,
        at: n.createdAt,
        unread: !n.readAt,
        actor: match?.actor_name ?? null,
        context: match?.target?.name ?? null,
        body: match?.target?.snippet ?? null,
      };
    });
}

/** Content plan deep links used by Home. */
export const homeLinks = {
  create: '/app/content?create=1',
  brand: (id: string) => `/app/content?view=feed&brand=${encodeURIComponent(id)}`,
  day: (key: string) => `/app/content?view=calendar&date=${key}`,
};
