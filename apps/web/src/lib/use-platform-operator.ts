'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { canAccessAdminHub, type SystemRole } from './platform-operator';

type Me = {
  user?: { system_role?: SystemRole };
  capabilities?: string[];
};

export function usePlatformOperator() {
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState({
    ok: false,
    superAdmin: false,
    support: false,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api<Me>('/api/v1/auth/me');
      setAccess(
        canAccessAdminHub({
          systemRole: me.user?.system_role,
          capabilities: me.capabilities,
        }),
      );
    } catch {
      setAccess({ ok: false, superAdmin: false, support: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...access, loading, reload };
}
