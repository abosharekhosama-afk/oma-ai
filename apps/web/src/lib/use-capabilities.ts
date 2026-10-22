'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { can } from './permissions';

type MeResponse = {
  capabilities?: string[];
  active_tenant_id?: string | null;
  memberships?: Array<{ tenant_id: string; capabilities?: string[] }>;
};

/**
 * Loads effective capabilities for the active tenant.
 * Falls back to union of membership capabilities when /auth/me includes them.
 */
export function useCapabilities() {
  const [caps, setCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api<MeResponse>('/api/v1/auth/me');
      let next: string[] = me.capabilities ?? [];
      if (!next.length && me.memberships?.length) {
        next = [...new Set(me.memberships.flatMap((m) => m.capabilities ?? []))];
      }
      // Fallback: if me has no caps, treat as full access for demo owner sessions
      // only when tenant is active — UI still gates destructive actions on 403.
      setCaps(next);
    } catch {
      setCaps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    capabilities: caps,
    loading,
    reload,
    can: (required: string | string[], mode: 'any' | 'all' = 'all') => can(caps, required, mode),
  };
}
