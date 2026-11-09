import { api } from './api';

export type PublishQueueSlot = {
  id?: string;
  day_of_week: number;
  time_local: string;
  enabled: boolean;
  origin: 'optimal' | 'manual';
  time_label?: string;
};

export type PublishQueue = {
  id: string;
  social_page_id: string;
  brand_id: string;
  name: string;
  network: string;
  enabled: boolean;
  slots_per_day: number;
  window_start: string | null;
  window_end: string | null;
  split: string;
  use_suggested: boolean;
  manual_slots: PublishQueueSlot[];
  resolved_slots: PublishQueueSlot[];
};

export function listPublishQueues(brandId?: string | null) {
  const q = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
  return api<{ items: PublishQueue[] }>(`/api/v1/workspace/publish-queues${q}`);
}

export function savePublishQueue(input: {
  social_page_id: string;
  enabled?: boolean;
  slots_per_day?: number;
  window_start?: string | null;
  window_end?: string | null;
  split?: string;
  use_suggested?: boolean;
  manual_slots?: Array<{ day_of_week: number; time_local: string; enabled?: boolean }>;
}) {
  return api<PublishQueue>('/api/v1/workspace/publish-queues', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
