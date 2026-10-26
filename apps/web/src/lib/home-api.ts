import { api } from './api';

type Copy = { en: string; ar: string };

export type HomeChecklistStep = { id: string; done: boolean; href: string; count: number };

export type HomeBrandSummary = {
  id: string;
  name: string;
  logo_url: string | null;
  channels: string[];
  awaiting_approval: number;
  scheduled_this_week: number;
};

export type HomeAwaitingItem = {
  id: string;
  title: Copy;
  caption: Copy | null;
  channel: string;
  brand_id: string;
  brand: string | null;
  thumbnail_url: string | null;
  requested_by: string | null;
  requested_at: string;
  progress: { approved: number; required: number };
  href: string;
};

export type HomeWeekItem = {
  id: string;
  title: Copy;
  channel: string;
  brand: string | null;
  scheduled_at: string;
  /** Local day (YYYY-MM-DD) in the week's scheduling timezone. */
  day?: string;
  thumbnail_url: string | null;
  href: string;
};

export type HomeData = {
  generated_at: string;
  counts: {
    brands: number;
    active_campaigns: number;
    content_in_review: number;
    scheduled_this_week: number;
    open_tasks: number;
    overdue_tasks: number;
    my_open_tasks: number;
    open_requests: number;
    deliverables_awaiting_review: number;
    pending_reviews: number;
  };
  my_tasks: Array<{
    id: string;
    title: Copy;
    status: string;
    priority: string;
    due_at: string | null;
    overdue: boolean;
    brand: string | null;
    href: string;
  }>;
  pending_reviews: Array<{
    kind: 'content' | 'deliverable';
    id: string;
    title: Copy;
    brand: string | null;
    progress: { approved: number; required: number } | null;
    href: string;
    at: string;
  }>;
  upcoming_schedule: Array<{
    id: string;
    title: Copy;
    channel: string;
    scheduled_at: string | null;
    brand: string | null;
    href: string;
  }>;
  checklist: HomeChecklistStep[];
  /** Planable Home additions (optional for older API payloads). */
  brand_summaries?: HomeBrandSummary[];
  awaiting_me?: HomeAwaitingItem[];
  week?: { start: string; timezone?: string; days?: string[]; items: HomeWeekItem[] };
  can_approve?: boolean;
  publishing_connected: false;
};

/** Real tenant-scoped command center (GET /api/v1/home). */
export async function getHome(): Promise<HomeData> {
  const res = await api<{ data: HomeData }>('/api/v1/home');
  return res.data;
}
