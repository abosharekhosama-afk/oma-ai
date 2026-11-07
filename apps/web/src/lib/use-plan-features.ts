'use client';

import { useEffect, useState } from 'react';
import { getSubscription } from './billing-api';

export function usePlanFeatures() {
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSubscription()
      .then((res) => {
        if (!cancelled) setFeatures(res.data.plan.features);
      })
      .catch(() => {
        if (!cancelled) setFeatures(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return features;
}

/** Unknown entitlements do not block the view; a loaded plan does. */
export function viewAllowedByPlan(view: string, features: Record<string, boolean> | null) {
  if (!features) return true;
  if (view === 'grid') return features.grid_view !== false;
  if (view === 'list') return features.list_view !== false;
  return true;
}
